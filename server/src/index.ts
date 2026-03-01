// Load environment variables FIRST before any other imports
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { exec, spawn, execSync } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { sessionPool } from './pool';
import { config, validateConfig } from './config';
import { getOrCreateSessionNetwork, deleteSessionNetwork, getNetworkName, cleanupOrphanedNetworks, aggressiveBulkNetworkCleanup, getNetworkStats, getSubnetStats, getNetworkMetrics } from './networkManager';
import { kernelManager } from './kernelManager';
import { putFiles, execInteractive, execInContainer, pingDaemon, imageExists, type FileEntry } from './dockerClient';
import { pipelineMetrics, createStopwatch, type PipelineTimings } from './pipelineMetrics';
import { logger } from './logger';

import { adminMetrics } from './adminMetrics';
import adminRoutes from './adminRoutes';
import { initDB, getStudentByRegNo } from './db';
import { startLoadTest, getTestRunner, stopTest } from './testRunner';
const { getReport } = require('../tests/utils/report-manager');

// Re-read environment variables into config after dotenv load
(config.docker as any).memory = process.env.DOCKER_MEMORY || '512m';
(config.docker as any).memorySQL = process.env.DOCKER_MEMORY_SQL || '1024m';
(config.docker as any).cpus = process.env.DOCKER_CPUS || '0.5';
(config.docker as any).cpusNotebook = process.env.DOCKER_CPUS_NOTEBOOK || '1';
(config.docker as any).timeout = process.env.DOCKER_TIMEOUT || '30s';

logger.info('Server', `Loaded Docker config: memory=${config.docker.memory}, memorySQL=${config.docker.memorySQL}, cpus=${config.docker.cpus}`);

// Validate configuration at startup
validateConfig();

// Run aggressive cleanup on startup
try {
  logger.info('Server', 'Running startup cleanup...');
  const cleanupScript = path.resolve(__dirname, '../../cleanup.sh');
  if (fs.existsSync(cleanupScript)) {
    execSync(`${cleanupScript} --silent`, { stdio: 'inherit' });
    logger.info('Server', 'Startup cleanup completed');
  } else {
    logger.warn('Server', `Cleanup script not found at: ${cleanupScript}`);
  }

  // Clean orphaned temp directories from previous runs
  const tempBase = path.resolve(__dirname, '..', 'temp');
  if (fs.existsSync(tempBase)) {
    const orphaned = fs.readdirSync(tempBase).filter((d) => d.startsWith('runner-'));
    if (orphaned.length > 0) {
      logger.info('Server', `Cleaning ${orphaned.length} orphaned temp directories`);
      for (const dir of orphaned) {
        try {
          fs.rmSync(path.join(tempBase, dir), { recursive: true, force: true });
        } catch { /* ignore */ }
      }
    }
  }
} catch (error) {
  logger.error('Server', `Startup cleanup failed: ${error}`);
}

// Initialize PostgreSQL Database
initDB();

const execAsync = promisify(exec);

const app = express();
const httpServer = createServer(app);

// --- Security: CORS Origin Restriction ---
// For local/LAN deployments: automatically allows the machine's own IP addresses
// so other users on the network can access via http://<server-ip>:<port>.
// Can be overridden with CORS_ORIGINS env var (comma-separated).
import { networkInterfaces } from 'os';

function buildAllowedOrigins(): string[] {
  // Start with explicit overrides if set
  if (process.env.CORS_ORIGINS) {
    return process.env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
  }

  // Auto-detect: localhost + all machine IPs, on common dev ports
  const origins = new Set<string>();
  const ports = [String(config.server.port), '5173', '3000'];
  const hosts = ['localhost', '127.0.0.1'];

  // Discover all non-internal IPv4 addresses on this machine
  const ifaces = networkInterfaces();
  for (const ifaceList of Object.values(ifaces)) {
    if (!ifaceList) continue;
    for (const iface of ifaceList) {
      if (iface.family === 'IPv4') {
        hosts.push(iface.address);
      }
    }
  }

  for (const host of hosts) {
    for (const port of ports) {
      origins.add(`http://${host}:${port}`);
    }
  }

  return Array.from(origins);
}

const allowedOrigins = buildAllowedOrigins();
logger.info('Server', `Allowed CORS origins: ${allowedOrigins.join(', ')}`);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

const PORT = config.server.port;

// Middleware
app.use(compression());  // Gzip/deflate compression for all responses
app.use(helmet());  // Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '10mb' }));

// --- Rate Limiting: /api/run endpoint ---
const apiRunLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_API_RUN || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many execution requests. Please wait and try again.' },
  skip: (req) => req.headers['x-load-test'] === 'true',
});
app.use('/api/run', apiRunLimiter);

// Student Verification API Endpoint
app.post('/api/verify-student', async (req, res) => {
  const { regNo } = req.body;
  if (!regNo) {
    return res.status(400).json({ error: 'Register Number is required' });
  }

  try {
    const student = await getStudentByRegNo(regNo);
    if (!student) {
      return res.status(404).json({ error: 'Student not found. Please check your Register Number.' });
    }
    return res.json(student);
  } catch (error) {
    logger.error('Database', `Error verifying student: ${error}`);
    return res.status(500).json({ error: 'Internal server error while verifying student' });
  }
});

// Admin routes - protected by key authentication
app.use('/admin', adminRoutes);

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

// --- File Validation & Sanitization ---
// Server-side validation to prevent shell injection, path traversal, and resource abuse.
// Client-side validation exists but is trivially bypassed, so we enforce here.

const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9._\-\/]+$/;
const DANGEROUS_PATH_PATTERNS = ['..', '\0'];

function validateAndSanitizeFiles(files: File[]): { valid: boolean; error?: string } {
  // Check file count
  if (files.length > config.files.maxFilesPerSession) {
    return { valid: false, error: `Too many files: ${files.length} (max: ${config.files.maxFilesPerSession})` };
  }

  let totalSize = 0;

  for (const file of files) {
    // Check for dangerous path patterns
    for (const pattern of DANGEROUS_PATH_PATTERNS) {
      if (file.path.includes(pattern) || file.name.includes(pattern)) {
        return { valid: false, error: `Invalid file path: contains forbidden pattern '${pattern}'` };
      }
    }

    // Check for absolute paths
    if (file.path.startsWith('/') || file.path.startsWith('\\')) {
      return { valid: false, error: `Invalid file path: absolute paths are not allowed` };
    }

    // Validate filename against allowlist regex
    if (!SAFE_FILENAME_REGEX.test(file.path)) {
      return { valid: false, error: `Invalid file path '${file.path}': contains disallowed characters` };
    }
    if (!SAFE_FILENAME_REGEX.test(file.name)) {
      return { valid: false, error: `Invalid file name '${file.name}': contains disallowed characters` };
    }

    // Check individual file size
    const fileSize = Buffer.byteLength(file.content || '', 'utf8');
    if (fileSize > config.files.maxFileSize) {
      return { valid: false, error: `File '${file.name}' exceeds maximum size (${fileSize} bytes, max: ${config.files.maxFileSize})` };
    }

    totalSize += fileSize;
  }

  // Check total payload size (maxFileSize * maxFiles as upper bound)
  const maxTotalSize = config.files.maxFileSize;
  if (totalSize > maxTotalSize) {
    return { valid: false, error: `Total file size exceeds maximum (${totalSize} bytes, max: ${maxTotalSize})` };
  }

  return { valid: true };
}

/**
 * Shell-escape a filename for safe use in shell commands.
 * Uses single quotes which prevent all shell interpretation.
 */
function shellEscape(arg: string): string {
  // Replace single quotes with '\'' (end quote, escaped quote, start quote)
  return "'" + arg.replace(/'/g, "'\\''") + "'";
}

function getRunCommand(language: string, entryFile: string): string {
  switch (language) {
    case 'python': return `python -u ${shellEscape(entryFile)}`; // -u for unbuffered output
    case 'javascript': return `node ${shellEscape(entryFile)}`;
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
      // -XX:TieredStopAtLevel=1  → only C1 compiler (fast startup, skip C2 optimiser)
      // -XX:+UseSerialGC         → minimal GC overhead for short-lived processes
      // -Xshare:auto             → use CDS archive baked into the image
      // -Xms8m -Xmx256m         → small heap to reduce GC pauses and startup cost
      const jvmFlags = '-XX:TieredStopAtLevel=1 -XX:+UseSerialGC -Xshare:auto -Xms8m -Xmx256m';
      return `javac -d . $(find . -name "*.java") && java ${jvmFlags} ${shellEscape(className)}`;
    }
    case 'sql': {
      return `PGPASSWORD=root psql -U root -d devdb -f ${shellEscape(entryFile)}`;
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

    // Binary search for correct insertion index (sorted by priority desc, then timestamp asc)
    let lo = 0, hi = this.queue.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const cmp = this.queue[mid];
      if (cmp.priority > queuedTask.priority ||
        (cmp.priority === queuedTask.priority && cmp.timestamp <= queuedTask.timestamp)) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    this.queue.splice(lo, 0, queuedTask);

    this.processQueue();
  }

  private processQueue(): void {
    // Remove expired tasks from queue
    const now = Date.now();
    const initialQueueLength = this.queue.length;
    this.queue = this.queue.filter(qt => {
      if (now - qt.timestamp > this.queueTimeout) {
        logger.warn('ExecutionQueue', `Task timed out after ${this.queueTimeout}ms in queue`);
        this.failedTasks++;
        return false;
      }
      return true;
    });
    if (this.queue.length < initialQueueLength) {
      logger.info('ExecutionQueue', `Removed ${initialQueueLength - this.queue.length} expired tasks from queue`);
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
          logger.error('ExecutionQueue', `Task error: ${error?.message || error}`);
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

const executionQueue = new ExecutionQueue(
  config.sessionContainers.maxConcurrentSessions,
  config.executionQueue.maxQueueSize,
  config.executionQueue.queueTimeout
);

// Export for admin routes
export { executionQueue };

// --- Kernel Manager Callbacks ---
// Set up kernel output and status streaming to the owning socket only
kernelManager.onOutput((kernelId, socketId, output) => {
  logger.debug('Kernel', `Output: kernelId=${kernelId}, cellId=${output.cellId}, type=${output.type}`);
  // Send only to the owning socket for privacy
  io.to(socketId).emit('kernel:output', { kernelId, ...output });
});

kernelManager.onStatusChange((kernelId, socketId, status) => {
  logger.debug('Kernel', `Status: kernelId=${kernelId}, status=${status}`);
  io.to(socketId).emit('kernel:status', { kernelId, status });
});

kernelManager.onCellComplete((kernelId, socketId, cellId) => {
  logger.debug('Kernel', `Cell complete: kernelId=${kernelId}, cellId=${cellId}`);
  io.to(socketId).emit('kernel:cell_complete', { kernelId, cellId });
});

// --- WebSocket Handling ---
io.on('connection', (socket) => {
  logger.info('Client', `Connected: ${socket.id}`);

  // Track client connection
  adminMetrics.trackClientConnected(socket.id);

  socket.on('student:identity', (data: { regNo: string, name: string }) => {
    adminMetrics.trackClientIdentity(socket.id, data.regNo, data.name);
    logger.info('Client', `Client ${socket.id} identified as ${data.name} (${data.regNo})`);
  });

  let currentProcess: any = null;
  let containerId: string | null = null;
  let currentLanguage: string | null = null;
  let currentSessionId: string | null = null;
  let manuallyStopped: boolean = false;

  // --- Per-socket rate limiting for code execution ---
  const socketRateLimit = { count: 0, windowStart: Date.now() };
  const SOCKET_RATE_WINDOW = 10_000; // 10 seconds
  const SOCKET_RATE_MAX = parseInt(process.env.RATE_LIMIT_SOCKET_RUN || '10', 10);

  function checkSocketRateLimit(): boolean {
    const now = Date.now();
    if (now - socketRateLimit.windowStart > SOCKET_RATE_WINDOW) {
      socketRateLimit.count = 0;
      socketRateLimit.windowStart = now;
    }
    socketRateLimit.count++;
    return socketRateLimit.count <= SOCKET_RATE_MAX;
  }

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

    // Per-socket rate limiting
    if (!checkSocketRateLimit()) {
      socket.emit('output', { sessionId, type: 'stderr', data: 'Rate limit exceeded. Please wait before running more code.\n' });
      socket.emit('exit', { sessionId, code: 1 });
      return;
    }

    // Enqueue the execution task with configurable concurrency
    // Priority: WebSocket interactive requests get priority 2 (higher than API)
    executionQueue.enqueue(async () => {
      currentLanguage = language;
      currentSessionId = sessionId;
      manuallyStopped = false; // Reset flag for new execution
      const startTime = Date.now(); // Track execution start time
      const executionId = `ws-${sessionId}-${startTime}`;

      // Track execution start
      adminMetrics.trackExecutionStarted(executionId);

      // Validate and sanitize files before proceeding
      const validation = validateAndSanitizeFiles(files);
      if (!validation.valid) {
        socket.emit('output', { sessionId, type: 'stderr', data: `Validation Error: ${validation.error}\n` });
        socket.emit('exit', { sessionId, code: 1 });
        return;
      }

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
      let containerReused = false;
      const sw = createStopwatch();

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          logger.info('Execution', `Creating container for session ${socket.id.substring(0, 8)}, language ${language} (attempt ${attempt}/${maxRetries})`);
          const networkName = await getOrCreateSessionNetwork(socket.id);
          const networkMs = sw.lap();
          logger.info('Execution', `Network ready: ${networkName} (${networkMs}ms)`);

          // Check if container will be reused (before getOrCreate changes the state)
          const poolStats = sessionPool.getMetrics();
          containerId = await sessionPool.getOrCreateContainer(language, socket.id, networkName);
          const containerMs = sw.lap();
          containerReused = poolStats.containersReused < sessionPool.getMetrics().containersReused;
          logger.info('Execution', `Container ready: ${containerId.substring(0, 12)} (${containerMs}ms, reused=${containerReused})`);
          break; // Success - exit retry loop
        } catch (e: any) {
          lastError = e;
          logger.error('Execution', `Failed to acquire container (attempt ${attempt}/${maxRetries}): ${e.message}`);

          // Clean up the failed network before retrying
          await deleteSessionNetwork(socket.id).catch(cleanupErr =>
            logger.error('Execution', `Failed to cleanup network after error: ${cleanupErr}`)
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

      // 2. Stream files directly into container (zero host I/O)
      try {
        // For C/C++, filter files based on entry file extension to avoid conflicts
        let filesToWrite = files;
        if (language === 'cpp' && execFile) {
          const entryExt = execFile.path.split('.').pop()?.toLowerCase();
          if (entryExt === 'c') {
            filesToWrite = files.filter(f => {
              const ext = f.path.split('.').pop()?.toLowerCase();
              return ext === 'c' || ext === 'h';
            });
          } else {
            filesToWrite = files.filter(f => {
              const ext = f.path.split('.').pop()?.toLowerCase();
              return ext === 'cpp' || ext === 'cc' || ext === 'cxx' || ext === 'c++' || ext === 'hpp' || ext === 'h';
            });
          }
        }

        const fileEntries: FileEntry[] = filesToWrite.map(f => ({
          path: f.path,
          content: f.content,
        }));

        await putFiles(containerId, fileEntries);
        const fileTransferMs = sw.lap();
        logger.info('Execution', `Files streamed to container (${fileTransferMs}ms, ${fileEntries.length} files)`);
      } catch (err: any) {
        cleanup().catch(e => logger.error('Cleanup', `Error: ${e}`));
        socket.emit('output', { sessionId, type: 'stderr', data: `System Error: ${err.message}\n` });
        socket.emit('exit', { sessionId, code: 1 });
        return;
      }

      // 3. Execute via Docker SDK interactive exec (streaming output)
      try {
        const execSession = await execInteractive(containerId, command);
        currentProcess = execSession;

        execSession.stdout.on('data', (chunk: Buffer) => {
          outputBuffer.push({ sessionId, type: 'stdout', data: chunk.toString() });
          scheduleFlush();
        });

        execSession.stderr.on('data', (chunk: Buffer) => {
          outputBuffer.push({ sessionId, type: 'stderr', data: chunk.toString() });
          scheduleFlush();
        });

        // Wait for the exec to finish
        await new Promise<void>((resolve) => {
          let ended = false;
          const onEnd = async () => {
            if (ended) return;
            ended = true;

            // Flush any remaining buffered output before exit
            if (flushBufferTimer) {
              clearTimeout(flushBufferTimer);
              flushOutputBuffer();
            }

            const executionMs = sw.lap();
            const executionTime = sw.total();

            // Get exit code
            let code = 0;
            try {
              code = await execSession.getExitCode();
            } catch {
              code = -1;
            }

            // Track execution completion
            adminMetrics.trackExecutionEnded(executionId);
            adminMetrics.trackRequest({
              type: 'websocket',
              language: currentLanguage!,
              executionTime,
              success: code === 0,
              sessionId,
              clientId: socket.id,
            });

            // Record pipeline metrics
            pipelineMetrics.record({
              queueMs: 0, // Would need queue-level timing
              networkMs: 0,
              containerMs: 0,
              fileTransferMs: 0,
              executionMs,
              cleanupMs: 0,
              totalMs: executionTime,
              containerReused,
              language,
            });

            // Only emit exit if not manually stopped
            if (!manuallyStopped) {
              socket.emit('exit', { sessionId, code, executionTime });
            }
            cleanup().catch(e => logger.error('Cleanup', `Error: ${e}`));
            resolve();
          };

          execSession.stdout.on('end', onEnd);
          execSession.stderr.on('end', () => {
            // stderr may end before stdout; let stdout's end drive completion
          });

          // Fallback: if both streams close without 'end', use a timeout
          // Parse timeout properly — strip non-numeric suffix (e.g. '30s' -> 30)
          const timeoutSec = parseInt(config.docker.timeout.replace(/[^0-9]/g, ''), 10);
          const timeoutMs = (timeoutSec > 0 ? timeoutSec : 30) * 1000;
          setTimeout(() => {
            if (!ended) onEnd();
          }, timeoutMs);
        });
      } catch (err: any) {
        logger.error('Execution', `Process error: ${err.message}`);
        socket.emit('output', { sessionId, type: 'stderr', data: `Process Error: ${err.message}\n` });
        socket.emit('exit', { sessionId, code: 1 });
        cleanup().catch(e => logger.error('Cleanup', `Error: ${e}`));
      }
    }, 2, language); // Priority 2 for interactive WebSocket requests
  });

  socket.on('input', (data: string) => {
    if (currentProcess && currentProcess.stdin) {
      try {
        currentProcess.stdin.write(data);
      } catch {
        // Stream may have closed
      }
    }
  });

  socket.on('stop', (data: { sessionId: string }) => {
    const { sessionId } = data;
    if (currentProcess && currentSessionId === sessionId) {
      manuallyStopped = true;
      // Kill via SDK's stream destroy (equivalent to SIGTERM)
      if (typeof currentProcess.kill === 'function') {
        currentProcess.kill();
      } else if (currentProcess.kill) {
        currentProcess.kill('SIGTERM');
      }
      socket.emit('output', { sessionId, type: 'system', data: '[Process terminated]\n' });
      socket.emit('exit', { sessionId, code: -1 });
      cleanup().catch(e => logger.error('Cleanup', `Error: ${e}`));
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

  // --- Kernel Ownership Validation ---
  // All kernel operations (except start) verify that the kernel belongs to this socket.
  // This prevents cross-session kernel hijacking.

  socket.on('kernel:execute', async (data: { kernelId: string; cellId: string; code: string }) => {
    const { kernelId, cellId, code } = data;
    if (!kernelManager.verifyOwnership(kernelId, socket.id)) {
      socket.emit('kernel:error', { kernelId, cellId, error: 'Unauthorized: kernel does not belong to this session' });
      return;
    }
    try {
      const executionCount = await kernelManager.executeCell(kernelId, cellId, code);
      socket.emit('kernel:execution_started', { kernelId, cellId, executionCount });
    } catch (error: any) {
      socket.emit('kernel:error', { kernelId, cellId, error: error.message });
    }
  });

  socket.on('kernel:interrupt', async (data: { kernelId: string }) => {
    const { kernelId } = data;
    if (!kernelManager.verifyOwnership(kernelId, socket.id)) {
      socket.emit('kernel:error', { kernelId, error: 'Unauthorized: kernel does not belong to this session' });
      return;
    }
    try {
      await kernelManager.interruptKernel(kernelId);
      socket.emit('kernel:interrupted', { kernelId });
    } catch (error: any) {
      socket.emit('kernel:error', { kernelId, error: error.message });
    }
  });

  socket.on('kernel:restart', async (data: { kernelId: string }) => {
    const { kernelId } = data;
    if (!kernelManager.verifyOwnership(kernelId, socket.id)) {
      socket.emit('kernel:error', { kernelId, error: 'Unauthorized: kernel does not belong to this session' });
      return;
    }
    try {
      await kernelManager.restartKernel(kernelId);
      socket.emit('kernel:restarted', { kernelId });
    } catch (error: any) {
      socket.emit('kernel:error', { kernelId, error: error.message });
    }
  });

  socket.on('kernel:shutdown', async (data: { kernelId: string }) => {
    const { kernelId } = data;
    if (!kernelManager.verifyOwnership(kernelId, socket.id)) {
      socket.emit('kernel:error', { kernelId, error: 'Unauthorized: kernel does not belong to this session' });
      return;
    }
    try {
      await kernelManager.shutdownKernel(kernelId);
      socket.emit('kernel:shutdown_complete', { kernelId });
    } catch (error: any) {
      socket.emit('kernel:error', { kernelId, error: error.message });
    }
  });

  // Load test runner handlers
  let activeLoadTestId: string | null = null;

  socket.on('loadtest:start', async (data: { intensity: string; languages?: string[] }) => {
    logger.info('WebSocket', `Received loadtest:start event: ${JSON.stringify(data)}`);
    try {
      const testId = await startLoadTest(data.intensity, data.languages);
      const testRunner = getTestRunner(testId);

      if (!testRunner) {
        logger.error('WebSocket', 'Failed to create test runner');
        socket.emit('loadtest:error', { error: 'Failed to create test runner' });
        return;
      }

      activeLoadTestId = testId;
      logger.info('WebSocket', `Test runner created: ${testRunner.id}`);

      // Send initial acknowledgment
      socket.emit('loadtest:started', {
        testId: testRunner.id,
        intensity: testRunner.intensity,
        startTime: testRunner.startTime
      });

      // Listen for progress events
      testRunner.on('progress', (progress) => {
        socket.emit('loadtest:progress', {
          testId: testRunner.id,
          ...progress
        });
      });

      // Listen for completion
      testRunner.on('complete', async (result) => {
        activeLoadTestId = null;
        // Load the report to get the summary
        let summary = null;
        if (result.reportId) {
          const report = getReport(result.reportId);
          summary = report?.summary || null;
        }

        socket.emit('loadtest:complete', {
          testId: testRunner.id,
          reportId: result.reportId,
          duration: Date.now() - testRunner.startTime,
          summary
        });
      });

      // Listen for errors
      testRunner.on('error', (error) => {
        activeLoadTestId = null;
        socket.emit('loadtest:error', {
          testId: testRunner.id,
          error: error.message
        });
      });

    } catch (error: any) {
      socket.emit('loadtest:error', { error: error.message });
    }
  });

  socket.on('loadtest:stop', (data: { testId: string }) => {
    logger.info('WebSocket', `Received loadtest:stop for test: ${data.testId}`);
    const stopped = stopTest(data.testId);
    if (stopped) {
      activeLoadTestId = null;
      socket.emit('loadtest:error', { testId: data.testId, error: 'Test cancelled by user' });
    }
  });

  socket.on('disconnect', async () => {
    logger.info('Client', `Disconnected: ${socket.id}`);

    // Track client disconnection
    adminMetrics.trackClientDisconnected(socket.id);

    // Stop any running load test for this socket
    if (activeLoadTestId) {
      stopTest(activeLoadTestId);
      activeLoadTestId = null;
    }

    if (flushBufferTimer) {
      clearTimeout(flushBufferTimer);
    }
    if (currentProcess) {
      currentProcess.kill();
    }
    await cleanup().catch(e => logger.error('Cleanup', `Error: ${e}`));

    // Clean up all session containers for this socket
    await sessionPool.cleanupSession(socket.id);

    // Clean up all kernels for this socket
    await kernelManager.shutdownSocketKernels(socket.id);

    // Clean up session network
    await deleteSessionNetwork(socket.id).catch(err =>
      logger.error('Disconnect', `Failed to cleanup session network: ${err}`)
    );
  });

  async function cleanup() {
    if (containerId) {
      // Return container to pool (cleaned and TTL refreshed)
      await sessionPool.returnContainer(containerId, socket.id).catch(err =>
        logger.error('Cleanup', `Failed to return container to pool: ${err}`)
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

// NOTE: Legacy endpoints (/api/network-stats, /api/cleanup-stats, /api/queue-stats) have been
// removed. Use the authenticated /admin/stats endpoint instead: /admin/stats with X-Admin-Key header.

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

  // Validate and sanitize files
  const validation = validateAndSanitizeFiles(files);
  if (!validation.valid) {
    res.status(400).json({ error: `Validation Error: ${validation.error}` });
    return;
  }

  const startTime = Date.now();
  const sessionId = `api-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const clientId = req.ip || req.socket.remoteAddress || 'unknown';
  const executionId = `api-${sessionId}`;

  // Track execution start
  adminMetrics.trackExecutionStarted(executionId);

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

    // Track execution completion
    adminMetrics.trackExecutionEnded(executionId);
    adminMetrics.trackRequest({
      type: 'api',
      language,
      executionTime,
      success: result.exitCode === 0,
      sessionId,
      clientId,
    });

    res.json({
      ...result,
      executionTime
    });
  } catch (error: any) {
    const executionTime = Date.now() - startTime;

    // Track failed execution
    adminMetrics.trackExecutionEnded(executionId);
    adminMetrics.trackRequest({
      type: 'api',
      language,
      executionTime,
      success: false,
      sessionId,
      clientId,
    });

    res.status(500).json({
      error: `Execution failed: ${error.message}`,
      executionTime
    });
  }
});

/**
 * Execute code with session container (for API endpoint).
 * Uses Docker SDK streaming: zero host filesystem I/O.
 */
async function executeWithSessionContainer(
  language: string,
  files: File[],
  sessionId: string
): Promise<RunResult> {
  const runtimeConfig = config.runtimes[language as keyof typeof config.runtimes];
  if (!runtimeConfig) {
    return { stdout: '', stderr: `Error: Unsupported language '${language}'`, exitCode: 1 };
  }

  // Find entry file
  const entryFile = files.find(f => f.toBeExec);
  if (!entryFile && language !== 'cpp' && language !== 'sql') {
    return { stdout: '', stderr: 'Error: No entry file marked for execution.', exitCode: 1 };
  }

  let execFile = entryFile;
  if (!execFile && language === 'sql') {
    execFile = files.find(f => f.name.endsWith('.sql'));
    if (!execFile) {
      return { stdout: '', stderr: 'Error: No SQL file found.', exitCode: 1 };
    }
  }

  let command = '';
  try {
    command = getRunCommand(language, execFile ? execFile.path : '');
  } catch (e: any) {
    return { stdout: '', stderr: e.message, exitCode: 1 };
  }

  let containerId: string | null = null;

  // Retry logic for network/container acquisition
  const maxRetries = 2;
  let networkCreated = false;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const networkName = await getOrCreateSessionNetwork(sessionId);
      networkCreated = true;
      containerId = await sessionPool.getOrCreateContainer(language, sessionId, networkName);
      break;
    } catch (error: any) {
      logger.error('API', `Failed to acquire container (attempt ${attempt}/${maxRetries}): ${error.message}`);

      if (networkCreated) {
        await deleteSessionNetwork(sessionId).catch(cleanupErr =>
          logger.error('API', `Failed to cleanup network after error: ${cleanupErr}`)
        );
        networkCreated = false;
      }

      if (attempt === maxRetries) {
        return { stdout: '', stderr: `System Error: Failed to acquire container after ${maxRetries} attempts - ${error.message}`, exitCode: 1 };
      }

      await new Promise(r => setTimeout(r, 500));
    }
  }

  if (!containerId) {
    return { stdout: '', stderr: 'System Error: Container acquisition failed', exitCode: 1 };
  }

  try {
    // Filter files for C/C++
    let filesToWrite = files;
    if (language === 'cpp' && execFile) {
      const entryExt = execFile.path.split('.').pop()?.toLowerCase();
      if (entryExt === 'c') {
        filesToWrite = files.filter(f => {
          const ext = f.path.split('.').pop()?.toLowerCase();
          return ext === 'c' || ext === 'h';
        });
      } else {
        filesToWrite = files.filter(f => {
          const ext = f.path.split('.').pop()?.toLowerCase();
          return ext === 'cpp' || ext === 'cc' || ext === 'cxx' || ext === 'c++' || ext === 'hpp' || ext === 'h';
        });
      }
    }

    // Stream files directly into container (no temp dir)
    const fileEntries: FileEntry[] = filesToWrite.map(f => ({ path: f.path, content: f.content }));
    await putFiles(containerId, fileEntries);

    // Execute command via SDK
    const result = await execInContainer(containerId, command, { timeout: 30_000 });

    // Return container to pool
    await sessionPool.returnContainer(containerId, sessionId).catch(err =>
      logger.error('API', `Failed to return container to pool: ${err}`)
    );

    return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };
  } catch (error: any) {
    // Clean up network if execution failed
    await deleteSessionNetwork(sessionId).catch(cleanupErr =>
      logger.error('API', `Failed to cleanup network after error: ${cleanupErr}`)
    );

    return { stdout: '', stderr: `System Error: ${error.message}`, exitCode: 1 };
  }
}

// Start Server
if (require.main === module) {
  // Global error handlers to prevent silent exits
  process.on('uncaughtException', (err) => {
    logger.error('Server', `Uncaught Exception: ${err}`);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Server', `Unhandled Rejection: ${reason}`);
  });

  // Pre-flight checks
  async function preflightChecks(): Promise<void> {
    logger.info('Preflight', 'Running Docker environment checks...');

    // Check Docker daemon via SDK (no process spawn)
    const isAlive = await pingDaemon();
    if (!isAlive) {
      logger.error('Preflight', 'Docker daemon is not running or not accessible');
      logger.error('Preflight', 'Please ensure Docker is installed and running');
      process.exit(1);
    }
    logger.info('Preflight', 'Docker daemon is running');

    // Check if required runtime images exist via SDK
    const requiredImages = [
      'python-runtime',
      'javascript-runtime',
      'java-runtime',
      'cpp-runtime',
      'postgres-runtime'
    ];

    for (const imageName of requiredImages) {
      const exists = await imageExists(imageName);
      if (exists) {
        logger.info('Preflight', `${imageName} image found`);
      } else {
        logger.error('Preflight', `${imageName} image not found`);
        logger.error('Preflight', `Run: docker build -t ${imageName} runtimes/${imageName.replace('-runtime', '')}/`);
      }
    }

    logger.info('Preflight', 'Pre-flight checks complete');
  }

  // Session pool uses on-demand containers - no initialization needed
  logger.info('Server', 'Starting with session-based container pool (on-demand + TTL)');

  preflightChecks().then(async () => {
    // Clean up any orphaned networks from previous runs on startup
    logger.info('Server', 'Cleaning up orphaned networks from previous runs...');
    await cleanupOrphanedNetworks(0).catch(err =>
      logger.error('Server', `Failed to cleanup orphaned networks: ${err}`)
    );

    const server = httpServer.listen(Number(PORT), '0.0.0.0', () => {
      logger.info('Server', `Server running on http://localhost:${PORT}`);
      logger.info('Server', `Network access: http://<your-ip-address>:${PORT}`);
    });

    server.on('error', (err) => {
      logger.error('Server', `Server failed to start: ${err}`);
      process.exit(1);
    });

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
            logger.info('Cleanup', `High load detected (${sessionCount} sessions), reducing container cleanup interval to ${containerCleanupInterval / 1000}s`);
          } else if (sessionCount < 10 && metrics.cleanupErrors === 0) {
            containerCleanupInterval = Math.min(60000, containerCleanupInterval * 1.1); // Slow down, max 60s
          }
        } catch (error) {
          logger.error('Cleanup', `Container cleanup error: ${error}`);
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

          // Use aggressive bulk cleanup for very high orphan counts (>100)
          // This is based on the cleanup.sh script approach
          if (stats.empty > 100) {
            logger.warn('Cleanup', `CRITICAL: ${stats.empty} orphaned networks! Using aggressive bulk cleanup...`);
            await aggressiveBulkNetworkCleanup().catch(err =>
              logger.error('Cleanup', `Aggressive bulk cleanup failed: ${err}`)
            );
          } else {
            // Use careful cleanup for moderate counts
            let maxAge = 60000; // Default 1 minute
            if (stats.empty > 50) {
              maxAge = 0; // Emergency: Clean all orphaned networks immediately
              logger.warn('Cleanup', `Emergency network cleanup triggered (${stats.empty} orphaned networks)`);
            } else if (stats.empty > 20) {
              maxAge = 30000; // Aggressive: 30 seconds
              logger.warn('Cleanup', `Aggressive network cleanup (${stats.empty} orphaned networks)`);
            }

            await cleanupOrphanedNetworks(maxAge).catch(err =>
              logger.error('Cleanup', `Orphaned networks cleanup failed: ${err}`)
            );
          }

          // Adapt network cleanup interval based on metrics
          if (stats.empty > 20 || networkMetrics.cleanupErrors > 5) {
            networkCleanupInterval = Math.max(30000, networkCleanupInterval * 0.7); // Speed up, min 30s
            logger.info('Cleanup', `High orphaned networks (${stats.empty}), reducing network cleanup interval to ${networkCleanupInterval / 1000}s`);
          } else if (stats.empty < 5 && networkMetrics.cleanupErrors === 0) {
            networkCleanupInterval = Math.min(300000, networkCleanupInterval * 1.2); // Slow down, max 5 minutes
          }
        } catch (error) {
          logger.error('Cleanup', `Network cleanup error: ${error}`);
        }
      });
    };

    // Start periodic cleanup using setInterval (non-blocking with setImmediate)
    const ttlCleanupTimer = setInterval(performContainerCleanup, containerCleanupInterval);
    const networkCleanupTimer = setInterval(performNetworkCleanup, networkCleanupInterval);

    // Periodic server snapshots for admin dashboard (every minute)
    const snapshotInterval = setInterval(() => {
      const poolMetrics = sessionPool.getMetrics();
      const queueStats = executionQueue.getStats();

      adminMetrics.takeSnapshot(
        0, // No worker threads used
        poolMetrics.totalActiveContainers,
        queueStats.queued
      );
    }, 60000); // Every minute

    // Log network statistics every 5 minutes for monitoring
    const networkStatsInterval = setInterval(async () => {
      try {
        const stats = await getNetworkStats();
        const poolMetrics = sessionPool.getMetrics();
        const networkMetrics = getNetworkMetrics();

        logger.info('Stats', `Network: Total=${stats.total}, Active=${stats.withContainers}, Unused=${stats.empty}`);
        logger.info('Stats', `Containers: Created=${poolMetrics.containersCreated}, Reused=${poolMetrics.containersReused}, Deleted=${poolMetrics.containersDeleted}, Errors=${poolMetrics.cleanupErrors}`);
        logger.info('Stats', `Networks: Created=${networkMetrics.networksCreated}, Deleted=${networkMetrics.networksDeleted}, Escalation=${networkMetrics.escalationLevel}, Errors=${networkMetrics.cleanupErrors}`);
      } catch (err) {
        logger.error('Stats', `Failed to get network stats: ${err}`);
      }
    }, 300000);

    // Handle graceful shutdown
    let isShuttingDown = false;
    const gracefulShutdown = async () => {
      if (isShuttingDown) {
        logger.info('Shutdown', 'Force shutdown - exiting immediately');
        process.exit(1);
      }

      isShuttingDown = true;
      logger.info('Shutdown', 'Shutting down server...');

      // Set a hard timeout - exit after 5 seconds no matter what
      const shutdownTimeout = setTimeout(() => {
        logger.info('Shutdown', 'Timeout reached - forcing exit');
        process.exit(0);
      }, 5000);

      try {
        // Clear timers
        clearInterval(ttlCleanupTimer);
        clearInterval(networkCleanupTimer);
        clearInterval(networkStatsInterval);
        clearInterval(snapshotInterval);

        // Cleanup with timeout
        await Promise.race([
          sessionPool.cleanupAll(),
          new Promise(resolve => setTimeout(resolve, 3000))
        ]);

        await Promise.race([
          cleanupOrphanedNetworks(0),
          new Promise(resolve => setTimeout(resolve, 2000))
        ]);

        server.close(() => {
          clearTimeout(shutdownTimeout);
          logger.info('Shutdown', 'Server closed.');
          process.exit(0);
        });

        // If server.close doesn't fire callback, force exit after 1s
        setTimeout(() => {
          clearTimeout(shutdownTimeout);
          logger.info('Shutdown', 'Server close timeout - exiting');
          process.exit(0);
        }, 1000);

      } catch (error) {
        logger.error('Shutdown', `Error during cleanup: ${error}`);
        clearTimeout(shutdownTimeout);
        process.exit(1);
      }
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
  }).catch((error) => {
    logger.error('Server', `Startup failed: ${error}`);
    process.exit(1);
  });
}

export default app;
