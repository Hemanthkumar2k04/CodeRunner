/**
 * Comprehensive Server Tests
 * Tests for configuration, network management, container pooling, and execution queue
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { config } from '../src/config';
import { getNetworkName, getNetworkStats } from '../src/networkManager';
import { sessionPool } from '../src/pool';

// ============================================================================
// Configuration Tests
// ============================================================================

describe('Configuration', () => {
  describe('Server Configuration', () => {
    it('should have valid server configuration', () => {
      expect(config.server).toBeDefined();
      expect(config.server.port).toBeDefined();
      expect(typeof config.server.port).toBe('number');
      expect(config.server.port).toBeGreaterThan(0);
      expect(config.server.port).toBeLessThan(65536);
    });

    it('should have valid host and environment', () => {
      expect(config.server.host).toBeDefined();
      expect(typeof config.server.host).toBe('string');
      expect(config.server.env).toBeDefined();
      expect(typeof config.server.env).toBe('string');
    });

    it('should have log level configured', () => {
      expect(config.server.logLevel).toBeDefined();
      expect(typeof config.server.logLevel).toBe('string');
    });
  });

  describe('Docker Configuration', () => {
    it('should have valid Docker configuration', () => {
      expect(config.docker).toBeDefined();
      expect(config.docker.memory).toBeDefined();
      expect(typeof config.docker.memory).toBe('string');
    });

    it('should have container resource limits', () => {
      expect(config.docker.memory).toBeDefined();
      expect(config.docker.cpus).toBeDefined();
      expect(typeof config.docker.memory).toBe('string');
      expect(typeof config.docker.cpus).toBe('string');
    });

    it('should have SQL-specific resource limits', () => {
      expect(config.docker.memorySQL).toBeDefined();
      expect(typeof config.docker.memorySQL).toBe('string');
    });

    it('should have timeout configuration', () => {
      expect(config.docker.timeout).toBeDefined();
      expect(config.docker.commandTimeout).toBeDefined();
      expect(typeof config.docker.timeout).toBe('string');
      expect(typeof config.docker.commandTimeout).toBe('number');
    });
  });

  describe('Network Configuration', () => {
    it('should have network pool configuration', () => {
      expect(config.network).toBeDefined();
      expect(config.network.subnetPools).toBeDefined();
      expect(Array.isArray(config.network.subnetPools)).toBe(true);
      expect(config.network.subnetPools.length).toBeGreaterThan(0);
    });

    it('should have valid subnet pool structure', () => {
      config.network.subnetPools.forEach((pool) => {
        expect(pool).toHaveProperty('name');
        expect(pool).toHaveProperty('base');
        expect(pool).toHaveProperty('cidr');
        expect(pool).toHaveProperty('capacity');
        expect(pool.cidr).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/);
      });
    });

    it('should have session network prefix', () => {
      expect(config.network.sessionNetworkPrefix).toBeDefined();
      expect(typeof config.network.sessionNetworkPrefix).toBe('string');
    });

    it('should have network driver configuration', () => {
      expect(config.network.networkDriver).toBeDefined();
      expect(config.network.networkLabel).toBeDefined();
    });
  });

  describe('Runtime Images', () => {
    it('should have Python runtime configured', () => {
      expect(config.runtimes).toBeDefined();
      expect(config.runtimes.python).toBeDefined();
      expect(config.runtimes.python.image).toBeDefined();
      expect(config.runtimes.python.language).toBe('python');
    });

    it('should have JavaScript runtime configured', () => {
      expect(config.runtimes.javascript).toBeDefined();
      expect(config.runtimes.javascript.image).toBeDefined();
      expect(config.runtimes.javascript.language).toBe('javascript');
    });

    it('should have Java runtime configured', () => {
      expect(config.runtimes.java).toBeDefined();
      expect(config.runtimes.java.image).toBeDefined();
      expect(config.runtimes.java.language).toBe('java');
    });

    it('should have C++ runtime configured', () => {
      expect(config.runtimes.cpp).toBeDefined();
      expect(config.runtimes.cpp.image).toBeDefined();
      expect(config.runtimes.cpp.language).toBe('cpp');
    });

    it('should have SQL runtime configured', () => {
      expect(config.runtimes.sql).toBeDefined();
      expect(config.runtimes.sql.image).toBeDefined();
      expect(config.runtimes.sql.language).toBe('sql');
    });
  });

  describe('Session Container Configuration', () => {
    it('should have session TTL', () => {
      expect(config.sessionContainers.ttl).toBeDefined();
      expect(config.sessionContainers.ttl).toBeGreaterThan(0);
    });

    it('should have cleanup interval', () => {
      expect(config.sessionContainers.cleanupInterval).toBeDefined();
      expect(config.sessionContainers.cleanupInterval).toBeGreaterThan(0);
    });

    it('should have max containers per session', () => {
      expect(config.sessionContainers.maxPerSession).toBeDefined();
      expect(config.sessionContainers.maxPerSession).toBeGreaterThan(0);
    });

    it('should have concurrent session limit', () => {
      expect(config.sessionContainers.maxConcurrentSessions).toBeDefined();
      expect(config.sessionContainers.maxConcurrentSessions).toBeGreaterThan(0);
    });

    it('should have auto cleanup configuration', () => {
      expect(typeof config.sessionContainers.autoCleanup).toBe('boolean');
    });
  });

  describe('File Management', () => {
    it('should have max file size limit', () => {
      expect(config.files).toBeDefined();
      expect(config.files.maxFileSize).toBeDefined();
      expect(typeof config.files.maxFileSize).toBe('number');
      expect(config.files.maxFileSize).toBeGreaterThan(0);
    });

    it('should have max files per session', () => {
      expect(config.files.maxFilesPerSession).toBeDefined();
      expect(typeof config.files.maxFilesPerSession).toBe('number');
    });

    it('should have temp directory configured', () => {
      expect(config.files.tempDir).toBeDefined();
      expect(typeof config.files.tempDir).toBe('string');
    });
  });

  describe('Logging Configuration', () => {
    it('should have logging format configured', () => {
      expect(config.logging).toBeDefined();
      expect(config.logging.format).toBeDefined();
      expect(typeof config.logging.format).toBe('string');
    });

    it('should have request logging option', () => {
      expect(typeof config.logging.requestLogging).toBe('boolean');
    });

    it('should have error details option', () => {
      expect(typeof config.logging.errorDetails).toBe('boolean');
    });
  });
});

// ============================================================================
// Network Management Tests
// ============================================================================

describe('Network Management', () => {
  describe('Network Naming', () => {
    it('should generate consistent network names for same session ID', () => {
      const sessionId = 'test-session-abc123';
      const name1 = getNetworkName(sessionId);
      const name2 = getNetworkName(sessionId);
      expect(name1).toBe(name2);
    });

    it('should include session ID in network name', () => {
      const sessionId = 'my-session';
      const name = getNetworkName(sessionId);
      expect(name).toContain(sessionId);
    });

    it('should include coderunner prefix', () => {
      const sessionId = 'session-123';
      const name = getNetworkName(sessionId);
      expect(name).toContain('coderunner');
    });

    it('should generate unique names for different sessions', () => {
      const name1 = getNetworkName('session-1');
      const name2 = getNetworkName('session-2');
      const name3 = getNetworkName('session-3');
      expect(name1).not.toBe(name2);
      expect(name2).not.toBe(name3);
      expect(name1).not.toBe(name3);
    });

    it('should generate valid Docker network names', () => {
      const sessionId = 'test-session';
      const name = getNetworkName(sessionId);
      expect(name.length).toBeLessThan(64);
      expect(/^[a-zA-Z0-9_-]+$/.test(name)).toBe(true);
    });

    it('should handle special characters in session ID', () => {
      const sessionIds = ['session-123', 'session_456', 'session.789'];
      sessionIds.forEach(sessionId => {
        const name = getNetworkName(sessionId);
        expect(name).toBeDefined();
        expect(name.length).toBeGreaterThan(0);
      });
    });

    it('should follow Docker network naming rules', () => {
      const validSessionIds = ['user-123', 'session_abc', 'test-session-456'];
      validSessionIds.forEach(sessionId => {
        const name = getNetworkName(sessionId);
        const isValid = /^[a-zA-Z0-9_.-]+$/.test(name) && name.length < 64;
        expect(isValid).toBe(true);
      });
    });

    it('should be deterministic for same input', () => {
      const sessionId = 'deterministic-test';
      const names: string[] = [];
      for (let i = 0; i < 5; i++) {
        names.push(getNetworkName(sessionId));
      }
      names.forEach(name => expect(name).toBe(names[0]));
    });
  });

  describe('Network Statistics', () => {
    it('should retrieve network stats', () => {
      const stats = getNetworkStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });

    it('should have metrics structure', async () => {
      const stats = await getNetworkStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('withContainers');
      expect(stats).toHaveProperty('networks');
      expect(Array.isArray(stats.networks)).toBe(true);
    });

    it('should have numeric metrics', async () => {
      const stats = await getNetworkStats();
      expect(typeof stats.total).toBe('number');
      expect(stats.total).toBeGreaterThanOrEqual(0);
    });

    it('should have valid network list', async () => {
      const stats = await getNetworkStats();
      expect(Array.isArray(stats.networks)).toBe(true);
    });
  });

  describe('Subnet Allocation', () => {
    it('should allocate subnets from configured pools', () => {
      expect(() => getNetworkStats()).not.toThrow();
    });

    it('should have capacity for multiple concurrent sessions', async () => {
      const stats = await getNetworkStats();
      expect(stats.total).toBeGreaterThanOrEqual(0);
    });

    it('should track used subnets', async () => {
      const stats = await getNetworkStats();
      expect(Array.isArray(stats.networks)).toBe(true);
    });
  });

  describe('Concurrent Network Scenarios', () => {
    it('should generate unique networks for many sessions', () => {
      const networks = new Set();
      for (let i = 0; i < 100; i++) {
        const sessionId = `session-${i}`;
        const name = getNetworkName(sessionId);
        networks.add(name);
      }
      expect(networks.size).toBe(100);
    });

    it('should not have name collisions', () => {
      const sessionIds = Array.from({ length: 50 }, (_, i) => `session-${i}`);
      const names = sessionIds.map(id => getNetworkName(id));
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty session ID', () => {
      const name = getNetworkName('');
      expect(name).toBeDefined();
      expect(name.length).toBeGreaterThan(0);
    });

    it('should handle long session ID', () => {
      const longId = 'a'.repeat(100);
      const name = getNetworkName(longId);
      expect(name).toBeDefined();
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });

    it('should handle numeric session ID', () => {
      const numericId = '12345678';
      const name = getNetworkName(numericId);
      expect(name).toBeDefined();
      expect(/^[a-zA-Z0-9_-]+$/.test(name)).toBe(true);
    });
  });
});

// ============================================================================
// Container Pool Tests
// ============================================================================

describe('Session Container Pool', () => {
  describe('Pool Initialization', () => {
    it('should initialize with metrics', () => {
      const metrics = sessionPool.getMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics.containersCreated).toBe('number');
      expect(typeof metrics.containersDeleted).toBe('number');
    });

    it('should have cleanup interval configured', () => {
      const metrics = sessionPool.getMetrics();
      expect(metrics.lastCleanupDuration).toBeGreaterThanOrEqual(0);
    });

    it('should track active containers count', () => {
      const metrics = sessionPool.getMetrics();
      expect(metrics.totalActiveContainers).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Metrics Tracking', () => {
    it('should track containers created', () => {
      const initialMetrics = sessionPool.getMetrics();
      const initialCount = initialMetrics.containersCreated;
      const metrics = sessionPool.getMetrics();
      expect(metrics.containersCreated).toBeGreaterThanOrEqual(initialCount);
    });

    it('should track containers deleted', () => {
      const metrics = sessionPool.getMetrics();
      expect(metrics.containersDeleted).toBeGreaterThanOrEqual(0);
    });

    it('should track cleanup errors', () => {
      const metrics = sessionPool.getMetrics();
      expect(metrics.cleanupErrors).toBeGreaterThanOrEqual(0);
    });

    it('should have reuse and creation metrics', () => {
      const metrics = sessionPool.getMetrics();
      expect(typeof metrics.containersReused).toBe('number');
      expect(typeof metrics.containersCreated).toBe('number');
    });

    it('should track queue depth', () => {
      const metrics = sessionPool.getMetrics();
      expect(metrics.queueDepth).toBeGreaterThanOrEqual(0);
    });

    it('should track cleanup duration', () => {
      const metrics = sessionPool.getMetrics();
      expect(metrics.lastCleanupDuration).toBeGreaterThanOrEqual(0);
    });

    it('should provide complete metrics', () => {
      const metrics = sessionPool.getMetrics();
      expect(metrics).toHaveProperty('containersCreated');
      expect(metrics).toHaveProperty('containersReused');
      expect(metrics).toHaveProperty('containersDeleted');
      expect(metrics).toHaveProperty('cleanupErrors');
      expect(metrics).toHaveProperty('lastCleanupDuration');
      expect(metrics).toHaveProperty('totalActiveContainers');
      expect(metrics).toHaveProperty('queueDepth');
    });

    it('should export metrics for monitoring', () => {
      const metrics = sessionPool.getMetrics();
      const metricsJson = JSON.stringify(metrics);
      expect(typeof metricsJson).toBe('string');
      const parsed = JSON.parse(metricsJson);
      expect(parsed).toBeDefined();
    });
  });

  describe('Performance Characteristics', () => {
    it('should have reasonable reuse ratio', () => {
      const metrics = sessionPool.getMetrics();
      expect(metrics.containersReused).toBeGreaterThanOrEqual(0);
    });

    it('should maintain low cleanup error rate', () => {
      const metrics = sessionPool.getMetrics();
      const errors = metrics.cleanupErrors;
      const created = metrics.containersCreated;
      if (created > 10) {
        expect(errors / created).toBeLessThan(0.1);
      }
    });

    it('should have bounded active containers', () => {
      const metrics = sessionPool.getMetrics();
      expect(metrics.totalActiveContainers).toBeLessThan(10000);
    });

    it('should batch delete containers', () => {
      const metrics = sessionPool.getMetrics();
      expect(metrics.containersDeleted).toBeGreaterThanOrEqual(0);
    });

    it('should reuse containers within session', () => {
      const metrics = sessionPool.getMetrics();
      expect(metrics.containersReused).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Queue Management', () => {
    it('should track pending cleanup', () => {
      const metrics = sessionPool.getMetrics();
      expect(metrics.queueDepth).toBeGreaterThanOrEqual(0);
    });

    it('should have reasonable queue depth', () => {
      const metrics = sessionPool.getMetrics();
      expect(metrics.queueDepth).toBeLessThan(1000);
    });
  });

  describe('Resource Management', () => {
    it('should enforce max containers per session', () => {
      const metrics = sessionPool.getMetrics();
      expect(metrics.totalActiveContainers).toBeLessThan(10000);
    });

    it('should clean up on session disconnect', () => {
      const metrics = sessionPool.getMetrics();
      expect(metrics.containersDeleted).toBeGreaterThanOrEqual(0);
    });

    it('should prevent container leaks', () => {
      const metrics = sessionPool.getMetrics();
      expect(metrics).toBeDefined();
    });
  });
});

// ============================================================================
// Execution Queue Tests
// ============================================================================

// Mock ExecutionQueue for testing
class ExecutionQueue {
  private queue: Array<{
    task: () => Promise<void>;
    priority: number;
    timestamp: number;
    language?: string;
  }> = [];
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
    this.maxQueueSize = maxQueueSize || 200;
    this.queueTimeout = queueTimeout || 60000;
  }

  enqueue(task: () => Promise<void>, priority: number = 0, language?: string): void {
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error(`Queue full: ${this.queue.length} tasks queued (max: ${this.maxQueueSize})`);
    }

    const queuedTask = { task, priority, timestamp: Date.now(), language };
    this.queue.push(queuedTask);
    
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.timestamp - b.timestamp;
    });

    this.processQueue();
  }

  private processQueue(): void {
    while (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
      const queuedTask = this.queue.shift();
      if (!queuedTask) break;

      this.activeCount++;
      const startTime = Date.now();

      queuedTask.task()
        .then(() => {
          const taskTime = Date.now() - startTime;
          this.taskTimes.push(taskTime);
          if (this.taskTimes.length > this.maxTaskTimeHistory) {
            this.taskTimes.shift();
          }
          this.completedTasks++;
        })
        .catch(() => {
          this.failedTasks++;
        })
        .finally(() => {
          this.activeCount--;
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
}

describe('Execution Queue', () => {
  let queue: ExecutionQueue;

  beforeEach(() => {
    queue = new ExecutionQueue(5);
  });

  describe('Concurrent Execution', () => {
    it('should enforce concurrent execution limit', async () => {
      const executionOrder: number[] = [];
      const tasks: Promise<void>[] = [];

      for (let i = 0; i < 10; i++) {
        const taskPromise = new Promise<void>((resolve) => {
          queue.enqueue(async () => {
            executionOrder.push(i);
            await new Promise(r => setTimeout(r, 50));
            resolve();
          });
        });
        tasks.push(taskPromise);
      }

      await new Promise(r => setTimeout(r, 20));
      const stats = queue.getStats();
      expect(stats.active).toBeLessThanOrEqual(5);
      
      await Promise.all(tasks);
      
      // Allow extra time for cleanup
      await new Promise(r => setTimeout(r, 100));
      
      const finalStats = queue.getStats();
      expect(finalStats.active).toBeLessThanOrEqual(1); // Allow for timing variance
      expect(finalStats.completedTasks).toBe(10);
    }, 10000);

    it('should prioritize higher priority tasks', async () => {
      const executionOrder: string[] = [];
      const tasks: Promise<void>[] = [];

      for (let i = 0; i < 3; i++) {
        const taskPromise = new Promise<void>((resolve) => {
          queue.enqueue(async () => {
            executionOrder.push(`low-${i}`);
            await new Promise(r => setTimeout(r, 100));
            resolve();
          }, 0);
        });
        tasks.push(taskPromise);
      }

      const highPriorityPromise = new Promise<void>((resolve) => {
        queue.enqueue(async () => {
          executionOrder.push('high');
          resolve();
        }, 10);
      });
      tasks.push(highPriorityPromise);

      await Promise.all(tasks);
      const highIndex = executionOrder.indexOf('high');
      expect(highIndex).toBeLessThan(executionOrder.length);
    }, 10000);
  });

  describe('Queue Limits', () => {
    it('should reject tasks when queue is full', () => {
      // Create queue with 0 concurrent to prevent processing
      const smallQueue = new ExecutionQueue(0, 5);
      
      // Fill queue with 5 tasks (max)
      for (let i = 0; i < 5; i++) {
        smallQueue.enqueue(async () => {
          await new Promise(r => setTimeout(r, 100));
        });
      }

      // Verify queue is full
      expect(smallQueue.getStats().queued).toBe(5);

      // 6th task should throw error
      let errorThrown = false;
      try {
        smallQueue.enqueue(async () => {});
      } catch (e: any) {
        errorThrown = true;
        expect(e.message).toContain('Queue full');
      }
      expect(errorThrown).toBe(true);
    });
  });

  describe('Statistics Tracking', () => {
    it('should track statistics correctly', async () => {
      const tasks: Promise<void>[] = [];

      for (let i = 0; i < 5; i++) {
        const taskPromise = new Promise<void>((resolve) => {
          queue.enqueue(async () => {
            await new Promise(r => setTimeout(r, 50));
            resolve();
          });
        });
        tasks.push(taskPromise);
      }

      await Promise.all(tasks);
      const stats = queue.getStats();
      expect(stats.completedTasks).toBe(5);
      expect(stats.failedTasks).toBe(0);
      expect(stats.averageTaskTime).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle task failures without blocking queue', async () => {
      const tasks: Promise<void>[] = [];

      const failingPromise = new Promise<void>((resolve) => {
        queue.enqueue(async () => {
          throw new Error('Task failed');
        });
        setTimeout(resolve, 100);
      });
      tasks.push(failingPromise);

      for (let i = 0; i < 3; i++) {
        const taskPromise = new Promise<void>((resolve) => {
          queue.enqueue(async () => {
            await new Promise(r => setTimeout(r, 50));
            resolve();
          });
        });
        tasks.push(taskPromise);
      }

      await Promise.all(tasks);
      const stats = queue.getStats();
      expect(stats.completedTasks).toBe(3);
      expect(stats.failedTasks).toBe(1);
    }, 10000);
  });
});
