/**
 * WorkerThreadPool - Manages a pool of worker threads for concurrent task execution
 * 
 * This module provides true parallel execution for Docker operations using Node.js worker_threads.
 * Each worker can handle independent execution tasks, improving throughput under high load.
 */

import { Worker } from 'worker_threads';
import { cpus } from 'os';
import path from 'path';
import { config } from './config';

export interface WorkerTask {
  id: string;
  type: 'execute' | 'cleanup';
  payload: any;
  priority: number;
  timestamp: number;
}

export interface WorkerMessage {
  type: 'task' | 'result' | 'error' | 'ready';
  taskId?: string;
  data?: any;
  error?: string;
}

export interface WorkerPoolStats {
  totalWorkers: number;
  activeWorkers: number;
  idleWorkers: number;
  queuedTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageTaskTime: number;
}

interface WorkerInfo {
  worker: Worker;
  id: number;
  busy: boolean;
  currentTaskId: string | null;
  tasksCompleted: number;
  lastError: string | null;
}

interface PendingTask {
  task: WorkerTask;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  startTime: number;
}

export class WorkerThreadPool {
  private workers: WorkerInfo[] = [];
  private taskQueue: PendingTask[] = [];
  private pendingTasks: Map<string, PendingTask> = new Map();
  private poolSize: number;
  private workerScriptPath: string;
  private completedTasks: number = 0;
  private failedTasks: number = 0;
  private taskTimes: number[] = [];
  private maxTaskTimeHistory: number = 100;
  private enabled: boolean;

  constructor(poolSize?: number, workerScriptPath?: string, enabled: boolean = true) {
    this.poolSize = poolSize || Math.max(2, Math.min(cpus().length, 8));
    this.workerScriptPath = workerScriptPath || path.join(__dirname, 'worker.js');
    this.enabled = enabled;

    if (this.enabled) {
      this.initializeWorkers();
    }
  }

  /**
   * Initialize the worker thread pool
   */
  private initializeWorkers(): void {
    console.log(`[WorkerPool] Initializing ${this.poolSize} worker threads...`);
    
    for (let i = 0; i < this.poolSize; i++) {
      this.createWorker(i);
    }
  }

  /**
   * Create a single worker thread
   */
  private createWorker(id: number): void {
    try {
      const worker = new Worker(this.workerScriptPath);
      
      const workerInfo: WorkerInfo = {
        worker,
        id,
        busy: false,
        currentTaskId: null,
        tasksCompleted: 0,
        lastError: null,
      };

      // Handle messages from worker
      worker.on('message', (message: WorkerMessage) => {
        this.handleWorkerMessage(workerInfo, message);
      });

      // Handle worker errors
      worker.on('error', (error: Error) => {
        console.error(`[WorkerPool] Worker ${id} error:`, error);
        workerInfo.lastError = error.message;
        
        // If worker was processing a task, reject it
        if (workerInfo.currentTaskId) {
          const pending = this.pendingTasks.get(workerInfo.currentTaskId);
          if (pending) {
            pending.reject(new Error(`Worker error: ${error.message}`));
            this.pendingTasks.delete(workerInfo.currentTaskId);
            this.failedTasks++;
          }
        }
        
        // Restart the worker
        this.restartWorker(workerInfo);
      });

      // Handle worker exit
      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`[WorkerPool] Worker ${id} exited with code ${code}`);
          this.restartWorker(workerInfo);
        }
      });

      this.workers.push(workerInfo);
      console.log(`[WorkerPool] Worker ${id} initialized`);
      
    } catch (error) {
      console.error(`[WorkerPool] Failed to create worker ${id}:`, error);
    }
  }

  /**
   * Restart a failed worker
   */
  private restartWorker(workerInfo: WorkerInfo): void {
    const index = this.workers.indexOf(workerInfo);
    if (index === -1) return;

    try {
      workerInfo.worker.terminate();
    } catch (error) {
      // Ignore termination errors
    }

    this.workers.splice(index, 1);
    
    // Recreate worker after a short delay
    setTimeout(() => {
      this.createWorker(workerInfo.id);
    }, 1000);
  }

  /**
   * Handle messages from workers
   */
  private handleWorkerMessage(workerInfo: WorkerInfo, message: WorkerMessage): void {
    switch (message.type) {
      case 'ready':
        // Worker is ready to accept tasks
        workerInfo.busy = false;
        workerInfo.currentTaskId = null;
        this.processQueue();
        break;

      case 'result':
        if (message.taskId) {
          const pending = this.pendingTasks.get(message.taskId);
          if (pending) {
            const taskTime = Date.now() - pending.startTime;
            this.taskTimes.push(taskTime);
            if (this.taskTimes.length > this.maxTaskTimeHistory) {
              this.taskTimes.shift();
            }
            
            pending.resolve(message.data);
            this.pendingTasks.delete(message.taskId);
            this.completedTasks++;
            workerInfo.tasksCompleted++;
          }
        }
        workerInfo.busy = false;
        workerInfo.currentTaskId = null;
        this.processQueue();
        break;

      case 'error':
        if (message.taskId) {
          const pending = this.pendingTasks.get(message.taskId);
          if (pending) {
            pending.reject(new Error(message.error || 'Unknown worker error'));
            this.pendingTasks.delete(message.taskId);
            this.failedTasks++;
          }
        }
        workerInfo.busy = false;
        workerInfo.currentTaskId = null;
        workerInfo.lastError = message.error || null;
        this.processQueue();
        break;
    }
  }

  /**
   * Submit a task to the worker pool
   */
  public async submitTask(type: 'execute' | 'cleanup', payload: any, priority: number = 0): Promise<any> {
    if (!this.enabled) {
      throw new Error('Worker pool is disabled');
    }

    const taskId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const task: WorkerTask = {
      id: taskId,
      type,
      payload,
      priority,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const pendingTask: PendingTask = {
        task,
        resolve,
        reject,
        startTime: Date.now(),
      };

      this.pendingTasks.set(taskId, pendingTask);
      this.taskQueue.push(pendingTask);
      
      // Sort queue by priority (higher first), then by timestamp (FIFO)
      this.taskQueue.sort((a, b) => {
        if (a.task.priority !== b.task.priority) {
          return b.task.priority - a.task.priority;
        }
        return a.task.timestamp - b.task.timestamp;
      });

      this.processQueue();
    });
  }

  /**
   * Process the task queue and assign tasks to available workers
   */
  private processQueue(): void {
    if (this.taskQueue.length === 0) return;

    // Find available workers
    const availableWorkers = this.workers.filter(w => !w.busy);
    
    while (availableWorkers.length > 0 && this.taskQueue.length > 0) {
      const worker = availableWorkers.shift()!;
      const pendingTask = this.taskQueue.shift()!;

      worker.busy = true;
      worker.currentTaskId = pendingTask.task.id;

      // Send task to worker
      worker.worker.postMessage({
        type: 'task',
        task: pendingTask.task,
      });
    }
  }

  /**
   * Get worker pool statistics
   */
  public getStats(): WorkerPoolStats {
    const activeWorkers = this.workers.filter(w => w.busy).length;
    const averageTaskTime = this.taskTimes.length > 0
      ? this.taskTimes.reduce((a, b) => a + b, 0) / this.taskTimes.length
      : 0;

    return {
      totalWorkers: this.workers.length,
      activeWorkers,
      idleWorkers: this.workers.length - activeWorkers,
      queuedTasks: this.taskQueue.length,
      completedTasks: this.completedTasks,
      failedTasks: this.failedTasks,
      averageTaskTime: Math.round(averageTaskTime),
    };
  }

  /**
   * Check if the pool is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Gracefully shutdown the worker pool
   */
  public async shutdown(): Promise<void> {
    console.log('[WorkerPool] Shutting down worker pool...');
    
    // Wait for active tasks to complete (with timeout)
    const maxWaitTime = 10000; // 10 seconds
    const startTime = Date.now();
    
    while (this.workers.some(w => w.busy) && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Terminate all workers
    const terminatePromises = this.workers.map(w => w.worker.terminate());
    await Promise.all(terminatePromises);
    
    this.workers = [];
    console.log('[WorkerPool] Shutdown complete');
  }
}

// Singleton instance
let workerPoolInstance: WorkerThreadPool | null = null;

/**
 * Get or create the worker pool singleton instance
 */
export function getWorkerPool(enabled: boolean = true): WorkerThreadPool {
  if (!workerPoolInstance) {
    const poolSize = config.workerPool.threads || undefined;
    workerPoolInstance = new WorkerThreadPool(poolSize, undefined, enabled);
  }
  return workerPoolInstance;
}

/**
 * Shutdown the worker pool (for cleanup)
 */
export async function shutdownWorkerPool(): Promise<void> {
  if (workerPoolInstance) {
    await workerPoolInstance.shutdown();
    workerPoolInstance = null;
  }
}
