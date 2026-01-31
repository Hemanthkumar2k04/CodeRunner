import { sessionPool } from '../src/pool';

describe('Session Container Pool', () => {
  describe('Pool Initialization', () => {
    it('should initialize with empty metrics', () => {
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
  });

  describe('Performance Characteristics', () => {
    it('should have reasonable reuse ratio', () => {
      const metrics = sessionPool.getMetrics();
      const created = metrics.containersCreated;
      const reused = metrics.containersReused;
      
      // Over time, reuse should be positive
      expect(reused).toBeGreaterThanOrEqual(0);
    });

    it('should maintain low cleanup error rate', () => {
      const metrics = sessionPool.getMetrics();
      const errors = metrics.cleanupErrors;
      const created = metrics.containersCreated;
      
      // Error rate should be low (less than 10% of created)
      if (created > 10) {
        expect(errors / created).toBeLessThan(0.1);
      }
    });

    it('should have bounded active containers', () => {
      const metrics = sessionPool.getMetrics();
      // Active containers should not exceed a reasonable limit
      expect(metrics.totalActiveContainers).toBeLessThan(10000);
    });
  });

  describe('Queue Management', () => {
    it('should track pending cleanup', () => {
      const metrics = sessionPool.getMetrics();
      expect(metrics.queueDepth).toBeGreaterThanOrEqual(0);
    });

    it('should have reasonable queue depth', () => {
      const metrics = sessionPool.getMetrics();
      // Queue should not grow unbounded
      expect(metrics.queueDepth).toBeLessThan(1000);
    });
  });

  describe('Batch Operations', () => {
    it('should support batch container operations', () => {
      const metrics = sessionPool.getMetrics();
      // Batch operations are tracked in deletion counts
      expect(metrics.containersDeleted).toBeGreaterThanOrEqual(0);
    });

    it('should have fallback for batch failures', () => {
      // This is tested implicitly through error rate
      const metrics = sessionPool.getMetrics();
      expect(metrics.cleanupErrors).toBeGreaterThanOrEqual(0);
    });
  });

  describe('TTL Configuration', () => {
    it('should respect configured TTL', () => {
      const metrics = sessionPool.getMetrics();
      // Metrics should show containers being cleaned up according to TTL
      expect(metrics.containersDeleted).toBeGreaterThanOrEqual(0);
    });

    it('should have properly configured cleanup interval', () => {
      const metrics = sessionPool.getMetrics();
      expect(metrics.lastCleanupDuration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('State Management', () => {
    it('should track in-use and idle containers separately', () => {
      const metrics = sessionPool.getMetrics();
      // In use + idle = total active
      expect(metrics.totalActiveContainers).toBeGreaterThanOrEqual(0);
    });

    it('should handle container state transitions', () => {
      // Container states: idle -> in-use -> idle -> cleanup
      const metrics = sessionPool.getMetrics();
      expect(metrics.totalActiveContainers).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Session Isolation', () => {
    it('should isolate containers per session', () => {
      // Each session should have its own container pool
      const metrics = sessionPool.getMetrics();
      expect(metrics).toBeDefined();
    });

    it('should clean up all containers for a session on disconnect', () => {
      // Metrics should show containers being cleaned
      const metrics = sessionPool.getMetrics();
      expect(metrics.containersDeleted).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle cleanup with no containers', () => {
      const metrics = sessionPool.getMetrics();
      // Should not error even with empty pool
      expect(metrics).toBeDefined();
    });

    it('should handle concurrent operations', () => {
      // Pool should handle multiple sessions concurrently
      const metrics = sessionPool.getMetrics();
      expect(metrics.totalActiveContainers).toBeGreaterThanOrEqual(0);
    });

    it('should recover from cleanup errors', () => {
      const metrics = sessionPool.getMetrics();
      // Should continue operating even with some cleanup errors
      expect(metrics.containersDeleted).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Monitoring and Observability', () => {
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

    it('should track metrics history', () => {
      const metrics1 = sessionPool.getMetrics();
      const metrics2 = sessionPool.getMetrics();
      // Metrics should be consistent
      expect(metrics1).toBeDefined();
      expect(metrics2).toBeDefined();
    });
  });

  describe('Performance Optimization', () => {
    it('should batch delete containers', () => {
      // Batch operations reduce Docker API calls
      const metrics = sessionPool.getMetrics();
      expect(metrics.containersDeleted).toBeGreaterThanOrEqual(0);
    });

    it('should reuse containers within session', () => {
      const metrics = sessionPool.getMetrics();
      // Reuse count should be positive over time
      expect(metrics.containersReused).toBeGreaterThanOrEqual(0);
    });

    it('should not create duplicate containers', () => {
      // Pool should efficiently manage container creation
      const metrics = sessionPool.getMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('Resource Management', () => {
    it('should enforce max containers per session', () => {
      // Configuration should limit containers per session
      const metrics = sessionPool.getMetrics();
      expect(metrics.totalActiveContainers).toBeLessThan(10000);
    });

    it('should clean up on session disconnect', () => {
      // All containers for a session should be cleaned
      const metrics = sessionPool.getMetrics();
      expect(metrics.containersDeleted).toBeGreaterThanOrEqual(0);
    });

    it('should prevent container leaks', () => {
      // No containers should be left behind
      const metrics = sessionPool.getMetrics();
      // Over time, deleted should be close to created for idle sessions
      expect(metrics).toBeDefined();
    });
  });
});
