/**
 * Admin Routes - Protected endpoints for server monitoring and management
 * Access via: X-Admin-Key header
 */

import { Router, Request, Response, NextFunction } from 'express';
import { adminMetrics } from './adminMetrics';
import { sessionPool } from './pool';
import { getNetworkStats, getNetworkMetrics, getSubnetStats, resetNetworkMetrics } from './networkManager';
import { pipelineMetrics } from './pipelineMetrics';

import { config } from './config';

const router = Router();

// Admin authentication key (set via environment variable)
// In production, the key MUST be set via ADMIN_KEY env var — server will refuse to start otherwise.
const ADMIN_KEY = process.env.ADMIN_KEY || (config.server.env === 'production' ? '' : 'dev-admin-key-change-in-production');

if (!ADMIN_KEY && config.server.env === 'production') {
  throw new Error('[Admin] FATAL: ADMIN_KEY environment variable is not set. Refusing to start in production without a secure admin key.');
}

if (ADMIN_KEY === 'dev-admin-key-change-in-production') {
  console.warn('[Admin] WARNING: Using default admin key. Set ADMIN_KEY environment variable for production.');
}

/**
 * Admin authentication middleware
 * Reads the key exclusively from the X-Admin-Key header for security.
 * Query parameter auth has been removed to prevent key leakage in URLs, logs, and browser history.
 */
function adminAuth(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-admin-key'];

  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid admin key' });
  }

  next();
}

/**
 * GET /admin - Redirect to client-side admin page (no key in URL)
 */
router.get('/', adminAuth, (req: Request, res: Response) => {
  res.redirect('/#/admin');
});

/**
 * GET /admin/stats - Comprehensive server statistics
 */
router.get('/stats', adminAuth, async (req: Request, res: Response) => {
  try {
    const poolMetrics = sessionPool.getMetrics();
    const sessionCount = sessionPool.getSessionCount();
    const networkStats = await getNetworkStats();
    const networkMetrics = getNetworkMetrics();
    const subnetStats = getSubnetStats();

    // Get execution queue stats - import at runtime to avoid circular dependency
    let queueStats = {
      queued: 0,
      active: 0,
      maxConcurrent: config.sessionContainers.maxConcurrentSessions,
    };

    try {
      const indexModule = await import('./index');
      if (indexModule.executionQueue) {
        queueStats = indexModule.executionQueue.getStats();
      }
    } catch (err) {
      // If we can't import, use default values
      console.warn('[Admin] Could not import executionQueue:', err);
    }

    const stats = {
      timestamp: new Date().toISOString(),
      server: {
        environment: config.server.env,
        port: config.server.port,
        uptime: process.uptime(),
        resources: adminMetrics.getSystemMetrics(),
      },
      executionQueue: queueStats,
      containers: {
        active: sessionCount,
        created: poolMetrics.containersCreated,
        reused: poolMetrics.containersReused,
        deleted: poolMetrics.containersDeleted,
        cleanupErrors: poolMetrics.cleanupErrors,
      },
      networks: {
        total: networkStats.total,
        active: networkStats.withContainers,
        unused: networkStats.empty,
        created: networkMetrics.networksCreated,
        deleted: networkMetrics.networksDeleted,
        cleanupErrors: networkMetrics.cleanupErrors,
      },
      executions: {
        queued: queueStats.queued,
        active: queueStats.active,
        maxConcurrent: queueStats.maxConcurrent,
      },
      clients: adminMetrics.getCurrentState(),
      metrics: adminMetrics.getSummaryStats(),
    };

    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /admin/metrics/today - Today's metrics
 */
router.get('/metrics/today', adminAuth, (req: Request, res: Response) => {
  try {
    const metrics = adminMetrics.getTodayMetrics();
    res.json(metrics || { error: 'No metrics available for today' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /admin/metrics/:date - Metrics for specific date (YYYY-MM-DD)
 */
router.get('/metrics/:date', adminAuth, (req: Request, res: Response) => {
  try {
    const { date } = req.params;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const metrics = adminMetrics.getDailyMetrics(date);

    if (!metrics) {
      return res.status(404).json({ error: `No metrics available for ${date}` });
    }

    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /admin/metrics/all - All available daily metrics
 */
router.get('/metrics/all', adminAuth, (req: Request, res: Response) => {
  try {
    const allMetrics = adminMetrics.getAllDailyMetrics();
    res.json(allMetrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /admin/report/download - Download today's report as CSV
 * Optional query param: ?date=YYYY-MM-DD
 */
router.get('/report/download', adminAuth, (req: Request, res: Response) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const csv = adminMetrics.generateDailyReport(date);

    if (csv === 'No data available for this date') {
      return res.status(404).json({ error: `No data available for ${date}` });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="coderunner-report-${date}.csv"`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /admin/reset - Reset all metrics
 */
router.post('/reset', adminAuth, async (req: Request, res: Response) => {
  try {
    adminMetrics.resetAllMetrics();
    sessionPool.resetMetrics();
    resetNetworkMetrics();

    res.json({
      success: true,
      message: 'All metrics have been reset successfully'
    });
  } catch (error: any) {
    console.error('[Admin] Error resetting metrics:', error);
    res.status(500).json({
      error: `Failed to reset metrics: ${error.message}`
    });
  }
});

/**
 * GET /admin/snapshots - Recent server snapshots
 */
router.get('/snapshots', adminAuth, (req: Request, res: Response) => {
  try {
    const count = parseInt(req.query.count as string) || 60;
    const snapshots = adminMetrics.getRecentSnapshots(count);
    res.json(snapshots);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /admin/history - Request history
 */
router.get('/history', adminAuth, (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const history = adminMetrics.getRequestHistory(startDate, endDate, limit);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /admin/run-load-test - Start a performance load test
 */
router.post('/run-load-test', adminAuth, async (req: Request, res: Response) => {
  try {
    const intensity = (req.query.intensity as string) || 'moderate';

    if (!['light', 'moderate', 'heavy'].includes(intensity)) {
      return res.status(400).json({ error: 'Invalid intensity. Must be: light, moderate, or heavy' });
    }

    // Dynamic import to avoid circular dependencies
    const { startLoadTest } = await import('./testRunner');
    const testId = await startLoadTest(intensity);

    res.json({
      testId,
      intensity,
      status: 'started',
      message: 'Load test started successfully'
    });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to start load test: ${error.message}` });
  }
});

/**
 * GET /admin/load-test-reports - List all load test reports
 */
router.get('/load-test-reports', adminAuth, (req: Request, res: Response) => {
  try {
    const { getReports } = require('../tests/utils/report-manager');
    const reports = getReports();
    res.json(reports);
  } catch (error: any) {
    res.status(500).json({ error: `Failed to get reports: ${error.message}` });
  }
});

/**
 * GET /admin/load-test-reports/:id - Get a specific load test report
 */
router.get('/load-test-reports/:id', adminAuth, (req: Request, res: Response) => {
  try {
    const { getReport } = require('../tests/utils/report-manager');
    const report = getReport(req.params.id);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: `Failed to get report: ${error.message}` });
  }
});

/**
 * DELETE /admin/load-test-reports/:id - Delete a load test report
 */
router.delete('/load-test-reports/:id', adminAuth, (req: Request, res: Response) => {
  try {
    const { deleteReport } = require('../tests/utils/report-manager');
    const success = deleteReport(req.params.id);

    if (!success) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ message: 'Report deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to delete report: ${error.message}` });
  }
});

/**
 * GET /admin/pipeline-metrics - Execution pipeline latency breakdown
 * Returns per-stage p50/p95/p99 percentiles, by-language stats, and slow execution log
 */
router.get('/pipeline-metrics', adminAuth, (req: Request, res: Response) => {
  res.json(pipelineMetrics.getStats());
});

export default router;
export { ADMIN_KEY, adminAuth };
