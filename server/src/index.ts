import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { containerPool } from './pool';
import { config } from './config';

const app = express();
const PORT = config.server.port;

// Middleware
app.use(cors());
app.use(express.json());

export interface File {
  name: string;
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
    case 'python': return `python ${entryFile}`;
    case 'javascript': return `node ${entryFile}`;
    case 'cpp': return 'g++ -o app *.cpp && ./app';
    case 'java': {
      const className = entryFile.replace('.java', '');
      return `javac *.java && java ${className}`;
    }
    default: throw new Error(`Unsupported language: ${language}`);
  }
}

/**
 * Runs a multi-file project using a WARM container from the pool
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
      containerPool.recycleContainer(language, containerId);
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
      const execCommand = `timeout ${config.docker.timeout} docker exec -w /app ${containerId} /bin/sh -c "${command}"`;

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
      
      containerPool.recycleContainer(language, containerId);
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
  containerPool.initialize().then(() => {
    const server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
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
