import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface File {
  name: string;
  content: string;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface RuntimeConfig {
  image: string;
  command: string;
}

const RUNTIMES: Record<string, RuntimeConfig> = {
  python: {
    image: 'python-runtime',
    command: 'python main.py'
  },
  cpp: {
    image: 'cpp-runtime',
    command: 'g++ -o app *.cpp && ./app'
  },
  javascript: {
    image: 'node-runtime',
    command: 'node index.js'
  }
};

/**
 * Runs a multi-file project in a secure Docker container
 * @param language - The language ID (e.g., 'python', 'cpp')
 * @param files - Array of files to write to the container
 * @returns Promise<RunResult>
 */
export function runProject(language: string, files: File[]): Promise<RunResult> {
  return new Promise((resolve) => {
    const config = RUNTIMES[language];
    if (!config) {
      return resolve({ 
        stdout: '', 
        stderr: `Error: Unsupported language '${language}'`, 
        exitCode: 1 
      });
    }

    const runId = Date.now().toString() + Math.random().toString(36).substring(7);
    const tempDir = path.resolve(__dirname, '..', 'temp', `runner-${runId}`);

    // 1. Create temp directory and write ALL files
    try {
      fs.mkdirSync(tempDir, { recursive: true });
      
      for (const file of files) {
        const safeName = path.basename(file.name); 
        fs.writeFileSync(path.join(tempDir, safeName), file.content);
      }
    } catch (err: any) {
      return resolve({ stdout: '', stderr: `System Error: ${err.message}`, exitCode: 1 });
    }

    // 2. Construct Docker command
    const dockerArgs = [
      'run', 
      '--rm', 
      '--network', 'none', 
      '--memory', '128m', 
      '--cpus', '0.5', 
      '-v', `"${tempDir}:/app"`, 
      '-w', '/app', 
      config.image, 
      '/bin/sh', '-c', `"${config.command}"`
    ];

    const command = `timeout 5s docker ${dockerArgs.join(' ')}`;

    // 3. Execute
    exec(command, (error, stdout, stderr) => {
      // 4. Cleanup
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }

      if (error) {
        if ((error as any).code === 124 || error.code === 124) {
          return resolve({ 
            stdout: stdout || '', 
            stderr: 'Error: Execution timed out', 
            exitCode: 124 
          });
        }
        return resolve({ 
          stdout: stdout || '', 
          stderr: stderr || error.message, 
          exitCode: (error as any).code || 1 
        });
      }

      resolve({ stdout, stderr, exitCode: 0 });
    });
  });
}

// Example usage
if (require.main === module) {
  const cppFiles: File[] = [
    {
      name: 'main.cpp',
      content: `
        #include <iostream>
        #include "greet.h"
        int main() {
            std::cout << greet("World") << std::endl;
            return 0;
        }
      `
    },
    {
      name: 'greet.h',
      content: `
        #include <string>
        std::string greet(std::string name);
      `
    },
    {
      name: 'greet.cpp',
      content: `
        #include "greet.h"
        std::string greet(std::string name) {
            return "Hello, " + name + " from C++!";
        }
      `
    }
  ];

  console.log('Executing C++ project...');
  runProject('cpp', cppFiles).then(console.log);
}
