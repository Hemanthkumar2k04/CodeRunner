import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from './config';
import { adminMetrics } from './adminMetrics';

const execAsync = promisify(exec);

/**
 * Session Container with TTL
 * Represents a container associated with a user session
 */
interface SessionContainer {
  containerId: string;
  language: string;
  sessionId: string;
  networkName: string;
  lastUsed: number;    // timestamp
  inUse: boolean;      // whether container is currently executing code
}

/**
 * Cleanup metrics for monitoring pool performance
 */
interface CleanupMetrics {
  containersCreated: number;
  containersReused: number;
  containersDeleted: number;
  cleanupErrors: number;
  lastCleanupDuration: number;
  totalActiveContainers: number;
  queueDepth: number; // containers pending cleanup
}

/**
 * Session-Based Container Pool with TTL
 * All containers are created with networking and associated with user sessions.
 * Containers are reused within the same session and deleted after TTL expiry or disconnect.
 */
class SessionContainerPool {
  // Map: sessionId -> array of containers for that session
  private pool: Map<string, SessionContainer[]> = new Map();

  // Mutex: pending container acquisition promises to prevent race conditions
  // Key: "sessionId:language" -> Promise that resolves to containerId
  private pendingAcquisitions: Map<string, Promise<string>> = new Map();

  // Cleanup metrics
  private metrics: CleanupMetrics = {
    containersCreated: 0,
    containersReused: 0,
    containersDeleted: 0,
    cleanupErrors: 0,
    lastCleanupDuration: 0,
    totalActiveContainers: 0,
    queueDepth: 0,
  };

  constructor() {
    console.log('[Pool] Initialized session-based container pool with TTL');
  }

  /**
   * Reset all pool metrics
   */
  resetMetrics(): void {
    const currentActive = this.metrics.totalActiveContainers; // Preserve current active count

    this.metrics = {
      containersCreated: 0,
      containersReused: 0,
      containersDeleted: 0,
      cleanupErrors: 0,
      lastCleanupDuration: 0,
      totalActiveContainers: currentActive, // Don't reset this to 0 if containers exist
      queueDepth: 0,
    };

    console.log('[Pool] Metrics have been reset');
  }

  /**
   * Cleanup expired containers (TTL exceeded)
   * Called by background job
   */
  async cleanupExpiredContainers(): Promise<void> {
    const startTime = Date.now();
    const now = Date.now();
    const ttl = config.sessionContainers.ttl;
    let cleanedCount = 0;

    // 1. Clean up expired containers from the pool
    for (const [sessionId, containers] of this.pool.entries()) {
      const expiredContainers = containers.filter(
        c => !c.inUse && (now - c.lastUsed) > ttl
      );

      if (expiredContainers.length > 0) {
        console.log(`[Pool] Cleaning up ${expiredContainers.length} expired containers for session ${sessionId}`);

        // Batch delete containers for better performance
        const containerIds = expiredContainers.map(c => c.containerId);
        const batchSize = 10;

        for (let i = 0; i < containerIds.length; i += batchSize) {
          const batch = containerIds.slice(i, i + batchSize);
          const batchCommand = `docker rm -fv ${batch.join(' ')}`;

          try {
            await execAsync(batchCommand, { timeout: config.docker.commandTimeout });
            cleanedCount += batch.length;
            this.metrics.containersDeleted += batch.length;
            console.log(`[Pool] Deleted ${batch.length} expired containers`);
          } catch (error: any) {
            // Fallback to individual
            for (const containerId of batch) {
              try {
                await execAsync(`docker rm -fv ${containerId}`, { timeout: config.docker.commandTimeout });
                cleanedCount++;
                this.metrics.containersDeleted++;
              } catch (e: any) {
                console.warn(`[Pool] Failed to delete expired container ${containerId.substring(0, 12)}: ${e.message}`);
                this.metrics.cleanupErrors++;
              }
            }
          }
        }

        // Remove from pool
        const remainingContainers = containers.filter(
          c => !expiredContainers.includes(c)
        );

        if (remainingContainers.length > 0) {
          this.pool.set(sessionId, remainingContainers);
        } else {
          this.pool.delete(sessionId);
        }
      }
    }

    // 2. Safety Net: Find any "coderunner-session" containers that are orphaned or too old
    // We check for containers created > 10 minutes ago as a safety measure against leaks
    try {
      // Find all session containers
      const { stdout } = await execAsync('docker ps -a --filter "label=type=coderunner-session" --format "{{.ID}}|{{.CreatedAt}}"');
      if (stdout.trim()) {
        const lines = stdout.trim().split('\n');
        const activeContainerIds = new Set<string>();

        // Collect IDs of all containers currently known in our pool
        for (const containers of this.pool.values()) {
          for (const c of containers) {
            activeContainerIds.add(c.containerId);
            activeContainerIds.add(c.containerId.substring(0, 12));
          }
        }

        for (const line of lines) {
          const [id, createdStr] = line.split('|');
          // If container is NOT in our active pool
          if (!activeContainerIds.has(id)) {
            // Also check age to avoid race condition with just-created containers
            // (Though pool updates happen before docker run returns usually, async/await timing might vary)
            // Ideally we parse CreatedAt, but for now assuming if it's not in pool it's orphaned 
            // IF it's not brand new. 
            // Let's rely on the fact that if it's not in pool, we don't know about it.

            console.log(`[Pool] Found orphaned/zombie container ${id} (not in active pool). Removing...`);
            try {
              await execAsync(`docker rm -fv ${id}`);
              this.metrics.containersDeleted++;
              cleanedCount++;
            } catch (e: any) {
              console.warn(`[Pool] Failed to remove orphaned container ${id}: ${e.message}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('[Pool] Safety net cleanup failed:', error);
    }

    const cleanupDuration = Date.now() - startTime;
    this.metrics.lastCleanupDuration = cleanupDuration;

    if (cleanedCount > 0) {
      console.log(`[Pool] TTL cleanup completed: deleted ${cleanedCount} expired/orphaned containers`);
    }
  }

  /**
   * Cleanup all containers for a specific session (on disconnect)
   */
  getMetrics(): CleanupMetrics {
    // Update active container count
    this.metrics.totalActiveContainers = Array.from(this.pool.values())
      .reduce((sum, containers) => sum + containers.length, 0);

    // Calculate queue depth (expired but not deleted yet)
    const now = Date.now();
    const ttl = config.sessionContainers.ttl;
    this.metrics.queueDepth = Array.from(this.pool.values())
      .flat()
      .filter(c => !c.inUse && (now - c.lastUsed) > ttl)
      .length;

    return { ...this.metrics };
  }

  /**
   * Get or create a container for the session and language
   * Reuses existing containers within the same session or creates new ones.
   * Uses a promise-based mutex to prevent race conditions when multiple
   * concurrent requests try to acquire a container for the same session+language.
   */
  async getOrCreateContainer(
    language: string,
    sessionId: string,
    networkName: string
  ): Promise<string> {
    const runtimeConfig = config.runtimes[language as keyof typeof config.runtimes];
    if (!runtimeConfig) {
      throw new Error(`Unknown language: ${language}`);
    }

    // Check if session has an available container (fast path, no mutex needed)
    const sessionContainers = this.pool.get(sessionId) || [];
    const existingContainer = sessionContainers.find(
      c => c.language === language && !c.inUse
    );

    if (existingContainer) {
      existingContainer.inUse = true;
      existingContainer.lastUsed = Date.now();
      this.metrics.containersReused++;
      console.log(`[Pool] Reusing container for ${sessionId}:${language} - ${existingContainer.containerId.substring(0, 12)}`);
      return existingContainer.containerId;
    }

    // No available container — use mutex to prevent duplicate creation
    const mutexKey = `${sessionId}:${language}`;
    const pendingPromise = this.pendingAcquisitions.get(mutexKey);
    if (pendingPromise) {
      // Another request is already creating a container for this session+language.
      // Wait for it, then check again for an available container.
      console.log(`[Pool] Waiting for pending container acquisition: ${mutexKey}`);
      await pendingPromise;
      // Re-check after the pending creation completes
      const updatedContainers = this.pool.get(sessionId) || [];
      const nowAvailable = updatedContainers.find(
        c => c.language === language && !c.inUse
      );
      if (nowAvailable) {
        nowAvailable.inUse = true;
        nowAvailable.lastUsed = Date.now();
        this.metrics.containersReused++;
        console.log(`[Pool] Reusing container after mutex wait for ${sessionId}:${language} - ${nowAvailable.containerId.substring(0, 12)}`);
        return nowAvailable.containerId;
      }
    }

    // Create new container with mutex
    console.log(`[Pool] Creating new container for ${sessionId}:${language}`);
    const creationPromise = this.createContainer(language, sessionId, networkName);
    this.pendingAcquisitions.set(mutexKey, creationPromise);

    try {
      const containerId = await creationPromise;

      this.metrics.containersCreated++;
      adminMetrics.trackContainerCreated(containerId);

      const newContainer: SessionContainer = {
        containerId,
        language,
        sessionId,
        networkName,
        lastUsed: Date.now(),
        inUse: true,
      };

      const currentContainers = this.pool.get(sessionId) || [];
      currentContainers.push(newContainer);
      this.pool.set(sessionId, currentContainers);

      console.log(`[Pool] Created container ${containerId.substring(0, 12)} for ${sessionId}:${language}`);
      return containerId;
    } finally {
      this.pendingAcquisitions.delete(mutexKey);
    }
  }

  /**
   * Return container to pool after execution
   * Cleans container data and updates lastUsed timestamp
   */
  async returnContainer(containerId: string, sessionId: string): Promise<void> {
    const sessionContainers = this.pool.get(sessionId);
    if (!sessionContainers) {
      console.warn(`[Pool] No containers found for session ${sessionId}`);
      return;
    }

    const container = sessionContainers.find(c => c.containerId === containerId);
    if (container) {
      // Clean container data before returning to pool
      await this.cleanContainer(containerId);

      container.inUse = false;
      container.lastUsed = Date.now();
      console.log(`[Pool] Returned container ${containerId.substring(0, 12)} to pool (cleaned and TTL refreshed)`);
    }
  }

  /**
   * Clean all data from a container's /app directory and temporary build artifacts
   * This ensures no previous execution data remains when container is reused
   */
  private async cleanContainer(containerId: string): Promise<void> {
    try {
      // Remove all files from /app directory and clean temp/build artifacts
      await execAsync(`docker exec ${containerId} sh -c "rm -rf /app/* /app/.* /tmp/* 2>/dev/null || true"`, { timeout: config.docker.commandTimeout });
      console.log(`[Pool] Cleaned container ${containerId.substring(0, 12)}`);
    } catch (error: any) {
      console.error(`[Pool] Failed to clean container ${containerId.substring(0, 12)}:`, error.message);
      // Don't throw - container can still be used
    }
  }

  /**
   * Create a new container with networking
   */
  private async createContainer(
    language: string,
    sessionId: string,
    networkName: string
  ): Promise<string> {
    const runtimeConfig = config.runtimes[language as keyof typeof config.runtimes];

    try {
      const memory = language === 'sql' ? config.docker.memorySQL : config.docker.memory;

      let dockerCmd = [
        'docker run -d',
        `--label type=coderunner-session`,
        `--label session=${sessionId}`,
        `--label language=${language}`,
        `--network ${networkName}`,
        `--memory ${memory}`,
        `--cpus ${config.docker.cpus}`,
      ].join(' ');

      // MySQL needs special environment variables
      if (language === 'sql') {
        dockerCmd += ` -e MYSQL_ROOT_PASSWORD=root`;
      }

      dockerCmd += ` ${runtimeConfig.image}`;

      // Add command to keep container alive (MySQL has its own entrypoint)
      if (language !== 'sql') {
        dockerCmd += ` tail -f /dev/null`;
      }

      console.log(`[Pool] Executing: ${dockerCmd}`);
      const { stdout } = await execAsync(dockerCmd, { timeout: config.docker.commandTimeout });
      const containerId = stdout.trim();
      console.log(`[Pool] Container created successfully: ${containerId.substring(0, 12)}`);

      // For MySQL, wait for initialization with readiness polling
      if (language === 'sql') {
        console.log(`[Pool] Waiting for MySQL to initialize...`);
        await this.waitForMySQLReady(containerId, 30000);
      }

      return containerId;
    } catch (error: any) {
      console.error(`[Pool] Failed to create container:`, error.message);
      throw error;
    }
  }

  /**
   * Wait for MySQL container to become ready by polling mysqladmin ping.
   * Returns as soon as MySQL responds, or throws if timeout is exceeded.
   */
  private async waitForMySQLReady(containerId: string, timeoutMs: number = 30000): Promise<void> {
    const pollInterval = 1000; // 1 second between polls
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        await execAsync(
          `docker exec ${containerId} mysqladmin ping -u root -proot --silent`,
          { timeout: 5000 }
        );
        console.log(`[Pool] MySQL is ready in container ${containerId.substring(0, 12)} (${Date.now() - startTime}ms)`);
        return;
      } catch {
        // MySQL not ready yet, wait and retry
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error(`MySQL failed to become ready within ${timeoutMs}ms in container ${containerId.substring(0, 12)}`);
  }

  /**
   * Cleanup all containers for a specific session (on disconnect)
   */
  async cleanupSession(sessionId: string): Promise<void> {
    const sessionContainers = this.pool.get(sessionId);
    if (!sessionContainers || sessionContainers.length === 0) {
      return;
    }

    console.log(`[Pool] Cleaning up ${sessionContainers.length} containers for session ${sessionId}`);

    // Batch delete all containers for the session
    const containerIds = sessionContainers.map(c => c.containerId);

    try {
      if (containerIds.length > 0) {
        await execAsync(`docker rm -fv ${containerIds.join(' ')}`, { timeout: config.docker.commandTimeout });
        this.metrics.containersDeleted += containerIds.length;
        console.log(`[Pool] Deleted ${containerIds.length} containers for session ${sessionId}`);
      }
    } catch (error: any) {
      // If batch fails, try individually
      console.error(`[Pool] Batch deletion failed for session ${sessionId}, trying individually:`, error.message);
      this.metrics.cleanupErrors++;

      for (const containerId of containerIds) {
        try {
          await execAsync(`docker rm -fv ${containerId}`, { timeout: config.docker.commandTimeout });
          this.metrics.containersDeleted++;
        } catch (individualError: any) {
          console.error(`[Pool] Failed to delete container ${containerId.substring(0, 12)}:`, individualError.message);
          this.metrics.cleanupErrors++;
        }
      }
    }

    this.pool.delete(sessionId);
    console.log(`[Pool] Session ${sessionId} cleanup completed`);
  }

  /**
   * Cleanup all containers (on server shutdown)
   */
  async cleanupAll(): Promise<void> {
    console.log('[Pool] Cleaning up all session containers...');

    try {
      const { stdout } = await execAsync('docker ps -aq --filter label=type=coderunner-session');
      if (stdout.trim()) {
        const containerIds = stdout.trim().split('\n');
        console.log(`[Pool] Found ${containerIds.length} containers to clean up`);
        await execAsync(`docker rm -fv ${stdout.trim().replace(/\n/g, ' ')}`);
        console.log('[Pool] All session containers cleaned up');
      }
    } catch (error: any) {
      console.error('[Pool] Failed to cleanup all containers:', error.message);
    }

    this.pool.clear();
  }

  /**
   * Get pool statistics for monitoring
   */
  getStats(): { totalContainers: number; bySession: Record<string, number>; byLanguage: Record<string, number> } {
    const bySession: Record<string, number> = {};
    const byLanguage: Record<string, number> = {};
    let totalContainers = 0;

    for (const [sessionId, containers] of this.pool.entries()) {
      bySession[sessionId] = containers.length;
      totalContainers += containers.length;

      for (const container of containers) {
        byLanguage[container.language] = (byLanguage[container.language] || 0) + 1;
      }
    }

    return { totalContainers, bySession, byLanguage };
  }

  /**
   * Get the number of active sessions
   */
  getSessionCount(): number {
    return this.pool.size;
  }
}

export const sessionPool = new SessionContainerPool();
