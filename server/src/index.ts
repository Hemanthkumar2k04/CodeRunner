import express from 'express';
import cors from 'cors';
import { exec, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { containerPool } from './pool';
import { config } from './config';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = config.server.port;

// Admin authentication
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'; // Change this in production!
const adminSessions = new Map<string, { expiresAt: number }>();

// Middleware
app.use(cors());
app.use(express.json());

// Admin authentication middleware
function authenticateAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token as string;
  
  if (!token || !adminSessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const session = adminSessions.get(token)!;
  if (session.expiresAt < Date.now()) {
    adminSessions.delete(token);
    return res.status(401).json({ error: 'Session expired' });
  }
  
  next();
}

// --- Admin API Endpoints ---
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  adminSessions.set(token, { expiresAt });
  
  res.json({ token, expiresAt });
});

app.get('/api/admin/status', authenticateAdmin, async (req, res) => {
  try {
    // Get running containers info
    const { stdout } = await new Promise<{ stdout: string }>((resolve, reject) => {
      exec('docker ps --filter label=type=coderunner-worker --format "{{.ID}}|{{.Image}}|{{.Status}}"', (err, stdout) => {
        if (err) reject(err);
        else resolve({ stdout });
      });
    });

    const containers = stdout
      .trim()
      .split('\n')
      .filter(line => line.length > 0)
      .map(line => {
        const [id, image, status] = line.split('|');
        return { id, image, status };
      });

    // Get pool status (warm containers per language)
    const poolStatus = containerPool.getStatus();
    const totalWarmContainers = Object.values(poolStatus).reduce((sum, count) => sum + count, 0);
    
    // Active containers = total running - warm containers in pool
    const activeContainers = containers.length - totalWarmContainers;

    // Get number of connected clients
    const connectedClients = io.engine.clientsCount;

    res.json({
      containers,
      poolStatus,
      totalWarmContainers,
      activeContainers,
      connectedClients,
      timestamp: Date.now()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

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
    case 'cpp': return 'find . -maxdepth 1 \\( -name "*.c" -o -name "*.cpp" -o -name "*.cc" -o -name "*.cxx" -o -name "*.c++" \\) -print0 | xargs -0 g++ -o app && ./app';
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

    // 1. Get container
    try {
      containerId = await containerPool.getContainer(language);
    } catch (e) {
      socket.emit('output', { sessionId, type: 'stderr', data: 'System Error: Failed to acquire container\n' });
      socket.emit('exit', { sessionId, code: 1 });
      return;
    }

    const runId = Date.now().toString() + Math.random().toString(36).substring(7);
    tempDir = path.resolve(__dirname, '..', 'temp', `runner-${runId}`);

    // 2. Write files
    try {
      fs.mkdirSync(tempDir, { recursive: true });
      for (const file of files) {
        const filePath = path.join(tempDir, file.path);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, file.content);
      }
    } catch (err: any) {
      cleanup();
      socket.emit('output', { sessionId, type: 'stderr', data: `System Error: ${err.message}\n` });
      socket.emit('exit', { sessionId, code: 1 });
      return;
    }

    // 3. Copy files
    const cpCommand = `docker cp "${tempDir}/." ${containerId}:/app/`;
    exec(cpCommand, (cpError) => {
      if (cpError) {
        cleanup();
        socket.emit('output', { sessionId, type: 'stderr', data: `System Error (Copy): ${cpError.message}\n` });
        socket.emit('exit', { sessionId, code: 1 });
        return;
      }

      // 4. Spawn process
      // Use -i for interactive (keeps stdin open)
      const dockerArgs = [
        'exec',
        '-i', 
        '-w', '/app',
        containerId!,
        '/bin/sh', '-c', command
      ];

      currentProcess = spawn('docker', dockerArgs);

      currentProcess.stdout.on('data', (chunk: Buffer) => {
        outputBuffer.push({ sessionId, type: 'stdout', data: chunk.toString() });
        scheduleFlush();
      });

      currentProcess.stderr.on('data', (chunk: Buffer) => {
        outputBuffer.push({ sessionId, type: 'stderr', data: chunk.toString() });
        scheduleFlush();
      });

      currentProcess.on('close', (code: number) => {
        // Flush any remaining buffered output before exit
        if (flushBufferTimer) {
          clearTimeout(flushBufferTimer);
          flushOutputBuffer();
        }
        // Only emit exit if not manually stopped (manual stop already emitted exit)
        if (!manuallyStopped) {
          socket.emit('exit', { sessionId, code });
        }
        cleanup();
      });

      currentProcess.on('error', (err: any) => {
        socket.emit('output', { sessionId, type: 'stderr', data: `Process Error: ${err.message}\n` });
        cleanup();
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
      cleanup();
    }
  });

  socket.on('disconnect', () => {
    if (flushBufferTimer) {
      clearTimeout(flushBufferTimer);
    }
    if (currentProcess) {
      currentProcess.kill();
    }
    cleanup();
  });

  function cleanup() {
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) { /* ignore */ }
      tempDir = null;
    }
    if (containerId && currentLanguage) {
      containerPool.returnOrDeleteContainer(currentLanguage, containerId);
      containerId = null;
    }
    currentProcess = null;
  }
});


/**
 * Runs a multi-file project using a WARM container from the pool
 * @deprecated Use WebSocket 'run' event for interactive execution
 */
export function runProject(language: string, files: File[]): Promise<RunResult> {
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
    if (!entryFile && language !== 'cpp') {
       return resolve({ stdout: '', stderr: 'Error: No entry file marked for execution (toBeExec: true).', exitCode: 1 });
    }

    // Construct command
    let command = '';
    try {
        // For C++, entryFile might be undefined, which is fine for the helper if we handle it, 
        // but our helper expects a string.
        // Let's pass a dummy string for C++ or handle it inside.
        command = getRunCommand(language, entryFile ? entryFile.name : '');
    } catch (e: any) {
        return resolve({ stdout: '', stderr: e.message, exitCode: 1 });
    }

    // 1. Get a warm container
    let containerId: string;
    try {
      containerId = await containerPool.getContainer(language);
    } catch (e) {
      return resolve({ stdout: '', stderr: 'System Error: Failed to acquire container', exitCode: 1 });
    }

    const runId = Date.now().toString() + Math.random().toString(36).substring(7);
    const tempDir = path.resolve(__dirname, '..', 'temp', `runner-${runId}`);

    // 2. Create temp directory and write ALL files
    try {
      fs.mkdirSync(tempDir, { recursive: true });
      
      for (const file of files) {
        const safeName = path.basename(file.name); 
        fs.writeFileSync(path.join(tempDir, safeName), file.content);
      }
    } catch (err: any) {
      containerPool.returnOrDeleteContainer(language, containerId);
      return resolve({ stdout: '', stderr: `System Error: ${err.message}`, exitCode: 1 });
    }

    // 3. Copy files TO the container
    const cpCommand = `docker cp "${tempDir}/." ${containerId}:/app/`;

    exec(cpCommand, (cpError) => {
      if (cpError) {
        cleanup();
        return resolve({ stdout: '', stderr: `System Error (Copy): ${cpError.message}`, exitCode: 1 });
      }

      // 4. Execute the code inside the container
      // Use single quotes to prevent shell expansion on the host
      const execCommand = `timeout ${config.docker.timeout} docker exec -w /app ${containerId} /bin/sh -c '${command}'`;

      exec(execCommand, (execError, stdout, stderr) => {
        cleanup();

        if (execError) {
          if ((execError as any).code === 124 || execError.code === 124) {
            return resolve({ 
              stdout: stdout || '', 
              stderr: 'Error: Execution timed out', 
              exitCode: 124 
            });
          }
          return resolve({ 
            stdout: stdout || '', 
            stderr: stderr || execError.message, 
            exitCode: (execError as any).code || 1 
          });
        }

        resolve({ stdout, stderr, exitCode: 0 });
      });
    });

    function cleanup() {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) { /* ignore */ }
      
      containerPool.returnOrDeleteContainer(language, containerId);
    }
  });
}

// --- API Endpoints ---

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

app.post('/run', async (req, res) => {
  const { language, files } = req.body;

  if (!language || !files || !Array.isArray(files)) {
    res.status(400).json({ error: "Invalid request body. 'language' and 'files' are required." });
    return;
  }

  if (files.length === 0) {
    res.status(400).json({ error: "No files provided." });
    return;
  }

  try {
    const result = await runProject(language, files);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: `Execution failed: ${error.message}` });
  }
});

// Start Server
if (require.main === module) {
  // Global error handlers to prevent silent exits
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  containerPool.initialize().then(() => {
    const server = httpServer.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Network access: http://<your-ip-address>:${PORT}`);
    });

    server.on('error', (err) => {
      console.error('Server failed to start:', err);
      process.exit(1);
    });

    // Handle graceful shutdown
    const gracefulShutdown = async () => {
      console.log('\nShutting down server...');
      await containerPool.cleanup();
      server.close(() => {
        console.log('Server closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
  });
}

export default app;
