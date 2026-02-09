// Load environment variables FIRST before any other imports
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import { exec, spawn, execSync } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { sessionPool } from './pool';
import { config, validateConfig } from './config';
import { getOrCreateSessionNetwork, deleteSessionNetwork, getNetworkName, cleanupOrphanedNetworks, getNetworkStats, getSubnetStats, getNetworkMetrics } from './networkManager';
import { kernelManager } from './kernelManager';
import { getCleanupWorker, shutdownCleanupWorker } from './cleanupWorker';

// Re-read environment variables into config after dotenv load
(config.docker as any).memory = process.env.DOCKER_MEMORY || '512m';
(config.docker as any).memorySQL = process.env.DOCKER_MEMORY_SQL || '512m';
(config.docker as any).cpus = process.env.DOCKER_CPUS || '0.5';
(config.docker as any).cpusNotebook = process.env.DOCKER_CPUS_NOTEBOOK || '1';
(config.docker as any).timeout = process.env.DOCKER_TIMEOUT || '30s';

console.log('[Server] Loaded Docker config:', {
  memory: config.docker.memory,
  memorySQL: config.docker.memorySQL,
  cpus: config.docker.cpus,
});

// Validate configuration at startup
validateConfig();

// Run aggressive cleanup on startup
try {
  console.log('[Server] Running startup cleanup...');
  const cleanupScript = path.resolve(__dirname, '../../cleanup.sh');
  if (fs.existsSync(cleanupScript)) {
    execSync(`${cleanupScript} --silent`, { stdio: 'inherit' });
    console.log('[Server] Startup cleanup completed');
  } else {
    console.warn('[Server] Cleanup script not found at:', cleanupScript);
  }
} catch (error) {
  console.error('[Server] Startup cleanup failed:', error);
}

const execAsync = promisify(exec);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = config.server.port;

// Middleware
app.use(cors());
app.use(express.json());

export interface File {
  name: string;
  path: string;
  content: string;
  toBeExec?: boolean;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function getRunCommand(language: string, entryFile: string): string {
  switch(language) {
    case 'python': return `python -u ${entryFile}`; // -u for unbuffered output
    case 'javascript': return `node ${entryFile}`;
    case 'cpp': {
      // Determine compiler and file extension pattern based on entry file
      const ext = entryFile.split('.').pop()?.toLowerCase();
      if (ext === 'c') {
        // Pure C files - use gcc and only compile .c files
        return 'find . -maxdepth 1 -name "*.c" -print0 | xargs -0 gcc -o app && ./app';
      } else {
        // C++ files (.cpp, .cc, .cxx, .c++) - use g++ and compile C++ files only
        return 'find . -maxdepth 1 \\( -name "*.cpp" -o -name "*.cc" -o -name "*.cxx" -o -name "*.c++" \\) -print0 | xargs -0 g++ -o app && ./app';
      }
    }
    case 'java': {
      const className = entryFile.split('/').pop()?.replace('.java', '') || entryFile.replace('.java', '');
      return `javac -d . $(find . -name "*.java") && java ${className}`;
    }
    case 'sql': {
      return `MYSQL_PWD=root mysql -u root < ${entryFile}`;
    }
    default: throw new Error(`Unsupported language: ${language}`);
  }
}

// --- Request Queue Manager ---
// Manages concurrent execution of 'run' requests with configurable parallelism
// Files within a single request execute sequentially to support dependencies (e.g., server→client)

interface QueuedTask {
  task: () => Promise<void>;
  priority: number;
  timestamp: number;
  language?: string;
}

class ExecutionQueue {
  private queue: Array<QueuedTask> = [];
  private activeCount: number = 0;
  private maxConcurrent: number;
  private completedTasks: number = 0;
  private failedTasks: number = 0;
  private taskTimes: number[] = [];
  private maxTaskTimeHistory: number = 100;
  private maxQueueSize: number;
  private queueTimeout: number;

  constructor(maxConcurrent: number, maxQueueSize?: number, queueTimeout?: number) {
    this.maxConcurrent = maxConcurrent;
    this.maxQueueSize = maxQueueSize || parseInt(process.env.MAX_QUEUE_SIZE || '200', 10);
    this.queueTimeout = queueTimeout || parseInt(process.env.QUEUE_TIMEOUT || '60000', 10);
  }

  enqueue(task: () => Promise<void>, priority: number = 0, language?: string): void {
    // Check queue size limit
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error(`Queue full: ${this.queue.length} tasks queued (max: ${this.maxQueueSize})`);
    }

    const queuedTask: QueuedTask = {
      task,
      priority,
      timestamp: Date.now(),
      language,
    };

    this.queue.push(queuedTask);
    
    // Sort queue by priority (higher first), then by timestamp (FIFO)
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.timestamp - b.timestamp;
    });

    this.processQueue();
  }

  private processQueue(): void {
    // Remove expired tasks from queue
    const now = Date.now();
    const initialQueueLength = this.queue.length;
    this.queue = this.queue.filter(qt => {
      if (now - qt.timestamp > this.queueTimeout) {
        console.warn(`[ExecutionQueue] Task timed out after ${this.queueTimeout}ms in queue`);
        this.failedTasks++;
        return false;
      }
      return true;
    });
    if (this.queue.length < initialQueueLength) {
      console.log(`[ExecutionQueue] Removed ${initialQueueLength - this.queue.length} expired tasks from queue`);
    }

    // Process tasks without blocking - key fix for concurrency
    while (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
      const queuedTask = this.queue.shift();
      if (!queuedTask) break;

      this.activeCount++;
      const startTime = Date.now();

      // Execute task asynchronously WITHOUT await - this enables true parallelism
      queuedTask.task()
        .then(() => {
          const taskTime = Date.now() - startTime;
          this.taskTimes.push(taskTime);
          if (this.taskTimes.length > this.maxTaskTimeHistory) {
            this.taskTimes.shift();
          }
          this.completedTasks++;
        })
        .catch((error) => {
          console.error('[ExecutionQueue] Task error:', error);
          this.failedTasks++;
        })
        .finally(() => {
          this.activeCount--;
          // Continue processing remaining tasks
          if (this.queue.length > 0) {
            this.processQueue();
          }
        });
    }
  }

  getStats() {
    const averageTaskTime = this.taskTimes.length > 0
      ? this.taskTimes.reduce((a, b) => a + b, 0) / this.taskTimes.length
      : 0;

    return {
      queued: this.queue.length,
      active: this.activeCount,
      maxConcurrent: this.maxConcurrent,
      completedTasks: this.completedTasks,
      failedTasks: this.failedTasks,
      averageTaskTime: Math.round(averageTaskTime),
      maxQueueSize: this.maxQueueSize,
    };
  }

  getDetailedStats() {
    const stats = this.getStats();
    const queuedByLanguage: { [key: string]: number } = {};
    
    this.queue.forEach(qt => {
      if (qt.language) {
        queuedByLanguage[qt.language] = (queuedByLanguage[qt.language] || 0) + 1;
      }
    });

    return {
      ...stats,
      queuedByLanguage,
      queueUtilization: this.maxConcurrent > 0 
        ? Math.round((this.activeCount / this.maxConcurrent) * 100) 
        : 0,
    };
  }
}

const executionQueue = new ExecutionQueue(config.sessionContainers.maxConcurrentSessions);

// --- Kernel Manager Callbacks ---
// Set up kernel output and status streaming to clients
kernelManager.onOutput((kernelId, output) => {
  console.log(`[Kernel Output] kernelId=${kernelId}, cellId=${output.cellId}, type=${output.type}, content=${output.content.substring(0, 50)}`);
  // Broadcast to all sockets (in production, filter by socketId)
  io.emit('kernel:output', { kernelId, ...output });
});

kernelManager.onStatusChange((kernelId, status) => {
  console.log(`[Kernel Status] kernelId=${kernelId}, status=${status}`);
  io.emit('kernel:status', { kernelId, status });
});

kernelManager.onCellComplete((kernelId, cellId) => {
  console.log(`[Kernel Cell Complete] kernelId=${kernelId}, cellId=${cellId}`);
  io.emit('kernel:cell_complete', { kernelId, cellId });
});

// --- WebSocket Handling ---
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  let currentProcess: any = null;
  let tempDir: string | null = null;
  let containerId: string | null = null;
  let currentLanguage: string | null = null;
  let currentSessionId: string | null = null;
  let manuallyStopped: boolean = false;
  
  // Output buffering - batch chunks to reduce socket traffic and memory overhead
  // Instead of emitting every stdout/stderr chunk immediately, we buffer them and
  // emit in batches every 100ms. This reduces:
  // - Socket.io message overhead (fewer emit calls)
  // - Network traffic (combined chunks are more efficient)
  // - Client-side memory pressure (reduces processing overhead)
  // - Server console logging (only critical logs kept after refactoring)
  let outputBuffer: { sessionId: string; type: 'stdout' | 'stderr'; data: string }[] = [];
  let flushBufferTimer: NodeJS.Timeout | null = null;
  
  const flushOutputBuffer = () => {
    if (outputBuffer.length > 0) {
      // Combine consecutive same-type chunks to further reduce overhead
      // e.g., [stdout:"a", stdout:"b", stderr:"c"] → [stdout:"ab", stderr:"c"]
      const combined: { sessionId: string; type: 'stdout' | 'stderr'; data: string }[] = [];
      for (const item of outputBuffer) {
        if (combined.length > 0 && combined[combined.length - 1].type === item.type && combined[combined.length - 1].sessionId === item.sessionId) {
          combined[combined.length - 1].data += item.data;
        } else {
          combined.push(item);
        }
      }
      // Emit combined chunks
      combined.forEach(item => socket.emit('output', item));
      outputBuffer = [];
    }
    flushBufferTimer = null;
  };
  
  const scheduleFlush = () => {
    if (!flushBufferTimer) {
      flushBufferTimer = setTimeout(flushOutputBuffer, 100); // Flush every 100ms
    }
  };

  socket.on('run', async (data: { sessionId: string; language: string, files: File[] }) => {
    const { sessionId, language, files } = data;
    
    // Enqueue the execution task with configurable concurrency
    // Priority: WebSocket interactive requests get priority 2 (higher than API)
    executionQueue.enqueue(async () => {
      currentLanguage = language;
      currentSessionId = sessionId;
      manuallyStopped = false; // Reset flag for new execution
      const startTime = Date.now(); // Track execution start time

      const runtimeConfig = config.runtimes[language as keyof typeof config.runtimes];
      if (!runtimeConfig) {
        socket.emit('output', { sessionId, type: 'stderr', data: `Error: Unsupported language '${language}'\n` });
        socket.emit('exit', { sessionId, code: 1 });
        return;   
      }

      // Find entry file
      const entryFile = files.find(f => f.toBeExec);
      if (!entryFile && language !== 'cpp' && language !== 'sql') {
         socket.emit('output', { sessionId, type: 'stderr', data: 'Error: No entry file marked for execution.\n' });
         socket.emit('exit', { sessionId, code: 1 });
         return;
      }
      
      // For SQL, use the first .sql file if no file is marked
      let execFile = entryFile;
      if (!execFile && language === 'sql') {
        execFile = files.find(f => f.name.endsWith('.sql'));
        if (!execFile) {
          socket.emit('output', { sessionId, type: 'stderr', data: 'Error: No SQL file found.\n' });
          socket.emit('exit', { sessionId, code: 1 });
          return;
        }
      }

      let command = '';
      try {
          command = getRunCommand(language, execFile ? execFile.path : '');
      } catch (e: any) {
          socket.emit('output', { sessionId, type: 'stderr', data: e.message + '\n' });
          socket.emit('exit', { sessionId, code: 1 });
          return;
      }

      // 1. Get or create session container (always with networking)
      // Retry logic: if network/container creation fails, cleanup and try with new network
      const maxRetries = 2;
      let lastError: any = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[Execution] Creating container for session ${socket.id.substring(0, 8)}, language ${language} (attempt ${attempt}/${maxRetries})`);
          const networkName = await getOrCreateSessionNetwork(socket.id);
          console.log(`[Execution] Network ready: ${networkName}`);
          containerId = await sessionPool.getOrCreateContainer(language, socket.id, networkName);
          console.log(`[Execution] Container ready: ${containerId.substring(0, 12)}`);
          break; // Success - exit retry loop
        } catch (e: any) {
          lastError = e;
          console.error(`[Execution] Failed to acquire container (attempt ${attempt}/${maxRetries}):`, e.message);
          
          // Clean up the failed network before retrying
          await deleteSessionNetwork(socket.id).catch(cleanupErr =>
            console.error(`[Execution] Failed to cleanup network after error:`, cleanupErr)
          );
          
          // If this was the last attempt, fail
          if (attempt === maxRetries) {
            socket.emit('output', { sessionId, type: 'stderr', data: `System Error: Failed to acquire container after ${maxRetries} attempts - ${e.message}\n` });
            socket.emit('exit', { sessionId, code: 1 });
            return;
          }
          
          // Wait a bit before retrying to avoid hammering Docker
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // At this point, containerId must be set (we returned early if all retries failed)
      if (!containerId) {
        socket.emit('output', { sessionId, type: 'stderr', data: 'System Error: Container acquisition failed\n' });
        socket.emit('exit', { sessionId, code: 1 });
        return;
      }

      const runId = Date.now().toString() + Math.random().toString(36).substring(7);
      tempDir = path.resolve(__dirname, '..', 'temp', `runner-${runId}`);

      // 2. Write files (filter for C/C++ to avoid conflicts)
      try {
        fs.mkdirSync(tempDir, { recursive: true });
        
        // For C/C++, filter files based on entry file extension to avoid conflicts
        let filesToWrite = files;
        if (language === 'cpp' && execFile) {
          const entryExt = execFile.path.split('.').pop()?.toLowerCase();
          if (entryExt === 'c') {
            // Only copy .c and .h files
            filesToWrite = files.filter(f => {
              const ext = f.path.split('.').pop()?.toLowerCase();
              return ext === 'c' || ext === 'h';
            });
          } else {
            // Only copy C++ files (.cpp, .cc, .cxx, .c++, .hpp, .h)
            filesToWrite = files.filter(f => {
              const ext = f.path.split('.').pop()?.toLowerCase();
              return ext === 'cpp' || ext === 'cc' || ext === 'cxx' || ext === 'c++' || ext === 'hpp' || ext === 'h';
            });
          }
        }
        
        for (const file of filesToWrite) {
          const filePath = path.join(tempDir, file.path);
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, file.content);
        }
      } catch (err: any) {
        cleanup().catch(e => console.error('[Cleanup] Error:', e));
        socket.emit('output', { sessionId, type: 'stderr', data: `System Error: ${err.message}\n` });
        socket.emit('exit', { sessionId, code: 1 });
        return;
      }

      // 3. Copy files
      const cpCommand = `docker cp "${tempDir}/." ${containerId}:/app/`;
      console.log(`[Execution] Copying files to container ${containerId.substring(0, 12)}`);
      
      await new Promise<void>((resolve, reject) => {
        exec(cpCommand, { timeout: config.docker.commandTimeout }, (cpError) => {
          if (cpError) {
            console.error(`[Execution] Failed to copy files:`, cpError);
            cleanup().catch(e => console.error('[Cleanup] Error:', e));
            socket.emit('output', { sessionId, type: 'stderr', data: `System Error (Copy): ${cpError.message}\n` });
            socket.emit('exit', { sessionId, code: 1 });
            reject(cpError);
            return;
          }
          console.log(`[Execution] Files copied successfully to ${containerId!.substring(0, 12)}`);

          // 4. Spawn process
          // Use -i for interactive (keeps stdin open)
          const dockerArgs = [
            'exec',
            '-i', 
            '-w', '/app',
            containerId!,
            '/bin/sh', '-c', command
          ];

          console.log(`[Execution] Spawning process: docker ${dockerArgs.join(' ')}`);
          currentProcess = spawn('docker', dockerArgs);

          currentProcess.stdout.on('data', (chunk: Buffer) => {
            console.log(`[Execution] stdout data received: ${chunk.length} bytes`);
            outputBuffer.push({ sessionId, type: 'stdout', data: chunk.toString() });
            scheduleFlush();
          });

          currentProcess.stderr.on('data', (chunk: Buffer) => {
            console.log(`[Execution] stderr data received: ${chunk.length} bytes`);
            outputBuffer.push({ sessionId, type: 'stderr', data: chunk.toString() });
            scheduleFlush();
          });

          currentProcess.on('close', (code: number) => {
            console.log(`[Execution] Process closed with code ${code}`);
            // Flush any remaining buffered output before exit
            if (flushBufferTimer) {
              clearTimeout(flushBufferTimer);
              flushOutputBuffer();
            }
            
            // Calculate execution time
            const executionTime = Date.now() - startTime;
            
            // Only emit exit if not manually stopped (manual stop already emitted exit)
            if (!manuallyStopped) {
              socket.emit('exit', { sessionId, code, executionTime });
            }
            cleanup().catch(e => console.error('[Cleanup] Error:', e));
            resolve();
          });

          currentProcess.on('error', (err: any) => {
            console.error(`[Execution] Process error:`, err);
            socket.emit('output', { sessionId, type: 'stderr', data: `Process Error: ${err.message}\n` });
            cleanup().catch(e => console.error('[Cleanup] Error:', e));
            reject(err);
          });
        });
      });
    }, 2, language); // Priority 2 for interactive WebSocket requests
  });

  socket.on('input', (data: string) => {
    if (currentProcess && currentProcess.stdin) {
      currentProcess.stdin.write(data);
    }
  });

  socket.on('stop', (data: { sessionId: string }) => {
    const { sessionId } = data;
    if (currentProcess && currentSessionId === sessionId) {
      manuallyStopped = true;
      currentProcess.kill('SIGTERM');
      socket.emit('output', { sessionId, type: 'system', data: '[Process terminated]\n' });
      socket.emit('exit', { sessionId, code: -1 });
      cleanup().catch(e => console.error('[Cleanup] Error:', e));
    }
  });

  // --- Notebook Kernel Events ---
  
  socket.on('kernel:start', async (data: { notebookId: string; language?: string }) => {
    const { notebookId, language = 'python' } = data;
    try {
      const kernelId = await kernelManager.startKernel(notebookId, socket.id, language);
      socket.emit('kernel:started', { notebookId, kernelId });
    } catch (error: any) {
      socket.emit('kernel:error', { notebookId, error: error.message });
    }
  });

  socket.on('kernel:execute', async (data: { kernelId: string; cellId: string; code: string }) => {
    const { kernelId, cellId, code } = data;
    try {
      const executionCount = await kernelManager.executeCell(kernelId, cellId, code);
      socket.emit('kernel:execution_started', { kernelId, cellId, executionCount });
    } catch (error: any) {
      socket.emit('kernel:error', { kernelId, cellId, error: error.message });
    }
  });

  socket.on('kernel:interrupt', async (data: { kernelId: string }) => {
    const { kernelId } = data;
    try {
      await kernelManager.interruptKernel(kernelId);
      socket.emit('kernel:interrupted', { kernelId });
    } catch (error: any) {
      socket.emit('kernel:error', { kernelId, error: error.message });
    }
  });

  socket.on('kernel:restart', async (data: { kernelId: string }) => {
    const { kernelId } = data;
    try {
      await kernelManager.restartKernel(kernelId);
      socket.emit('kernel:restarted', { kernelId });
    } catch (error: any) {
      socket.emit('kernel:error', { kernelId, error: error.message });
    }
  });

  socket.on('kernel:shutdown', async (data: { kernelId: string }) => {
    const { kernelId } = data;
    try {
      await kernelManager.shutdownKernel(kernelId);
      socket.emit('kernel:shutdown_complete', { kernelId });
    } catch (error: any) {
      socket.emit('kernel:error', { kernelId, error: error.message });
    }
  });

  socket.on('disconnect', async () => {
    if (flushBufferTimer) {
      clearTimeout(flushBufferTimer);
    }
    if (currentProcess) {
      currentProcess.kill();
    }
    await cleanup().catch(e => console.error('[Cleanup] Error:', e));
    
    // Clean up all session containers for this socket
    await sessionPool.cleanupSession(socket.id);
    
    // Clean up all kernels for this socket
    await kernelManager.shutdownSocketKernels(socket.id);
    
    // Clean up session network
    await deleteSessionNetwork(socket.id).catch(err => 
      console.error(`[Disconnect] Failed to cleanup session network:`, err)
    );
  });

  async function cleanup() {
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) { /* ignore */ }
      tempDir = null;
    }
    if (containerId) {
      // Return container to pool (cleaned and TTL refreshed)
      await sessionPool.returnContainer(containerId, socket.id).catch(err =>
        console.error(`[Cleanup] Failed to return container to pool:`, err)
      );
      containerId = null;
    }
    currentProcess = null;
  }
});

// --- API Endpoints ---

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.0.0',
    environment: config.server.env,
    timestamp: new Date().toISOString()
  });
});

// Network and subnet monitoring endpoint
app.get('/api/network-stats', async (req, res) => {
  try {
    const networkStats = await getNetworkStats();
    const subnetStats = getSubnetStats();
    
    res.json({
      status: 'ok',
      server: {
        environment: config.server.env,
        port: config.server.port,
      },
      resources: {
        docker: {
          memory: config.docker.memory,
          cpus: config.docker.cpus,
        },
        networkCapacity: {
          ...subnetStats,
          warnings: subnetStats.totalUsed > (subnetStats.totalAvailable * 0.8) 
            ? ['Approaching subnet capacity (>80% used)']
            : [],
        }
      },
      networks: networkStats,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cleanup metrics endpoint
app.get('/api/cleanup-stats', async (req, res) => {
  try {
    const poolMetrics = sessionPool.getMetrics();
    const networkMetrics = getNetworkMetrics();
    const subnetStats = getSubnetStats();
    
    // Get current session pool status
    const sessionCount = sessionPool.getSessionCount();
    
    // Add warnings if needed
    const warnings: string[] = [];
    if (poolMetrics.cleanupErrors > 10) {
      warnings.push(`High container cleanup error count: ${poolMetrics.cleanupErrors}`);
    }
    if (networkMetrics.cleanupErrors > 10) {
      warnings.push(`High network cleanup error count: ${networkMetrics.cleanupErrors}`);
    }
    if (networkMetrics.escalationLevel > 0) {
      warnings.push(`Network cleanup escalation active (level ${networkMetrics.escalationLevel})`);
    }
    if (subnetStats.totalUsed > (subnetStats.totalAvailable * 0.8)) {
      warnings.push('Subnet capacity above 80%');
    }
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      containers: {
        created: poolMetrics.containersCreated,
        reused: poolMetrics.containersReused,
        deleted: poolMetrics.containersDeleted,
        cleanupErrors: poolMetrics.cleanupErrors,
        lastCleanupDuration: poolMetrics.lastCleanupDuration,
        activeSessions: sessionCount,
      },
      networks: {
        created: networkMetrics.networksCreated,
        deleted: networkMetrics.networksDeleted,
        cleanupErrors: networkMetrics.cleanupErrors,
        escalationLevel: networkMetrics.escalationLevel,
        escalationDescription: networkMetrics.escalationLevel === 2 
          ? 'CRITICAL - Emergency cleanup' 
          : networkMetrics.escalationLevel === 1 
          ? 'WARNING - Aggressive cleanup'
          : 'NORMAL',
      },
      subnets: subnetStats,
      warnings
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Queue monitoring endpoint
app.get('/api/queue-stats', (req, res) => {
  try {
    const stats = executionQueue.getDetailedStats();
    const warnings: string[] = [];
    
    // Add warnings based on queue state
    if (stats.queued > stats.maxConcurrent * 2) {
      warnings.push(`Queue backlog: ${stats.queued} requests queued (${Math.round(stats.queued / stats.maxConcurrent)}x capacity)`);
    }
    if (stats.queueUtilization > 90) {
      warnings.push(`High concurrency: ${stats.queueUtilization}% of capacity in use`);
    }
    if (stats.failedTasks > stats.completedTasks * 0.1) {
      warnings.push(`High failure rate: ${stats.failedTasks} failed out of ${stats.completedTasks + stats.failedTasks} total`);
    }
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      queue: stats,
      warnings,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint for code execution - networking always enabled
app.post('/api/run', async (req, res) => {
  const { language, files } = req.body;

  if (!language || !files || !Array.isArray(files)) {
    res.status(400).json({ error: "Invalid request body. 'language' and 'files' are required." });
    return;
  }

  if (files.length === 0) {
    res.status(400).json({ error: "No files provided." });
    return;
  }

  const startTime = Date.now();
  const sessionId = `api-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  try {
    // Check queue capacity before accepting request
    const queueStats = executionQueue.getStats();
    if (queueStats.queued >= queueStats.maxQueueSize) {
      res.status(503).json({ 
        error: `Server overloaded: ${queueStats.queued} requests queued (max: ${queueStats.maxQueueSize})`,
        queueStats,
      });
      return;
    }

    // Execute via queue with priority 1 (lower than WebSocket requests)
    const result = await new Promise<RunResult>((resolve, reject) => {
      executionQueue.enqueue(async () => {
        try {
          const execResult = await executeWithSessionContainer(language, files, sessionId);
          resolve(execResult);
        } catch (error) {
          reject(error);
        }
      }, 1, language);
    });

    const executionTime = Date.now() - startTime;
    
    res.json({
      ...result,
      executionTime
    });
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    res.status(500).json({ 
      error: `Execution failed: ${error.message}`,
      executionTime
    });
  }
});

/**
 * Execute code with session container (for API endpoint)
 * Always uses networking
 */
async function executeWithSessionContainer(
  language: string,
  files: File[],
  sessionId: string
): Promise<RunResult> {
  return new Promise(async (resolve) => {
    const runtimeConfig = config.runtimes[language as keyof typeof config.runtimes];
    if (!runtimeConfig) {
      return resolve({
        stdout: '',
        stderr: `Error: Unsupported language '${language}'`,
        exitCode: 1
      });
    }

    // Find entry file
    const entryFile = files.find(f => f.toBeExec);
    if (!entryFile && language !== 'cpp' && language !== 'sql') {
      return resolve({ stdout: '', stderr: 'Error: No entry file marked for execution.', exitCode: 1 });
    }

    let execFile = entryFile;
    if (!execFile && language === 'sql') {
      execFile = files.find(f => f.name.endsWith('.sql'));
      if (!execFile) {
        return resolve({ stdout: '', stderr: 'Error: No SQL file found.', exitCode: 1 });
      }
    }

    let command = '';
    try {
      command = getRunCommand(language, execFile ? execFile.path : '');
    } catch (e: any) {
      return resolve({ stdout: '', stderr: e.message, exitCode: 1 });
    }

    let containerId: string | null = null;
    let tempDir: string | null = null;

    // Retry logic for network/container acquisition
    const maxRetries = 2;
    let networkCreated = false;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Always use session container with networking
        const networkName = await getOrCreateSessionNetwork(sessionId);
        networkCreated = true;
        containerId = await sessionPool.getOrCreateContainer(language, sessionId, networkName);
        break; // Success - exit retry loop
      } catch (error: any) {
        console.error(`[API] Failed to acquire container (attempt ${attempt}/${maxRetries}):`, error.message);
        
        // Clean up network if it was created
        if (networkCreated) {
          await deleteSessionNetwork(sessionId).catch(cleanupErr =>
            console.error(`[API] Failed to cleanup network after error:`, cleanupErr)
          );
          networkCreated = false;
        }
        
        // If this was the last attempt, give up
        if (attempt === maxRetries) {
          return resolve({ stdout: '', stderr: `System Error: Failed to acquire container after ${maxRetries} attempts - ${error.message}`, exitCode: 1 });
        }
        
        // Wait before retrying
        await new Promise(r => setTimeout(r, 500));
      }
    }

    try {
      const runId = Date.now().toString() + Math.random().toString(36).substring(7);
      tempDir = path.resolve(__dirname, '..', 'temp', `runner-${runId}`);

      // Write files (filter for C/C++ to avoid conflicts)
      fs.mkdirSync(tempDir, { recursive: true });
      
      // For C/C++, filter files based on entry file extension to avoid conflicts
      let filesToWrite = files;
      if (language === 'cpp' && execFile) {
        const entryExt = execFile.path.split('.').pop()?.toLowerCase();
        if (entryExt === 'c') {
          // Only copy .c and .h files
          filesToWrite = files.filter(f => {
            const ext = f.path.split('.').pop()?.toLowerCase();
            return ext === 'c' || ext === 'h';
          });
        } else {
          // Only copy C++ files (.cpp, .cc, .cxx, .c++, .hpp, .h)
          filesToWrite = files.filter(f => {
            const ext = f.path.split('.').pop()?.toLowerCase();
            return ext === 'cpp' || ext === 'cc' || ext === 'cxx' || ext === 'c++' || ext === 'hpp' || ext === 'h';
          });
        }
      }
      
      for (const file of filesToWrite) {
        const filePath = path.join(tempDir, file.path);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, file.content);
      }

      // Copy files to container
      const cpCommand = `docker cp "${tempDir}/." ${containerId}:/app/`;
      await new Promise<void>((res, rej) => {
        exec(cpCommand, { timeout: config.docker.commandTimeout }, (err) => err ? rej(err) : res());
      });

      // Execute command - use proper escaping
      const execCommand = `docker exec -w /app ${containerId} /bin/sh -c ${JSON.stringify(command)}`;
      exec(execCommand, { timeout: 30000 }, (error, stdout, stderr) => {
        const exitCode = error?.code ?? 0;

        // Cleanup
        if (tempDir) {
          try {
            fs.rmSync(tempDir, { recursive: true, force: true });
          } catch (e) { /* ignore */ }
        }

        if (containerId) {
          // Return to pool for reuse (cleaned and TTL refreshed)
          sessionPool.returnContainer(containerId, sessionId).catch(err =>
            console.error(`[API] Failed to return container to pool:`, err)
          );
        }

        resolve({ stdout, stderr, exitCode });
      });
    } catch (error: any) {
      // Cleanup on error
      if (tempDir) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) { /* ignore */ }
      }
      
      // Clean up network if it was created but execution failed
      await deleteSessionNetwork(sessionId).catch(cleanupErr =>
        console.error(`[API] Failed to cleanup network after error:`, cleanupErr)
      );
      
      resolve({ stdout: '', stderr: `System Error: ${error.message}`, exitCode: 1 });
    }
  });
}

// Start Server
if (require.main === module) {
  // Global error handlers to prevent silent exits
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  // Pre-flight checks
  async function preflightChecks(): Promise<void> {
    console.log('[Preflight] Running Docker environment checks...');
    
    try {
      // Check if Docker daemon is running
      await execAsync('docker version', { timeout: 5000 });
      console.log('[Preflight] ✓ Docker daemon is running');
    } catch (error) {
      console.error('[Preflight] ✗ Docker daemon is not running or not accessible');
      console.error('[Preflight]   Please ensure Docker is installed and running');
      process.exit(1);
    }

    // Check if required runtime images exist
    const requiredImages = [
      'python-runtime',
      'javascript-runtime',
      'java-runtime',
      'cpp-runtime',
      'mysql-runtime'
    ];

    for (const imageName of requiredImages) {
      try {
        await execAsync(`docker image inspect ${imageName}`, { timeout: 5000 });
        console.log(`[Preflight] ✓ ${imageName} image found`);
      } catch (error) {
        console.error(`[Preflight] ✗ ${imageName} image not found`);
        console.error(`[Preflight]   Run: docker build -t ${imageName} runtimes/${imageName.replace('-runtime', '')}/`);
      }
    }

    console.log('[Preflight] Pre-flight checks complete');
  }

  // Session pool uses on-demand containers - no initialization needed
  console.log('[Server] Starting with session-based container pool (on-demand + TTL)');
  
  preflightChecks().then(async () => {
    // Clean up any orphaned networks from previous runs on startup
    console.log('[Server] Cleaning up orphaned networks from previous runs...');
    await cleanupOrphanedNetworks(0).catch(err =>
      console.error('[Startup] Failed to cleanup orphaned networks:', err)
    );
    
    const server = httpServer.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Network access: http://<your-ip-address>:${PORT}`);
    });

    server.on('error', (err) => {
      console.error('Server failed to start:', err);
      process.exit(1);
    });

    // Initialize cleanup worker for non-blocking cleanup
    const cleanupWorker = getCleanupWorker();
    
    // Adaptive cleanup intervals based on load
    let containerCleanupInterval = config.sessionContainers.cleanupInterval; // Default 30s
    let networkCleanupInterval = 120000; // Default 2 minutes
    
    // Container cleanup - runs asynchronously without blocking
    const performContainerCleanup = async () => {
      // Run cleanup in background without blocking
      setImmediate(async () => {
        try {
          await sessionPool.cleanupExpiredContainers();
          
          // Adapt cleanup interval based on metrics
          const metrics = sessionPool.getMetrics();
          const sessionCount = sessionPool.getSessionCount();
          
          // If we're under load (many sessions or errors), clean up more frequently
          if (sessionCount > 50 || metrics.cleanupErrors > 5) {
            containerCleanupInterval = Math.max(15000, containerCleanupInterval * 0.8); // Speed up, min 15s
            console.log(`[Cleanup] High load detected (${sessionCount} sessions), reducing container cleanup interval to ${containerCleanupInterval / 1000}s`);
          } else if (sessionCount < 10 && metrics.cleanupErrors === 0) {
            containerCleanupInterval = Math.min(60000, containerCleanupInterval * 1.1); // Slow down, max 60s
          }
        } catch (error) {
          console.error('[Cleanup] Container cleanup error:', error);
        }
      });
    };

    // Network cleanup - runs asynchronously without blocking
    const performNetworkCleanup = async () => {
      // Run cleanup in background without blocking
      setImmediate(async () => {
        try {
          const networkMetrics = getNetworkMetrics();
          const stats = await getNetworkStats().catch(() => ({ empty: 0, total: 0, withContainers: 0 }));
          
          // Calculate adaptive max age based on orphaned network count
          let maxAge = 60000; // Default 1 minute
          if (stats.empty > 50) {
            maxAge = 0; // Emergency: Clean all orphaned networks immediately
            console.warn(`[Cleanup] Emergency network cleanup triggered (${stats.empty} orphaned networks)`);
          } else if (stats.empty > 20) {
            maxAge = 30000; // Aggressive: 30 seconds
            console.warn(`[Cleanup] Aggressive network cleanup (${stats.empty} orphaned networks)`);
          }
          
          await cleanupOrphanedNetworks(maxAge).catch(err => 
            console.error('[Cleanup Job] Orphaned networks cleanup failed:', err)
          );
          
          // Adapt network cleanup interval based on metrics
          if (stats.empty > 20 || networkMetrics.cleanupErrors > 5) {
            networkCleanupInterval = Math.max(30000, networkCleanupInterval * 0.7); // Speed up, min 30s
            console.log(`[Cleanup] High orphaned networks (${stats.empty}), reducing network cleanup interval to ${networkCleanupInterval / 1000}s`);
          } else if (stats.empty < 5 && networkMetrics.cleanupErrors === 0) {
            networkCleanupInterval = Math.min(300000, networkCleanupInterval * 1.2); // Slow down, max 5 minutes
          }
        } catch (error) {
          console.error('[Cleanup] Network cleanup error:', error);
        }
      });
    };

    // Start periodic cleanup using setInterval (non-blocking with setImmediate)
    const ttlCleanupTimer = setInterval(performContainerCleanup, containerCleanupInterval);
    const networkCleanupTimer = setInterval(performNetworkCleanup, networkCleanupInterval);

    // Log network statistics every 5 minutes for monitoring
    const networkStatsInterval = setInterval(async () => {
      try {
        const stats = await getNetworkStats();
        const poolMetrics = sessionPool.getMetrics();
        const networkMetrics = getNetworkMetrics();
        
        console.log(`[Network Stats] Total: ${stats.total}, Active: ${stats.withContainers}, Unused: ${stats.empty}`);
        console.log(`[Container Stats] Created: ${poolMetrics.containersCreated}, Reused: ${poolMetrics.containersReused}, Deleted: ${poolMetrics.containersDeleted}, Errors: ${poolMetrics.cleanupErrors}`);
        console.log(`[Network Metrics] Created: ${networkMetrics.networksCreated}, Deleted: ${networkMetrics.networksDeleted}, Escalation: ${networkMetrics.escalationLevel}, Errors: ${networkMetrics.cleanupErrors}`);
      } catch (err) {
        console.error('[Stats Job] Failed to get network stats:', err);
      }
    }, 300000);

    // Handle graceful shutdown
    const gracefulShutdown = async () => {
      console.log('\nShutting down server...');
      clearInterval(ttlCleanupTimer);
      clearInterval(networkCleanupTimer);
      clearInterval(networkStatsInterval);
      
      // Shutdown cleanup worker
      await shutdownCleanupWorker();
      
      await sessionPool.cleanupAll();
      await cleanupOrphanedNetworks(0); // Clean up all networks on shutdown
      server.close(() => {
        console.log('Server closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
  }).catch((error) => {
    console.error('[Server] Startup failed:', error);
    process.exit(1);
  });
}

export default app;
