/**
 * Admin Metrics Tracking Service
 * Tracks detailed metrics for admin dashboard and reporting
 */

import * as os from 'os';

export interface RequestMetrics {
  requestId: string;
  timestamp: Date;
  type: 'websocket' | 'api';
  language: string;
  executionTime: number; // milliseconds
  success: boolean;
  sessionId: string;
  clientId: string; // socket.id or unique client identifier
}

export interface SystemMetrics {
  cpu: number; // Percentage 0-100
  memory: {
    total: number; // Bytes
    free: number; // Bytes
    used: number; // Bytes
    usagePercentage: number;
    process: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
    };
  };
  uptime: number; // Seconds
  load: number[]; // Load average [1m, 5m, 15m]
}

export interface DailyMetrics {
  date: string; // YYYY-MM-DD format
  uniqueContainers: Set<string>;
  uniqueClients: Set<string>;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  requestLatencies: number[];
  requestsByLanguage: Map<string, number>;
  requestsByType: Map<string, number>;
}

export interface ServerSnapshot {
  timestamp: Date;
  activeWorkers: number;
  activeContainers: number;
  activeClients: number;
  activeExecutions: number;
  queuedRequests: number;
}

class AdminMetricsService {
  private dailyMetrics: Map<string, DailyMetrics> = new Map();
  private requestHistory: RequestMetrics[] = [];
  private maxRequestHistory: number = 10000; // Keep last 10k requests in memory
  private maxLatenciesPerDay: number = 10000; // Cap latencies per day to bound memory
  private activeClients: Set<string> = new Set();
  private activeExecutions: Set<string> = new Set();
  private serverSnapshots: ServerSnapshot[] = [];
  private maxSnapshots: number = 1440; // Keep 24 hours of minute-by-minute snapshots
  
  // System monitoring
  private systemMetrics: SystemMetrics = {
    cpu: 0,
    memory: { 
      total: 0, 
      free: 0, 
      used: 0, 
      usagePercentage: 0, 
      process: { rss: 0, heapTotal: 0, heapUsed: 0 } 
    },
    uptime: 0,
    load: [],
  };
  private lastCpuUsage: { total: number; idle: number } = { total: 0, idle: 0 };

  constructor() {
    // Initialize today's metrics
    this.initializeDailyMetrics(this.getTodayDate());
    this.startSystemMonitor();
    
    // Clean up old metrics every 24 hours
    setInterval(() => this.cleanupOldMetrics(), 24 * 60 * 60 * 1000);
  }

  private startSystemMonitor() {
    // Initial CPU reading
    this.updateSystemMetrics();
    
    // Update every 2 seconds
    setInterval(() => {
        this.updateSystemMetrics();
    }, 2000);
  }

  private updateSystemMetrics() {
    // CPU
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
        for (const type in cpu.times) {
            totalTick += (cpu.times as any)[type];
        }
        totalIdle += cpu.times.idle;
    }

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;

    if (this.lastCpuUsage.total > 0) {
        const idleDiff = idle - this.lastCpuUsage.idle;
        const totalDiff = total - this.lastCpuUsage.total;
        // avoid division by zero
        const percentage = totalDiff > 0 ? 100 - (100 * idleDiff / totalDiff) : 0;
        this.systemMetrics.cpu = Math.max(0, Math.min(100, parseFloat(percentage.toFixed(1))));
    }

    this.lastCpuUsage = { idle, total };

    // Memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const procMem = process.memoryUsage();

    this.systemMetrics.memory = {
      total: totalMem,
      free: freeMem,
      used: usedMem,
      usagePercentage: parseFloat(((usedMem / totalMem) * 100).toFixed(1)),
      process: {
        rss: procMem.rss,
        heapTotal: procMem.heapTotal,
        heapUsed: procMem.heapUsed
      }
    };

    this.systemMetrics.uptime = os.uptime();
    this.systemMetrics.load = os.loadavg();
  }

  public getSystemMetrics(): SystemMetrics {
    return this.systemMetrics;
  }

  /**
   * Get today's date in YYYY-MM-DD format
   */
  private getTodayDate(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * Initialize daily metrics for a given date
   */
  private initializeDailyMetrics(date: string): DailyMetrics {
    if (!this.dailyMetrics.has(date)) {
      this.dailyMetrics.set(date, {
        date,
        uniqueContainers: new Set(),
        uniqueClients: new Set(),
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        requestLatencies: [],
        requestsByLanguage: new Map(),
        requestsByType: new Map(),
      });
    }
    return this.dailyMetrics.get(date)!;
  }

  /**
   * Track a new request execution
   */
  trackRequest(request: Omit<RequestMetrics, 'requestId' | 'timestamp'>): void {
    const requestId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const fullRequest: RequestMetrics = {
      requestId,
      timestamp: new Date(),
      ...request,
    };

    // Add to request history
    this.requestHistory.push(fullRequest);
    if (this.requestHistory.length > this.maxRequestHistory) {
      this.requestHistory.shift();
    }

    // Update daily metrics
    const date = this.getTodayDate();
    const metrics = this.initializeDailyMetrics(date);
    
    metrics.totalRequests++;
    if (request.success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }
    
    metrics.requestLatencies.push(request.executionTime);
    // Cap latencies array to prevent unbounded memory growth
    if (metrics.requestLatencies.length > this.maxLatenciesPerDay) {
      metrics.requestLatencies.shift();
    }
    metrics.uniqueClients.add(request.clientId);
    
    // Update language stats
    const langCount = metrics.requestsByLanguage.get(request.language) || 0;
    metrics.requestsByLanguage.set(request.language, langCount + 1);
    
    // Update type stats
    const typeCount = metrics.requestsByType.get(request.type) || 0;
    metrics.requestsByType.set(request.type, typeCount + 1);
  }

  /**
   * Track container creation
   */
  trackContainerCreated(containerId: string, date?: string): void {
    const targetDate = date || this.getTodayDate();
    const metrics = this.initializeDailyMetrics(targetDate);
    metrics.uniqueContainers.add(containerId);
  }

  /**
   * Track client connection
   */
  trackClientConnected(clientId: string): void {
    this.activeClients.add(clientId);
    const date = this.getTodayDate();
    const metrics = this.initializeDailyMetrics(date);
    metrics.uniqueClients.add(clientId);
  }

  /**
   * Track client disconnection
   */
  trackClientDisconnected(clientId: string): void {
    this.activeClients.delete(clientId);
  }

  /**
   * Track execution start
   */
  trackExecutionStarted(executionId: string): void {
    this.activeExecutions.add(executionId);
  }

  /**
   * Track execution end
   */
  trackExecutionEnded(executionId: string): void {
    this.activeExecutions.delete(executionId);
  }

  /**
   * Take a snapshot of current server state
   */
  takeSnapshot(workers: number, containers: number, queuedRequests: number): void {
    const snapshot: ServerSnapshot = {
      timestamp: new Date(),
      activeWorkers: workers,
      activeContainers: containers,
      activeClients: this.activeClients.size,
      activeExecutions: this.activeExecutions.size,
      queuedRequests,
    };

    this.serverSnapshots.push(snapshot);
    if (this.serverSnapshots.length > this.maxSnapshots) {
      this.serverSnapshots.shift();
    }
  }

  /**
   * Get daily metrics for a specific date
   */
  getDailyMetrics(date: string): any {
    const metrics = this.dailyMetrics.get(date);
    if (!metrics) {
      return null;
    }

    return this.formatDailyMetrics(metrics);
  }

  /**
   * Get today's metrics
   */
  getTodayMetrics(): any {
    return this.getDailyMetrics(this.getTodayDate());
  }

  /**
   * Format daily metrics for JSON response
   */
  private formatDailyMetrics(metrics: DailyMetrics): any {
    const latencies = metrics.requestLatencies;
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    
    return {
      date: metrics.date,
      uniqueContainers: metrics.uniqueContainers.size,
      uniqueClients: metrics.uniqueClients.size,
      totalRequests: metrics.totalRequests,
      successfulRequests: metrics.successfulRequests,
      failedRequests: metrics.failedRequests,
      successRate: metrics.totalRequests > 0 
        ? (metrics.successfulRequests === metrics.totalRequests 
            ? '100%' 
            : Math.round((metrics.successfulRequests / metrics.totalRequests) * 100) + '%')
        : '0%',
      latency: {
        average: latencies.length > 0 
          ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
          : 0,
        lowest: sortedLatencies.length > 0 ? sortedLatencies[0] : 0,
        highest: sortedLatencies.length > 0 ? sortedLatencies[sortedLatencies.length - 1] : 0,
        median: sortedLatencies.length > 0 
          ? sortedLatencies[Math.floor(sortedLatencies.length / 2)]
          : 0,
        p95: sortedLatencies.length > 0
          ? sortedLatencies[Math.floor(sortedLatencies.length * 0.95)]
          : 0,
        p99: sortedLatencies.length > 0
          ? sortedLatencies[Math.floor(sortedLatencies.length * 0.99)]
          : 0,
      },
      requestsByLanguage: Object.fromEntries(metrics.requestsByLanguage),
      requestsByType: Object.fromEntries(metrics.requestsByType),
    };
  }

  /**
   * Get all available daily metrics
   */
  getAllDailyMetrics(): any[] {
    return Array.from(this.dailyMetrics.keys())
      .sort()
      .reverse()
      .map(date => this.getDailyMetrics(date));
  }

  /**
   * Get current server state
   */
  getCurrentState(): any {
    return {
      activeClients: this.activeClients.size,
      activeExecutions: this.activeExecutions.size,
      totalRequestsToday: this.getTodayMetrics()?.totalRequests || 0,
    };
  }

  /**
   * Get recent snapshots
   */
  getRecentSnapshots(count: number = 60): ServerSnapshot[] {
    return this.serverSnapshots.slice(-count);
  }

  /**
   * Get request history for a date range
   */
  getRequestHistory(startDate?: Date, endDate?: Date, limit: number = 100): RequestMetrics[] {
    let filtered = this.requestHistory;
    
    if (startDate) {
      filtered = filtered.filter(r => r.timestamp >= startDate);
    }
    
    if (endDate) {
      filtered = filtered.filter(r => r.timestamp <= endDate);
    }
    
    return filtered.slice(-limit);
  }

  /**
   * Generate CSV report for a specific date
   */
  generateDailyReport(date: string): string {
    const metrics = this.dailyMetrics.get(date);
    if (!metrics) {
      return 'No data available for this date';
    }

    const formatted = this.formatDailyMetrics(metrics);
    
    // CSV Header
    let csv = 'Metric,Value\n';
    
    // Basic metrics
    csv += `Date,${formatted.date}\n`;
    csv += `Unique Containers,${formatted.uniqueContainers}\n`;
    csv += `Unique Clients,${formatted.uniqueClients}\n`;
    csv += `Total Requests,${formatted.totalRequests}\n`;
    csv += `Successful Requests,${formatted.successfulRequests}\n`;
    csv += `Failed Requests,${formatted.failedRequests}\n`;
    csv += `Success Rate,${formatted.successRate}\n`;
    csv += '\n';
    
    // Latency metrics
    csv += `Average Latency (ms),${formatted.latency.average}\n`;
    csv += `Lowest Latency (ms),${formatted.latency.lowest}\n`;
    csv += `Highest Latency (ms),${formatted.latency.highest}\n`;
    csv += `Median Latency (ms),${formatted.latency.median}\n`;
    csv += `95th Percentile Latency (ms),${formatted.latency.p95}\n`;
    csv += `99th Percentile Latency (ms),${formatted.latency.p99}\n`;
    csv += '\n';
    
    // Requests by language
    csv += 'Language,Request Count\n';
    for (const [lang, count] of Object.entries(formatted.requestsByLanguage)) {
      csv += `${lang},${count}\n`;
    }
    csv += '\n';
    
    // Requests by type
    csv += 'Request Type,Count\n';
    for (const [type, count] of Object.entries(formatted.requestsByType)) {
      csv += `${type},${count}\n`;
    }
    
    return csv;
  }

  /**
   * Clean up metrics older than 30 days
   */
  private cleanupOldMetrics(): void {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];
    
    for (const date of this.dailyMetrics.keys()) {
      if (date < cutoffDate) {
        this.dailyMetrics.delete(date);
        console.log(`[AdminMetrics] Cleaned up metrics for date: ${date}`);
      }
    }
  }

  /**
   * Get summary statistics
   */
  getSummaryStats(): any {
    const todayMetrics = this.getTodayMetrics();
    const allMetrics = this.getAllDailyMetrics();
    
    return {
      today: todayMetrics,
      totalDaysTracked: allMetrics.length,
      currentState: this.getCurrentState(),
      recentSnapshots: this.getRecentSnapshots(10),
    };
  }

  /**
   * Reset all metrics
   * Clears all tracked data and reinitializes with clean state
   */
  resetAllMetrics(): void {
    this.dailyMetrics.clear();
    this.requestHistory = [];
    this.activeClients.clear();
    this.activeExecutions.clear();
    this.serverSnapshots = [];
    
    // Re-initialize today's metrics
    this.initializeDailyMetrics(this.getTodayDate());
    
    console.log('[AdminMetrics] All metrics have been reset');
  }
}

// Singleton instance
export const adminMetrics = new AdminMetricsService();
