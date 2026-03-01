import { config } from './config';
import { logger } from './logger';
import { adminMetrics } from './adminMetrics';
import * as dockerClient from './dockerClient';
import {
  execInContainer,
  removeContainers,
  listContainers,
  waitForHealthy,
  startContainer,
} from './dockerClient';
import { getOrCreateSessionNetwork } from './networkManager';

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
    logger.info('Pool', 'Initialized session-based container pool with TTL');
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

    logger.info('Pool', 'Metrics have been reset');
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
        logger.info('Pool', `Cleaning up ${expiredContainers.length} expired containers for session ${sessionId}`);

        // Batch delete containers via SDK (parallel, no process spawning)
        const containerIds = expiredContainers.map(c => c.containerId);
        try {
          await removeContainers(containerIds);
          cleanedCount += containerIds.length;
          this.metrics.containersDeleted += containerIds.length;
          logger.info('Pool', `Deleted ${containerIds.length} expired containers`);
        } catch (error: any) {
          logger.warn('Pool', `Batch deletion error: ${error.message}`);
          this.metrics.cleanupErrors++;
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

    // 2. Safety Net: Find orphaned "coderunner-session" containers not in our pool
    try {
      const allSessionContainers = await listContainers({ 'type': 'coderunner-session' });

      const activeContainerIds = new Set<string>();
      for (const containers of this.pool.values()) {
        for (const c of containers) {
          activeContainerIds.add(c.containerId);
          activeContainerIds.add(c.containerId.substring(0, 12));
        }
      }

      const orphanedIds = allSessionContainers
        .filter((c) => !activeContainerIds.has(c.id) && !activeContainerIds.has(c.id.substring(0, 12)))
        .map((c) => c.id);

      if (orphanedIds.length > 0) {
        logger.info('Pool', `Found ${orphanedIds.length} orphaned containers. Removing...`);
        await removeContainers(orphanedIds);
        this.metrics.containersDeleted += orphanedIds.length;
        cleanedCount += orphanedIds.length;
      }
    } catch (error) {
      logger.error('Pool', `Safety net cleanup failed: ${error}`);
    }

    const cleanupDuration = Date.now() - startTime;
    this.metrics.lastCleanupDuration = cleanupDuration;

    if (cleanedCount > 0) {
      logger.info('Pool', `TTL cleanup completed: deleted ${cleanedCount} expired/orphaned containers`);
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
      logger.debug('Pool', `Reusing container for ${sessionId}:${language} - ${existingContainer.containerId.substring(0, 12)}`);
      return existingContainer.containerId;
    }

    // No available container — use mutex to prevent duplicate creation
    const mutexKey = `${sessionId}:${language}`;
    const pendingPromise = this.pendingAcquisitions.get(mutexKey);
    if (pendingPromise) {
      // Another request is already creating a container for this session+language.
      // Wait for it, then check again for an available container.
      logger.debug('Pool', `Waiting for pending container acquisition: ${mutexKey}`);
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
        logger.debug('Pool', `Reusing container after mutex wait for ${sessionId}:${language} - ${nowAvailable.containerId.substring(0, 12)}`);
        return nowAvailable.containerId;
      }
    }

    // Create new container and network concurrently with mutex
    logger.info('Pool', `Creating new network and container for ${sessionId}:${language}`);

    // We package the entire concurrent creation process into the mutex promise
    const creationPromise = (async () => {
      const startTime = Date.now();

      // Fire network and container creation at the exact same time
      const [networkName, containerId] = await Promise.all([
        getOrCreateSessionNetwork(sessionId),
        this.createContainer(language, sessionId)
      ]);

      // Connect the new container to the new network
      await dockerClient.docker.getNetwork(networkName).connect({
        Container: containerId
      });

      // Start the container AFTER it's connected to the network
      await dockerClient.startContainer(containerId);

      // For Postgres, wait for initialization with readiness polling after start.
      // Must use psql (not pg_isready) to verify the devdb database is actually
      // created and accepting connections — pg_isready returns OK before init scripts
      // finish creating the database.
      if (language === 'sql') {
        logger.info('Pool', 'Waiting for Postgres to initialize...');
        await waitForHealthy(
          containerId,
          'PGPASSWORD=root psql -U root -d devdb -c "SELECT 1" -t -A 2>&1',
          30_000,
          250,
        );
        logger.info('Pool', `Postgres ready in ${containerId.substring(0, 12)}`);
      }

      logger.debug('Pool', `Concurrent init for ${containerId.substring(0, 12)} done in ${Date.now() - startTime}ms`);
      return { containerId, networkName };
    })();

    // We only need the container ID for the mutex map
    this.pendingAcquisitions.set(mutexKey, creationPromise.then(res => res.containerId));

    try {
      const { containerId, networkName } = await creationPromise;

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

      logger.info('Pool', `Created container ${containerId.substring(0, 12)} for ${sessionId}:${language}`);
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
      logger.warn('Pool', `No containers found for session ${sessionId}`);
      return;
    }

    const container = sessionContainers.find(c => c.containerId === containerId);
    if (container) {
      // Clean container data before returning to pool
      await this.cleanContainer(containerId, container.language);

      container.inUse = false;
      container.lastUsed = Date.now();
      logger.debug('Pool', `Returned container ${containerId.substring(0, 12)} to pool`);
    }
  }

  /**
   * Clean all data from a container's /app directory and temporary build artifacts.
   * Skipped for stateless executions when SKIP_STATELESS_CLEANUP is enabled.
   */
  private async cleanContainer(containerId: string, language?: string): Promise<void> {
    // Skip cleanup for stateless languages (files are overwritten via putArchive anyway)
    if (config.sessionContainers.skipStatelessCleanup && language && this.isStatelessLanguage(language)) {
      logger.debug('Pool', `Skipping cleanup for stateless ${language} container ${containerId.substring(0, 12)}`);
      return;
    }

    try {
      await execInContainer(containerId, 'rm -rf /app/* /app/.* /tmp/* 2>/dev/null || true', {
        timeout: config.docker.commandTimeout,
      });
      logger.debug('Pool', `Cleaned container ${containerId.substring(0, 12)}`);
    } catch (error: any) {
      logger.error('Pool', `Failed to clean container ${containerId.substring(0, 12)}: ${error.message}`);
    }
  }

  /**
   * Determine if a language produces stateless executions where cleanup can be skipped.
   * Stateless: files are fully overwritten on each run (no persistent side effects).
   */
  private isStatelessLanguage(language: string): boolean {
    return ['javascript', 'cpp', 'java'].includes(language);
  }

  /**
   * Create a new container with networking via Docker SDK.
   * Eliminates process-spawning overhead of `docker run`.
   */
  private async createContainer(
    language: string,
    sessionId: string
  ): Promise<string> {
    const runtimeConfig = config.runtimes[language as keyof typeof config.runtimes];

    try {
      const memory = language === 'sql' ? config.docker.memorySQL : config.docker.memory;

      const containerId = await dockerClient.createContainer({
        image: runtimeConfig.image,
        labels: {
          'type': 'coderunner-session',
          'session': sessionId,
          'language': language,
        },
        memory,
        cpus: config.docker.cpus,
        env: language === 'sql' ? ['POSTGRES_PASSWORD=root', 'POSTGRES_USER=root', 'POSTGRES_DB=devdb'] : undefined,
        cmd: language === 'sql' ? undefined : ['tail', '-f', '/dev/null'],
        // NetworkMode will be set manually via network.connect() after creation
      });

      logger.info('Pool', `Container created: ${containerId.substring(0, 12)} (${language})`);

      return containerId;
    } catch (error: any) {
      logger.error('Pool', `Failed to create container: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cleanup all containers for a specific session (on disconnect)
   */
  async cleanupSession(sessionId: string): Promise<void> {
    const sessionContainers = this.pool.get(sessionId);
    if (!sessionContainers || sessionContainers.length === 0) {
      return;
    }

    logger.info('Pool', `Cleaning up ${sessionContainers.length} containers for session ${sessionId}`);

    const containerIds = sessionContainers.map(c => c.containerId);

    if (containerIds.length > 0) {
      await removeContainers(containerIds);
      this.metrics.containersDeleted += containerIds.length;
      logger.info('Pool', `Deleted ${containerIds.length} containers for session ${sessionId}`);
    }

    this.pool.delete(sessionId);
    logger.info('Pool', `Session ${sessionId} cleanup completed`);
  }

  /**
   * Cleanup all containers (on server shutdown)
   */
  async cleanupAll(): Promise<void> {
    logger.info('Pool', 'Cleaning up all session containers...');

    try {
      const allContainers = await listContainers({ 'type': 'coderunner-session' });
      if (allContainers.length > 0) {
        logger.info('Pool', `Found ${allContainers.length} containers to clean up`);
        await removeContainers(allContainers.map((c) => c.id));
        logger.info('Pool', 'All session containers cleaned up');
      }
    } catch (error: any) {
      logger.error('Pool', `Failed to cleanup all containers: ${error.message}`);
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
