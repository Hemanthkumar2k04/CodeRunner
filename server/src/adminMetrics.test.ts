/**
 * Unit tests for AdminMetricsService
 * 
 * We test the singleton via its public API. Since it uses timers internally
 * (setInterval for system monitoring), we use fake timers to control time flow.
 */

// We can't easily test the singleton because the constructor starts intervals.
// Instead, we test the public API methods of the exported singleton.
import { adminMetrics } from './adminMetrics';

describe('AdminMetricsService', () => {
  beforeEach(() => {
    // Reset all metrics to start clean
    adminMetrics.resetAllMetrics();
  });

  describe('trackRequest', () => {
    it('should track a successful request', () => {
      adminMetrics.trackRequest({
        type: 'websocket',
        language: 'python',
        executionTime: 150,
        success: true,
        sessionId: 'session-1',
        clientId: 'client-1',
      });

      const today = adminMetrics.getTodayMetrics();
      expect(today).toBeDefined();
      expect(today.totalRequests).toBe(1);
      expect(today.successfulRequests).toBe(1);
      expect(today.failedRequests).toBe(0);
    });

    it('should track a failed request', () => {
      adminMetrics.trackRequest({
        type: 'websocket',
        language: 'python',
        executionTime: 50,
        success: false,
        sessionId: 'session-1',
        clientId: 'client-1',
      });

      const today = adminMetrics.getTodayMetrics();
      expect(today.failedRequests).toBe(1);
      expect(today.successfulRequests).toBe(0);
    });

    it('should track requests by language', () => {
      adminMetrics.trackRequest({
        type: 'websocket',
        language: 'python',
        executionTime: 100,
        success: true,
        sessionId: 's1',
        clientId: 'c1',
      });

      adminMetrics.trackRequest({
        type: 'websocket',
        language: 'javascript',
        executionTime: 200,
        success: true,
        sessionId: 's2',
        clientId: 'c2',
      });

      adminMetrics.trackRequest({
        type: 'websocket',
        language: 'python',
        executionTime: 150,
        success: true,
        sessionId: 's3',
        clientId: 'c3',
      });

      const today = adminMetrics.getTodayMetrics();
      expect(today.requestsByLanguage.python).toBe(2);
      expect(today.requestsByLanguage.javascript).toBe(1);
    });

    it('should track requests by type', () => {
      adminMetrics.trackRequest({
        type: 'websocket',
        language: 'python',
        executionTime: 100,
        success: true,
        sessionId: 's1',
        clientId: 'c1',
      });

      adminMetrics.trackRequest({
        type: 'api',
        language: 'python',
        executionTime: 200,
        success: true,
        sessionId: 's2',
        clientId: 'c2',
      });

      const today = adminMetrics.getTodayMetrics();
      expect(today.requestsByType.websocket).toBe(1);
      expect(today.requestsByType.api).toBe(1);
    });

    it('should track unique clients', () => {
      adminMetrics.trackRequest({
        type: 'websocket',
        language: 'python',
        executionTime: 100,
        success: true,
        sessionId: 's1',
        clientId: 'client-1',
      });

      adminMetrics.trackRequest({
        type: 'websocket',
        language: 'python',
        executionTime: 100,
        success: true,
        sessionId: 's2',
        clientId: 'client-1', // Same client
      });

      adminMetrics.trackRequest({
        type: 'websocket',
        language: 'python',
        executionTime: 100,
        success: true,
        sessionId: 's3',
        clientId: 'client-2', // Different client
      });

      const today = adminMetrics.getTodayMetrics();
      expect(today.uniqueClients).toBe(2);
    });

    it('should calculate latency stats', () => {
      const latencies = [100, 200, 300, 400, 500];
      for (const lat of latencies) {
        adminMetrics.trackRequest({
          type: 'websocket',
          language: 'python',
          executionTime: lat,
          success: true,
          sessionId: `s-${lat}`,
          clientId: `c-${lat}`,
        });
      }

      const today = adminMetrics.getTodayMetrics();
      expect(today.latency.average).toBe(300); // (100+200+300+400+500) / 5
      expect(today.latency.lowest).toBe(100);
      expect(today.latency.highest).toBe(500);
      expect(today.latency.median).toBe(300);
    });
  });

  describe('trackContainerCreated', () => {
    it('should track unique containers', () => {
      adminMetrics.trackContainerCreated('container-1');
      adminMetrics.trackContainerCreated('container-2');
      adminMetrics.trackContainerCreated('container-1'); // duplicate

      const today = adminMetrics.getTodayMetrics();
      expect(today.uniqueContainers).toBe(2);
    });
  });

  describe('client tracking', () => {
    it('should track connected clients', () => {
      adminMetrics.trackClientConnected('client-1');
      adminMetrics.trackClientConnected('client-2');

      const state = adminMetrics.getCurrentState();
      expect(state.activeClients).toBe(2);
    });

    it('should track disconnected clients', () => {
      adminMetrics.trackClientConnected('client-1');
      adminMetrics.trackClientConnected('client-2');
      adminMetrics.trackClientDisconnected('client-1');

      const state = adminMetrics.getCurrentState();
      expect(state.activeClients).toBe(1);
    });
  });

  describe('execution tracking', () => {
    it('should track active executions', () => {
      adminMetrics.trackExecutionStarted('exec-1');
      adminMetrics.trackExecutionStarted('exec-2');

      const state = adminMetrics.getCurrentState();
      expect(state.activeExecutions).toBe(2);
    });

    it('should track completed executions', () => {
      adminMetrics.trackExecutionStarted('exec-1');
      adminMetrics.trackExecutionEnded('exec-1');

      const state = adminMetrics.getCurrentState();
      expect(state.activeExecutions).toBe(0);
    });
  });

  describe('takeSnapshot', () => {
    it('should record server snapshots', () => {
      adminMetrics.takeSnapshot(4, 10, 5);
      
      const snapshots = adminMetrics.getRecentSnapshots(10);
      expect(snapshots.length).toBeGreaterThanOrEqual(1);
      const latest = snapshots[snapshots.length - 1];
      expect(latest.activeWorkers).toBe(4);
      expect(latest.activeContainers).toBe(10);
      expect(latest.queuedRequests).toBe(5);
    });
  });

  describe('getDailyMetrics', () => {
    it('should return null for unknown date', () => {
      const result = adminMetrics.getDailyMetrics('1999-01-01');
      expect(result).toBeNull();
    });

    it('should return metrics for today', () => {
      adminMetrics.trackRequest({
        type: 'websocket',
        language: 'python',
        executionTime: 100,
        success: true,
        sessionId: 's1',
        clientId: 'c1',
      });

      const today = adminMetrics.getTodayMetrics();
      expect(today).toBeDefined();
      expect(today.totalRequests).toBe(1);
    });
  });

  describe('success rate', () => {
    it('should calculate 100% success rate', () => {
      adminMetrics.trackRequest({
        type: 'websocket',
        language: 'python',
        executionTime: 100,
        success: true,
        sessionId: 's1',
        clientId: 'c1',
      });

      const today = adminMetrics.getTodayMetrics();
      expect(today.successRate).toBe('100%');
    });

    it('should calculate partial success rate', () => {
      adminMetrics.trackRequest({
        type: 'websocket',
        language: 'python',
        executionTime: 100,
        success: true,
        sessionId: 's1',
        clientId: 'c1',
      });

      adminMetrics.trackRequest({
        type: 'websocket',
        language: 'python',
        executionTime: 100,
        success: false,
        sessionId: 's2',
        clientId: 'c2',
      });

      const today = adminMetrics.getTodayMetrics();
      expect(today.successRate).toBe('50%');
    });
  });

  describe('generateDailyReport', () => {
    it('should generate CSV for existing date', () => {
      adminMetrics.trackRequest({
        type: 'websocket',
        language: 'python',
        executionTime: 100,
        success: true,
        sessionId: 's1',
        clientId: 'c1',
      });

      const todayDate = new Date().toISOString().split('T')[0];
      const csv = adminMetrics.generateDailyReport(todayDate);
      expect(csv).toContain('Metric,Value');
      expect(csv).toContain('Total Requests,1');
      expect(csv).toContain('python');
    });

    it('should return "No data" for nonexistent date', () => {
      const csv = adminMetrics.generateDailyReport('1999-01-01');
      expect(csv).toBe('No data available for this date');
    });
  });

  describe('getAllDailyMetrics', () => {
    it('should return an array of daily metrics', () => {
      adminMetrics.trackRequest({
        type: 'websocket',
        language: 'python',
        executionTime: 100,
        success: true,
        sessionId: 's1',
        clientId: 'c1',
      });

      const all = adminMetrics.getAllDailyMetrics();
      expect(Array.isArray(all)).toBe(true);
      expect(all.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getSummaryStats', () => {
    it('should return summary with today and current state', () => {
      const summary = adminMetrics.getSummaryStats();
      expect(summary).toHaveProperty('today');
      expect(summary).toHaveProperty('totalDaysTracked');
      expect(summary).toHaveProperty('currentState');
      expect(summary).toHaveProperty('recentSnapshots');
    });
  });

  describe('getRequestHistory', () => {
    it('should return request history', () => {
      adminMetrics.trackRequest({
        type: 'websocket',
        language: 'python',
        executionTime: 100,
        success: true,
        sessionId: 's1',
        clientId: 'c1',
      });

      const history = adminMetrics.getRequestHistory();
      expect(history.length).toBe(1);
      expect(history[0].language).toBe('python');
    });

    it('should filter by date range', () => {
      adminMetrics.trackRequest({
        type: 'websocket',
        language: 'python',
        executionTime: 100,
        success: true,
        sessionId: 's1',
        clientId: 'c1',
      });

      const future = new Date(Date.now() + 86400000);
      const history = adminMetrics.getRequestHistory(future);
      expect(history.length).toBe(0);
    });

    it('should respect limit', () => {
      for (let i = 0; i < 5; i++) {
        adminMetrics.trackRequest({
          type: 'websocket',
          language: 'python',
          executionTime: 100,
          success: true,
          sessionId: `s${i}`,
          clientId: `c${i}`,
        });
      }

      const history = adminMetrics.getRequestHistory(undefined, undefined, 3);
      expect(history.length).toBe(3);
    });
  });

  describe('resetAllMetrics', () => {
    it('should clear all data', () => {
      adminMetrics.trackRequest({
        type: 'websocket',
        language: 'python',
        executionTime: 100,
        success: true,
        sessionId: 's1',
        clientId: 'c1',
      });
      adminMetrics.trackClientConnected('c1');
      adminMetrics.trackExecutionStarted('e1');
      adminMetrics.takeSnapshot(1, 1, 1);

      adminMetrics.resetAllMetrics();

      const state = adminMetrics.getCurrentState();
      expect(state.activeClients).toBe(0);
      expect(state.activeExecutions).toBe(0);

      const today = adminMetrics.getTodayMetrics();
      expect(today.totalRequests).toBe(0);
    });
  });

  describe('getSystemMetrics', () => {
    it('should return system metrics object', () => {
      const metrics = adminMetrics.getSystemMetrics();
      expect(metrics).toHaveProperty('cpu');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('uptime');
      expect(metrics).toHaveProperty('load');
      expect(typeof metrics.cpu).toBe('number');
      expect(metrics.memory).toHaveProperty('total');
      expect(metrics.memory).toHaveProperty('free');
      expect(metrics.memory).toHaveProperty('used');
      expect(metrics.memory).toHaveProperty('usagePercentage');
    });
  });
});
