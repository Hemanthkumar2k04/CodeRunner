import * as fs from 'fs';
import { config } from './config';
import { logger } from './logger';
import { getOrCreateSessionNetwork } from './networkManager';
import {
  createContainer as dockerCreateContainer,
  execInteractive,
  putFiles,
  removeContainers,
  type FileEntry,
} from './dockerClient';

/**
 * Kernel Manager for Jupyter-like Notebook Execution
 * 
 * Manages persistent Python kernel processes for notebooks.
 * Each notebook gets its own kernel that maintains state between cell executions.
 * 
 * SECURITY: All Docker operations use the dockerode SDK (via dockerClient.ts).
 * No shell commands are spawned, eliminating command injection risks.
 */

// Output delimiters for parsing cell outputs
const CELL_START_MARKER = '___CELL_START___';
const CELL_END_MARKER = '___CELL_END___';
const CELL_ERROR_MARKER = '___CELL_ERROR___';
const CELL_IMAGE_MARKER = '___CELL_IMAGE___';

export interface KernelOutput {
  type: 'stdout' | 'stderr' | 'error' | 'image' | 'html';
  content: string;
  cellId: string;
}

export interface KernelSession {
  kernelId: string;
  notebookId: string;
  socketId: string;
  containerId: string;
  process: {
    stdout: NodeJS.ReadableStream;
    stderr: NodeJS.ReadableStream;
    stdin: NodeJS.WritableStream;
    kill: () => void;
    getExitCode: () => Promise<number>;
  } | null;
  language: string;
  status: 'starting' | 'idle' | 'busy' | 'dead';
  executionCount: number;
  createdAt: number;
  lastActivity: number;
  currentCellId: string | null;
}

/**
 * Python wrapper script that handles cell execution with output markers
 */
const PYTHON_KERNEL_SCRIPT = `
import sys
import io
import base64
import traceback
import time

# Disable buffering
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# Output markers
CELL_START = '${CELL_START_MARKER}'
CELL_END = '${CELL_END_MARKER}'
CELL_ERROR = '${CELL_ERROR_MARKER}'
CELL_IMAGE = '${CELL_IMAGE_MARKER}'

# Try to import matplotlib (optional)
try:
    import matplotlib
    matplotlib.use('Agg')  # Non-interactive backend for plots
    import matplotlib.pyplot as plt
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False

def capture_figures():
    """Capture all open matplotlib figures as base64 PNG"""
    if not HAS_MATPLOTLIB:
        return []
    images = []
    for fig_num in plt.get_fignums():
        fig = plt.figure(fig_num)
        buf = io.BytesIO()
        fig.savefig(buf, format='png', bbox_inches='tight', dpi=100)
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        images.append(img_base64)
        buf.close()
    plt.close('all')
    return images

# Global namespace for persistent state
_namespace = {'__name__': '__main__', '__builtins__': __builtins__}

def execute_cell(cell_id, code):
    """Execute code and return output with markers"""
    print(f'{CELL_START}{cell_id}', flush=True)
    
    try:
        # Compile the code to check if it's an expression or statement
        try:
            compiled = compile(code, '<cell>', 'eval')
            result = eval(compiled, _namespace)
            if result is not None:
                print(repr(result), flush=True)
        except SyntaxError:
            # It's a statement, not an expression
            exec(code, _namespace)
        
        # Capture any matplotlib figures
        images = capture_figures()
        for img in images:
            print(f'{CELL_IMAGE}{img}', flush=True)
            
    except Exception as e:
        print(f'{CELL_ERROR}', file=sys.stderr, flush=True)
        traceback.print_exc(file=sys.stderr)
    
    print(f'{CELL_END}{cell_id}', flush=True)

# Signal that kernel is ready
print('__KERNEL_READY__', flush=True)

# Read and execute commands from stdin
while True:
    try:
        line = sys.stdin.readline()
        if not line:  # EOF
            break
        line = line.strip()
        if not line:
            continue
        if line.startswith('__EXEC__:'):
            # Format: __EXEC__:cell_id:base64_encoded_code
            parts = line.split(':', 2)
            if len(parts) == 3:
                cell_id = parts[1]
                code = base64.b64decode(parts[2]).decode('utf-8')
                execute_cell(cell_id, code)
        elif line == '__SHUTDOWN__':
            break
    except Exception as e:
        print(f'Kernel error: {e}', file=sys.stderr, flush=True)
`;

class KernelManager {
  // Map: kernelId -> KernelSession
  private kernels: Map<string, KernelSession> = new Map();

  // Map: notebookId -> kernelId (one kernel per notebook)
  private notebookKernels: Map<string, string> = new Map();

  // Output callback for streaming results to client
  private outputCallback: ((kernelId: string, socketId: string, output: KernelOutput) => void) | null = null;

  // Status change callback
  private statusCallback: ((kernelId: string, socketId: string, status: KernelSession['status']) => void) | null = null;

  // Cell completion callback
  private cellCompleteCallback: ((kernelId: string, socketId: string, cellId: string) => void) | null = null;

  constructor() {
    logger.info('KernelManager', 'Initialized notebook kernel manager');
  }

  /**
   * Set callback for kernel output
   */
  onOutput(callback: (kernelId: string, socketId: string, output: KernelOutput) => void): void {
    this.outputCallback = callback;
  }

  /**
   * Set callback for kernel status changes
   */
  onStatusChange(callback: (kernelId: string, socketId: string, status: KernelSession['status']) => void): void {
    this.statusCallback = callback;
  }

  /**
   * Set callback for cell completion
   */
  onCellComplete(callback: (kernelId: string, socketId: string, cellId: string) => void): void {
    this.cellCompleteCallback = callback;
  }

  /**
   * Verify that a kernel belongs to the requesting socket.
   * Prevents cross-session kernel hijacking.
   */
  verifyOwnership(kernelId: string, socketId: string): boolean {
    const session = this.kernels.get(kernelId);
    if (!session) return false;
    return session.socketId === socketId;
  }

  /**
   * Start a new kernel for a notebook
   */
  async startKernel(
    notebookId: string,
    socketId: string,
    language: string = 'python'
  ): Promise<string> {
    // Check if kernel already exists for this notebook
    const existingKernelId = this.notebookKernels.get(notebookId);
    if (existingKernelId) {
      const existingKernel = this.kernels.get(existingKernelId);
      if (existingKernel && existingKernel.status !== 'dead') {
        logger.debug('KernelManager', `Reusing existing kernel ${existingKernelId} for notebook ${notebookId}`);
        return existingKernelId;
      }
    }

    const kernelId = `kernel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.info('KernelManager', `Starting kernel ${kernelId} for notebook ${notebookId}`);

    try {
      // Create container for kernel via Docker SDK (no shell commands)
      const networkName = await getOrCreateSessionNetwork(socketId);
      const containerId = await this.createKernelContainer(kernelId, socketId, networkName, language);

      // Create kernel session
      const session: KernelSession = {
        kernelId,
        notebookId,
        socketId,
        containerId,
        process: null,
        language,
        status: 'starting',
        executionCount: 0,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        currentCellId: null,
      };

      this.kernels.set(kernelId, session);
      this.notebookKernels.set(notebookId, kernelId);

      // Start the Python kernel process
      await this.startKernelProcess(session);

      session.status = 'idle';
      this.emitStatus(kernelId, 'idle');

      logger.info('KernelManager', `Kernel ${kernelId} started successfully`);
      return kernelId;
    } catch (error: any) {
      logger.error('KernelManager', `Failed to start kernel: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a Docker container for the kernel via SDK.
   * SECURITY: Uses dockerode SDK instead of shell commands to eliminate injection.
   */
  private async createKernelContainer(
    kernelId: string,
    socketId: string,
    networkName: string,
    language: string
  ): Promise<string> {
    const runtimeConfig = config.runtimes[language as keyof typeof config.runtimes];
    if (!runtimeConfig) {
      throw new Error(`Unsupported language for kernel: ${language}`);
    }

    const containerId = await dockerCreateContainer({
      image: runtimeConfig.image,
      labels: {
        'type': 'coderunner-kernel',
        'kernel': kernelId,
        'session': socketId,
      },
      networkName,
      memory: config.docker.memorySQL,  // More memory for notebook kernels
      cpus: config.docker.cpusNotebook,  // More CPU for notebook kernels
    });

    logger.info('KernelManager', `Created kernel container ${containerId.substring(0, 12)}`);
    return containerId;
  }

  /**
   * Start the Python kernel process inside the container via SDK.
   * SECURITY: Uses putFiles() + execInteractive() instead of docker cp + docker exec CLI.
   */
  private async startKernelProcess(session: KernelSession): Promise<void> {
    // Stream kernel script directly into container via SDK (zero host I/O for docker cp)
    const kernelFile: FileEntry = {
      path: 'kernel.py',
      content: PYTHON_KERNEL_SCRIPT,
    };
    await putFiles(session.containerId, [kernelFile]);

    // Start the kernel process via SDK interactive exec (replaces spawn('docker', ['exec', ...]))
    const execSession = await execInteractive(
      session.containerId,
      'python -u /app/kernel.py',
    );

    session.process = execSession;

    let currentOutput = '';
    let currentCellId: string | null = null;
    let isReady = false;

    // Promise to wait for kernel ready
    const readyPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Kernel startup timeout'));
      }, 30000);

      const checkReady = (text: string) => {
        if (text.includes('__KERNEL_READY__')) {
          isReady = true;
          clearTimeout(timeout);
          resolve();
        }
      };

      // Check stdout for ready signal
      execSession.stdout.once('data', (data: Buffer) => {
        checkReady(data.toString());
      });

      execSession.stdout.on('error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });

      execSession.stdout.on('end', () => {
        if (!isReady) {
          clearTimeout(timeout);
          reject(new Error('Kernel process exited before becoming ready'));
        }
      });
    });

    // Handle stdout
    execSession.stdout.on('data', (data: Buffer) => {
      const text = data.toString();

      // Skip the ready signal in output processing
      if (text.includes('__KERNEL_READY__')) {
        const parts = text.split('__KERNEL_READY__');
        currentOutput += parts.filter(p => p.trim()).join('');
        if (!currentOutput) return;
      } else {
        currentOutput += text;
      }

      // Parse output for markers
      const lines = currentOutput.split('\n');
      currentOutput = lines.pop() || '';  // Keep incomplete line

      for (const line of lines) {
        if (line.startsWith(CELL_START_MARKER)) {
          currentCellId = line.substring(CELL_START_MARKER.length);
        } else if (line.startsWith(CELL_END_MARKER)) {
          const endCellId = line.substring(CELL_END_MARKER.length);
          if (endCellId === currentCellId) {
            session.status = 'idle';
            session.currentCellId = null;
            this.emitCellComplete(session.kernelId, endCellId);
            this.emitStatus(session.kernelId, 'idle');
          }
          currentCellId = null;
        } else if (line.startsWith(CELL_IMAGE_MARKER)) {
          const imageData = line.substring(CELL_IMAGE_MARKER.length);
          if (currentCellId) {
            this.emitOutput(session.kernelId, {
              type: 'image',
              content: imageData,
              cellId: currentCellId,
            });
          }
        } else if (currentCellId && line.trim()) {
          this.emitOutput(session.kernelId, {
            type: 'stdout',
            content: line + '\n',
            cellId: currentCellId,
          });
        }
      }
    });

    // Handle stderr
    execSession.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      logger.debug('KernelManager', `stderr: ${text}`);
      if (currentCellId) {
        const isErrorMarker = text.includes(CELL_ERROR_MARKER);
        this.emitOutput(session.kernelId, {
          type: isErrorMarker ? 'error' : 'stderr',
          content: text.replace(CELL_ERROR_MARKER, ''),
          cellId: currentCellId,
        });
      }
    });

    // Handle stream end (process exit)
    execSession.stdout.on('end', () => {
      logger.info('KernelManager', `Kernel ${session.kernelId} process exited`);
      session.status = 'dead';
      session.process = null;
      this.emitStatus(session.kernelId, 'dead');
    });

    // Wait for kernel to be ready
    await readyPromise;
    logger.info('KernelManager', `Kernel ${session.kernelId} is ready`);
  }

  /**
   * Execute code in a kernel
   */
  async executeCell(kernelId: string, cellId: string, code: string): Promise<number> {
    const session = this.kernels.get(kernelId);
    if (!session) {
      throw new Error(`Kernel ${kernelId} not found`);
    }

    if (session.status === 'dead') {
      throw new Error(`Kernel ${kernelId} is dead`);
    }

    if (session.status === 'busy') {
      throw new Error(`Kernel ${kernelId} is busy`);
    }

    if (!session.process || !session.process.stdin) {
      throw new Error(`Kernel ${kernelId} process not available`);
    }

    session.status = 'busy';
    session.currentCellId = cellId;
    session.executionCount++;
    session.lastActivity = Date.now();
    this.emitStatus(kernelId, 'busy');

    // Send code to kernel (base64 encoded to handle multiline)
    const codeBase64 = Buffer.from(code).toString('base64');
    const command = `__EXEC__:${cellId}:${codeBase64}\n`;
    session.process.stdin.write(command);

    return session.executionCount;
  }

  /**
   * Interrupt a running kernel.
   * SECURITY: Uses SDK exec instead of shell `docker exec` command.
   */
  async interruptKernel(kernelId: string): Promise<void> {
    const session = this.kernels.get(kernelId);
    if (!session) {
      throw new Error(`Kernel ${kernelId} not found`);
    }

    if (session.process) {
      try {
        // Use SDK to execute pkill inside the container (no shell interpolation)
        const { execInContainer } = await import('./dockerClient');
        await execInContainer(session.containerId, 'pkill -SIGINT -f kernel.py', { timeout: 5000 });
        logger.info('KernelManager', `Interrupted kernel ${kernelId}`);
      } catch (error) {
        logger.error('KernelManager', `Failed to interrupt kernel: ${error}`);
      }
    }
  }

  /**
   * Restart a kernel (preserves container, restarts process)
   */
  async restartKernel(kernelId: string): Promise<void> {
    const session = this.kernels.get(kernelId);
    if (!session) {
      throw new Error(`Kernel ${kernelId} not found`);
    }

    logger.info('KernelManager', `Restarting kernel ${kernelId}`);

    // Kill existing process via SDK stream destroy
    if (session.process) {
      session.process.kill();
      session.process = null;
    }

    // Reset state
    session.status = 'starting';
    session.executionCount = 0;
    session.currentCellId = null;
    this.emitStatus(kernelId, 'starting');

    // Start new process
    await this.startKernelProcess(session);

    session.status = 'idle';
    this.emitStatus(kernelId, 'idle');
    logger.info('KernelManager', `Kernel ${kernelId} restarted`);
  }

  /**
   * Shutdown a kernel.
   * SECURITY: Uses SDK removeContainers() instead of shell `docker rm -f`.
   */
  async shutdownKernel(kernelId: string): Promise<void> {
    const session = this.kernels.get(kernelId);
    if (!session) {
      return;
    }

    logger.info('KernelManager', `Shutting down kernel ${kernelId}`);

    // Send shutdown command
    if (session.process && session.process.stdin) {
      try {
        session.process.stdin.write('__SHUTDOWN__\n');
      } catch {
        // Stream may already be closed
      }
      session.process.kill();
    }

    // Remove container via SDK (no shell command)
    try {
      await removeContainers([session.containerId]);
    } catch (error) {
      logger.error('KernelManager', `Failed to remove container: ${error}`);
    }

    // Clean up maps
    this.kernels.delete(kernelId);
    this.notebookKernels.delete(session.notebookId);

    logger.info('KernelManager', `Kernel ${kernelId} shut down`);
  }

  /**
   * Shutdown all kernels for a socket (on disconnect)
   */
  async shutdownSocketKernels(socketId: string): Promise<void> {
    const kernelsToShutdown: string[] = [];

    for (const [kernelId, session] of this.kernels.entries()) {
      if (session.socketId === socketId) {
        kernelsToShutdown.push(kernelId);
      }
    }

    for (const kernelId of kernelsToShutdown) {
      await this.shutdownKernel(kernelId);
    }
  }

  /**
   * Get kernel status
   */
  getKernelStatus(kernelId: string): KernelSession['status'] | null {
    const session = this.kernels.get(kernelId);
    return session?.status || null;
  }

  /**
   * Get kernel for a notebook
   */
  getKernelForNotebook(notebookId: string): string | null {
    return this.notebookKernels.get(notebookId) || null;
  }

  /**
   * Emit output to callback
   */
  private emitOutput(kernelId: string, output: KernelOutput): void {
    if (this.outputCallback) {
      const session = this.kernels.get(kernelId);
      this.outputCallback(kernelId, session?.socketId || '', output);
    }
  }

  /**
   * Emit status change to callback
   */
  private emitStatus(kernelId: string, status: KernelSession['status']): void {
    if (this.statusCallback) {
      const session = this.kernels.get(kernelId);
      this.statusCallback(kernelId, session?.socketId || '', status);
    }
  }

  /**
   * Emit cell completion to callback
   */
  private emitCellComplete(kernelId: string, cellId: string): void {
    if (this.cellCompleteCallback) {
      const session = this.kernels.get(kernelId);
      this.cellCompleteCallback(kernelId, session?.socketId || '', cellId);
    }
  }

  /**
   * Get statistics
   */
  getStats(): { totalKernels: number; byLanguage: Record<string, number> } {
    const byLanguage: Record<string, number> = {};
    for (const session of this.kernels.values()) {
      byLanguage[session.language] = (byLanguage[session.language] || 0) + 1;
    }
    return { totalKernels: this.kernels.size, byLanguage };
  }
}

export const kernelManager = new KernelManager();
