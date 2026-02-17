/**
 * Execution Pipeline Metrics
 *
 * Instruments each stage of the code execution pipeline to provide
 * fine-grained latency breakdowns. Tracks:
 *
 *   queue → network → container → fileTransfer → execution → cleanup
 *
 * Exposes percentile calculations (p50, p95, p99) for each stage
 * and flags slow executions for investigation.
 */

export interface PipelineTimings {
  /** Time spent in the execution queue before processing began */
  queueMs: number;
  /** Time to create or verify the Docker network */
  networkMs: number;
  /** Time to acquire (create or reuse) a container */
  containerMs: number;
  /** Time to transfer files into the container */
  fileTransferMs: number;
  /** Time for the actual code execution */
  executionMs: number;
  /** Time to return container to pool and clean up */
  cleanupMs: number;
  /** Total wall-clock time from enqueue to completion */
  totalMs: number;
  /** Whether this was a container reuse or cold start */
  containerReused: boolean;
  /** Language of the execution */
  language: string;
}

/** Threshold above which an execution is considered "slow" */
const SLOW_EXECUTION_THRESHOLD_MS = 1000;

/** Maximum number of timing records to keep per stage */
const MAX_HISTORY = 500;

class PipelineMetricsService {
  private timings: PipelineTimings[] = [];
  private slowExecutions: PipelineTimings[] = [];
  private readonly maxSlowExecutions = 50;

  /**
   * Record a complete pipeline execution's timings.
   */
  record(timing: PipelineTimings): void {
    this.timings.push(timing);

    // Trim history to prevent unbounded growth
    if (this.timings.length > MAX_HISTORY) {
      this.timings = this.timings.slice(-MAX_HISTORY);
    }

    // Track slow executions separately
    if (timing.totalMs > SLOW_EXECUTION_THRESHOLD_MS) {
      this.slowExecutions.push(timing);
      if (this.slowExecutions.length > this.maxSlowExecutions) {
        this.slowExecutions.shift();
      }
      console.warn(
        `[PipelineMetrics] Slow execution detected (${timing.totalMs}ms): ` +
        `queue=${timing.queueMs}ms network=${timing.networkMs}ms ` +
        `container=${timing.containerMs}ms files=${timing.fileTransferMs}ms ` +
        `exec=${timing.executionMs}ms cleanup=${timing.cleanupMs}ms ` +
        `language=${timing.language} reused=${timing.containerReused}`,
      );
    }
  }

  /**
   * Get percentile statistics for each pipeline stage.
   */
  getStats(): {
    count: number;
    reuseRate: number;
    byStage: Record<string, { p50: number; p95: number; p99: number; avg: number }>;
    byLanguage: Record<string, { count: number; avgTotal: number }>;
    slowExecutions: PipelineTimings[];
  } {
    if (this.timings.length === 0) {
      return {
        count: 0,
        reuseRate: 0,
        byStage: {},
        byLanguage: {},
        slowExecutions: [],
      };
    }

    const stages: (keyof Pick<PipelineTimings, 'queueMs' | 'networkMs' | 'containerMs' | 'fileTransferMs' | 'executionMs' | 'cleanupMs' | 'totalMs'>)[] = [
      'queueMs', 'networkMs', 'containerMs', 'fileTransferMs', 'executionMs', 'cleanupMs', 'totalMs',
    ];

    const byStage: Record<string, { p50: number; p95: number; p99: number; avg: number }> = {};
    for (const stage of stages) {
      const values = this.timings.map((t) => t[stage]).sort((a, b) => a - b);
      byStage[stage] = {
        p50: percentile(values, 50),
        p95: percentile(values, 95),
        p99: percentile(values, 99),
        avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      };
    }

    // Aggregate by language
    const byLanguage: Record<string, { count: number; avgTotal: number }> = {};
    for (const t of this.timings) {
      if (!byLanguage[t.language]) {
        byLanguage[t.language] = { count: 0, avgTotal: 0 };
      }
      byLanguage[t.language].count++;
      byLanguage[t.language].avgTotal += t.totalMs;
    }
    for (const lang of Object.keys(byLanguage)) {
      byLanguage[lang].avgTotal = Math.round(byLanguage[lang].avgTotal / byLanguage[lang].count);
    }

    const reusedCount = this.timings.filter((t) => t.containerReused).length;

    return {
      count: this.timings.length,
      reuseRate: Math.round((reusedCount / this.timings.length) * 100),
      byStage,
      byLanguage,
      slowExecutions: [...this.slowExecutions],
    };
  }

  /**
   * Reset all collected metrics.
   */
  reset(): void {
    this.timings = [];
    this.slowExecutions = [];
    console.log('[PipelineMetrics] Metrics reset');
  }
}

/**
 * Calculate the p-th percentile from a sorted array of numbers.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Helper to create a stopwatch for timing pipeline stages.
 * Usage:
 *   const sw = createStopwatch();
 *   // ... do work ...
 *   const networkMs = sw.lap();  // returns ms since last lap (or creation)
 *   // ... more work ...
 *   const containerMs = sw.lap();
 */
export function createStopwatch(): { lap: () => number; total: () => number } {
  let lastMark = Date.now();
  const start = lastMark;

  return {
    lap(): number {
      const now = Date.now();
      const elapsed = now - lastMark;
      lastMark = now;
      return elapsed;
    },
    total(): number {
      return Date.now() - start;
    },
  };
}

export const pipelineMetrics = new PipelineMetricsService();
