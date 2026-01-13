import express from 'express';
import cors from 'cors';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { sessionPool } from './pool';
import { config } from './config';
import { getOrCreateSessionNetwork, deleteSessionNetwork, getNetworkName, cleanupOrphanedNetworks, getNetworkStats } from './networkManager';
import { kernelManager } from './kernelManager';

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
    try {
      console.log(`[Execution] Creating container for session ${socket.id.substring(0, 8)}, language ${language}`);
      const networkName = await getOrCreateSessionNetwork(socket.id);
      console.log(`[Execution] Network ready: ${networkName}`);
      containerId = await sessionPool.getOrCreateContainer(language, socket.id, networkName);
      console.log(`[Execution] Container ready: ${containerId.substring(0, 12)}`);
    } catch (e: any) {
      console.error(`[Execution] Failed to acquire container:`, e);
      socket.emit('output', { sessionId, type: 'stderr', data: `System Error: Failed to acquire container - ${e.message}\n` });
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
    exec(cpCommand, { timeout: config.docker.commandTimeout }, (cpError) => {
      if (cpError) {
        console.error(`[Execution] Failed to copy files:`, cpError);
        cleanup().catch(e => console.error('[Cleanup] Error:', e));
        socket.emit('output', { sessionId, type: 'stderr', data: `System Error (Copy): ${cpError.message}\n` });
        socket.emit('exit', { sessionId, code: 1 });
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
      });

      currentProcess.on('error', (err: any) => {
        console.error(`[Execution] Process error:`, err);
        socket.emit('output', { sessionId, type: 'stderr', data: `Process Error: ${err.message}\n` });
        cleanup().catch(e => console.error('[Cleanup] Error:', e));
      });
    });
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
  res.json({ status: 'ok', version: '1.0.0' });
});

// Network monitoring endpoint
app.get('/api/network-stats', async (req, res) => {
  try {
    const stats = await getNetworkStats();
    res.json({
      status: 'ok',
      networks: stats,
      timestamp: new Date().toISOString()
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
    const result = await executeWithSessionContainer(language, files, sessionId);
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

    try {
      // Always use session container with networking
      const networkName = await getOrCreateSessionNetwork(sessionId);
      containerId = await sessionPool.getOrCreateContainer(language, sessionId, networkName);

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
      'node-runtime',
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
  
  preflightChecks().then(() => {
    const server = httpServer.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Network access: http://<your-ip-address>:${PORT}`);
    });

    server.on('error', (err) => {
      console.error('Server failed to start:', err);
      process.exit(1);
    });

    // Start TTL cleanup monitor
    const ttlCleanupInterval = setInterval(async () => {
      await sessionPool.cleanupExpiredContainers();
    }, config.sessionContainers.cleanupInterval);

    // Cleanup orphaned networks every 2 minutes
    const networkCleanupInterval = setInterval(async () => {
      await cleanupOrphanedNetworks(300000).catch(err => 
        console.error('[Cleanup Job] Orphaned networks cleanup failed:', err)
      );
    }, 120000);

    // Log network statistics every 5 minutes for monitoring
    const networkStatsInterval = setInterval(async () => {
      try {
        const stats = await getNetworkStats();
        console.log(`[Network Stats] Total: ${stats.total}, Active: ${stats.withContainers}, Unused: ${stats.empty}`);
      } catch (err) {
        console.error('[Stats Job] Failed to get network stats:', err);
      }
    }, 300000);

    // Handle graceful shutdown
    const gracefulShutdown = async () => {
      console.log('\nShutting down server...');
      clearInterval(ttlCleanupInterval);
      clearInterval(networkCleanupInterval);
      clearInterval(networkStatsInterval);
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
