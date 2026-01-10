import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from './config';

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
 * Session-Based Container Pool with TTL
 * All containers are created with networking and associated with user sessions.
 * Containers are reused within the same session and deleted after TTL expiry or disconnect.
 */
class SessionContainerPool {
  // Map: sessionId -> array of containers for that session
  private pool: Map<string, SessionContainer[]> = new Map();
  
  constructor() {
    console.log('[Pool] Initialized session-based container pool with TTL');
  }

  /**
   * Get or create a container for the session and language
   * Reuses existing containers within the same session or creates new ones
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

    // Check if session has containers
    const sessionContainers = this.pool.get(sessionId) || [];
    
    // Find available container for this language (not in use)
    const existingContainer = sessionContainers.find(
      c => c.language === language && !c.inUse
    );

    if (existingContainer) {
      // Reuse existing container
      existingContainer.inUse = true;
      existingContainer.lastUsed = Date.now();
      console.log(`[Pool] Reusing container for ${sessionId}:${language} - ${existingContainer.containerId.substring(0, 12)}`);
      return existingContainer.containerId;
    }

    // No available container - create new one
    console.log(`[Pool] Creating new container for ${sessionId}:${language}`);
    const containerId = await this.createContainer(language, sessionId, networkName);

    // Add to pool
    const newContainer: SessionContainer = {
      containerId,
      language,
      sessionId,
      networkName,
      lastUsed: Date.now(),
      inUse: true,
    };

    sessionContainers.push(newContainer);
    this.pool.set(sessionId, sessionContainers);

    console.log(`[Pool] Created container ${containerId.substring(0, 12)} for ${sessionId}:${language}`);
    return containerId;
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
      await execAsync(`docker exec ${containerId} sh -c "rm -rf /app/* /app/.* /tmp/* 2>/dev/null || true"`);
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
      const memory = language === 'sql' ? '256m' : config.docker.memory;
      
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

      const { stdout } = await execAsync(dockerCmd);
      const containerId = stdout.trim();
      
      // For MySQL, wait for initialization
      if (language === 'sql') {
        console.log(`[Pool] Waiting for MySQL to initialize...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }

      return containerId;
    } catch (error: any) {
      console.error(`[Pool] Failed to create container:`, error.message);
      throw error;
    }
  }

  /**
   * Cleanup expired containers (TTL exceeded)
   * Called by background job
   */
  async cleanupExpiredContainers(): Promise<void> {
    const now = Date.now();
    const ttl = config.sessionContainers.ttl;
    let cleanedCount = 0;

    for (const [sessionId, containers] of this.pool.entries()) {
      const expiredContainers = containers.filter(
        c => !c.inUse && (now - c.lastUsed) > ttl
      );

      if (expiredContainers.length > 0) {
        console.log(`[Pool] Cleaning up ${expiredContainers.length} expired containers for session ${sessionId}`);
        
        for (const container of expiredContainers) {
          try {
            await execAsync(`docker rm -fv ${container.containerId}`);
            cleanedCount++;
            console.log(`[Pool] Deleted expired container ${container.containerId.substring(0, 12)} (unused for ${Math.floor((now - container.lastUsed) / 1000)}s)`);
          } catch (error: any) {
            console.error(`[Pool] Failed to delete container ${container.containerId.substring(0, 12)}:`, error.message);
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

    if (cleanedCount > 0) {
      console.log(`[Pool] TTL cleanup completed: deleted ${cleanedCount} expired containers`);
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

    console.log(`[Pool] Cleaning up ${sessionContainers.length} containers for session ${sessionId}`);
    
    for (const container of sessionContainers) {
      try {
        await execAsync(`docker rm -fv ${container.containerId}`);
        console.log(`[Pool] Deleted container ${container.containerId.substring(0, 12)}`);
      } catch (error: any) {
        console.error(`[Pool] Failed to delete container ${container.containerId.substring(0, 12)}:`, error.message);
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
}

export const sessionPool = new SessionContainerPool();
