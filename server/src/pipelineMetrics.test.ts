/**
 * Tests for Pipeline Metrics Service
 * Unit tests for the latency tracking and percentile calculation.
 */

import { pipelineMetrics, createStopwatch, type PipelineTimings } from './pipelineMetrics';

describe('PipelineMetrics', () => {
  beforeEach(() => {
    pipelineMetrics.reset();
  });

  describe('record and getStats', () => {
    it('should return empty stats initially', () => {
      const stats = pipelineMetrics.getStats();
      expect(stats.count).toBe(0);
      expect(stats.reuseRate).toBe(0);
      expect(Object.keys(stats.byStage)).toHaveLength(0);
      expect(Object.keys(stats.byLanguage)).toHaveLength(0);
      expect(stats.slowExecutions).toHaveLength(0);
    });

    it('should record a timing entry', () => {
      const timing: PipelineTimings = {
        queueMs: 10,
        networkMs: 20,
        containerMs: 30,
        fileTransferMs: 15,
        executionMs: 200,
        cleanupMs: 5,
        totalMs: 280,
        containerReused: false,
        language: 'python',
      };

      pipelineMetrics.record(timing);
      const stats = pipelineMetrics.getStats();

      expect(stats.count).toBe(1);
      expect(stats.byLanguage['python'].count).toBe(1);
      expect(stats.byLanguage['python'].avgTotal).toBe(280);
    });

    it('should calculate correct reuse rate', () => {
      // 2 reused, 1 cold start = 67% reuse
      pipelineMetrics.record(makeTiming({ containerReused: true, totalMs: 100 }));
      pipelineMetrics.record(makeTiming({ containerReused: true, totalMs: 100 }));
      pipelineMetrics.record(makeTiming({ containerReused: false, totalMs: 500 }));

      const stats = pipelineMetrics.getStats();
      expect(stats.reuseRate).toBe(67);
    });

    it('should aggregate by language', () => {
      pipelineMetrics.record(makeTiming({ language: 'python', totalMs: 100 }));
      pipelineMetrics.record(makeTiming({ language: 'python', totalMs: 200 }));
      pipelineMetrics.record(makeTiming({ language: 'javascript', totalMs: 50 }));

      const stats = pipelineMetrics.getStats();
      expect(stats.byLanguage['python'].count).toBe(2);
      expect(stats.byLanguage['python'].avgTotal).toBe(150);
      expect(stats.byLanguage['javascript'].count).toBe(1);
    });

    it('should track slow executions', () => {
      // Slow: > 1000ms
      pipelineMetrics.record(makeTiming({ totalMs: 1500, language: 'cpp' }));
      pipelineMetrics.record(makeTiming({ totalMs: 200 }));

      const stats = pipelineMetrics.getStats();
      expect(stats.slowExecutions).toHaveLength(1);
      expect(stats.slowExecutions[0].language).toBe('cpp');
    });

    it('should compute percentile stats per stage', () => {
      for (let i = 1; i <= 100; i++) {
        pipelineMetrics.record(makeTiming({
          queueMs: i,
          networkMs: i * 2,
          totalMs: i * 3,
        }));
      }

      const stats = pipelineMetrics.getStats();
      expect(stats.byStage['queueMs'].p50).toBe(50);
      expect(stats.byStage['queueMs'].p95).toBe(95);
      expect(stats.byStage['queueMs'].p99).toBe(99);
    });
  });

  describe('reset', () => {
    it('should clear all data', () => {
      pipelineMetrics.record(makeTiming({ totalMs: 2000 }));
      pipelineMetrics.reset();
      const stats = pipelineMetrics.getStats();
      expect(stats.count).toBe(0);
      expect(stats.slowExecutions).toHaveLength(0);
    });
  });
});

describe('createStopwatch', () => {
  it('should measure elapsed time with lap()', async () => {
    const sw = createStopwatch();
    await sleep(50);
    const lap1 = sw.lap();
    expect(lap1).toBeGreaterThanOrEqual(30); // Allow some timer jitter
    expect(lap1).toBeLessThan(200);
  });

  it('should measure total elapsed time', async () => {
    const sw = createStopwatch();
    await sleep(50);
    sw.lap();
    await sleep(50);
    const total = sw.total();
    expect(total).toBeGreaterThanOrEqual(60);
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTiming(overrides: Partial<PipelineTimings> = {}): PipelineTimings {
  return {
    queueMs: 0,
    networkMs: 0,
    containerMs: 0,
    fileTransferMs: 0,
    executionMs: 0,
    cleanupMs: 0,
    totalMs: 100,
    containerReused: false,
    language: 'python',
    ...overrides,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
