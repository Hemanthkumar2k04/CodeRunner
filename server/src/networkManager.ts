import { config } from './config';
import { logger } from './logger';
import {
  createNetwork as dockerCreateNetwork,
  networkExists as dockerNetworkExists,
  inspectNetwork as dockerInspectNetwork,
  removeNetwork as dockerRemoveNetwork,
  listNetworks as dockerListNetworks,
  disconnectAllFromNetwork,
  pruneNetworks,
} from './dockerClient';

/**
 * Network Manager for Session-based Docker Networks
 * 
 * Manages isolated Docker networks for code execution sessions.
 * Each session gets its own network with an explicitly allocated /28 subnet
 * from configured address pools (10.201.0.0/16 and 10.202.0.0/16).
 * These ranges are deep inside RFC 1918 10.0.0.0/8 space and chosen to
 * avoid collisions with typical LAN subnets (192.168.x.x, 10.0-10.x),
 * Docker's default bridge (172.17.x.x), and the 172.16.0.0/12 corporate VPN range.
 * 
 * This design prevents subnet exhaustion when running many concurrent sessions.
 */

/**
 * Network cleanup metrics
 */
interface NetworkCleanupMetrics {
  networksCreated: number;
  networksDeleted: number;
  cleanupErrors: number;
  lastCleanupDuration: number;
  totalActiveNetworks: number;
  orphanedNetworkCount: number;
  escalationLevel: number; // 0=normal, 1=warning, 2=critical
}

const networkMetrics: NetworkCleanupMetrics = {
  networksCreated: 0,
  networksDeleted: 0,
  cleanupErrors: 0,
  lastCleanupDuration: 0,
  totalActiveNetworks: 0,
  orphanedNetworkCount: 0,
  escalationLevel: 0,
};

/**
 * Reset all network metrics counters
 */
export function resetNetworkMetrics(): void {
  const currentActive = networkMetrics.totalActiveNetworks;
  const currentOrphaned = networkMetrics.orphanedNetworkCount;

  networkMetrics.networksCreated = 0;
  networkMetrics.networksDeleted = 0;
  networkMetrics.cleanupErrors = 0;
  networkMetrics.lastCleanupDuration = 0;
  networkMetrics.totalActiveNetworks = currentActive; // Preserve current active state
  networkMetrics.orphanedNetworkCount = currentOrphaned; // Preserve current orphaned state
  networkMetrics.escalationLevel = 0;

  logger.info('NetworkManager', 'Metrics reset');
}

/**
 * Subnet Allocator - Manages IP subnet allocation from custom pools
 * Uses explicit subnet assignment to avoid Docker IPAM race conditions
 */
class SubnetAllocator {
  private usedSubnets: Set<string> = new Set();
  private poolCounters: Map<string, number> = new Map();

  constructor() {
    // Initialize counters for each pool
    for (const pool of config.network.subnetPools) {
      this.poolCounters.set(pool.name, 0);
    }
  }

  allocateSubnet(): string | null {
    // Try each pool in order
    for (const pool of config.network.subnetPools) {
      const counter = this.poolCounters.get(pool.name) || 0;

      if (counter < pool.capacity) {
        const subnet = this.generateSubnet(pool, counter);
        if (subnet) {
          this.poolCounters.set(pool.name, counter + 1);
          this.usedSubnets.add(subnet);
          return subnet;
        }
      }
    }

    logger.error('SubnetAllocator', 'All address pools exhausted!');
    return null;
  }

  private generateSubnet(pool: (typeof config.network.subnetPools)[number], counter: number): string | null {
    // Each pool is a /16. We carve it into /28 subnets (16 IPs each).
    // counter 0   → 10.x.0.0/28
    // counter 1   → 10.x.0.16/28
    // counter 15  → 10.x.0.240/28
    // counter 16  → 10.x.1.0/28   etc.
    const third = Math.floor(counter / 16);   // 0..255
    const fourth = (counter % 16) * 16;       // 0,16,32..240
    if (pool.name === 'pool1') {
      return `10.201.${third}.${fourth}/28`;
    } else if (pool.name === 'pool2') {
      return `10.202.${third}.${fourth}/28`;
    }
    return null;
  }

  releaseSubnet(subnet: string): void {
    this.usedSubnets.delete(subnet);
  }

  getStats() {
    const stats = {
      totalUsed: 0,
      totalAvailable: 0,
      activeSubnets: this.usedSubnets.size,
      poolStats: {} as Record<string, any>,
    };

    for (const pool of config.network.subnetPools) {
      const used = this.poolCounters.get(pool.name) || 0;
      stats.poolStats[pool.name] = {
        used,
        available: pool.capacity,
        utilization: ((used / pool.capacity) * 100).toFixed(2) + '%',
      };
      stats.totalUsed += used;
      stats.totalAvailable += pool.capacity;
    }

    return stats;
  }
}

const subnetAllocator = new SubnetAllocator();

/**
 * Mutex for network creation to prevent race conditions
 * Key: networkName -> Promise that resolves when network is ready
 */
const pendingNetworkCreations: Map<string, Promise<string>> = new Map();

/**
 * Emergency cleanup mutex to prevent concurrent prune operations
 */
let emergencyCleanupRunning = false;
let lastEmergencyCleanup = 0;
const EMERGENCY_CLEANUP_COOLDOWN = 5000; // 5 seconds minimum between emergency cleanups

/**
 * Check if a Docker network exists (via SDK, no process spawn)
 */
export async function networkExists(networkName: string): Promise<boolean> {
  return dockerNetworkExists(networkName);
}

/**
 * Get or create a session network (idempotent)
 * Uses mutex to prevent race conditions when multiple requests
 * try to create the same network simultaneously
 */
export async function getOrCreateSessionNetwork(sessionId: string): Promise<string> {
  const networkName = `${config.network.sessionNetworkPrefix}${sessionId}`;

  // Fast path: if network exists, return immediately
  const exists = await networkExists(networkName);
  if (exists) {
    logger.debug('NetworkManager', `Network already exists: ${networkName}`);
    return networkName;
  }

  // Check if another request is already creating this network
  const pendingCreation = pendingNetworkCreations.get(networkName);
  if (pendingCreation) {
    logger.debug('NetworkManager', `Waiting for pending network creation: ${networkName}`);
    return await pendingCreation;
  }

  // Create the network with mutex protection
  const creationPromise = createSessionNetworkWithRetry(sessionId);
  pendingNetworkCreations.set(networkName, creationPromise);

  try {
    const result = await creationPromise;
    return result;
  } finally {
    pendingNetworkCreations.delete(networkName);
  }
}

/**
 * List all session networks (via SDK)
 */
export async function listSessionNetworks(): Promise<string[]> {
  try {
    return await dockerListNetworks(config.network.sessionNetworkPrefix);
  } catch (error) {
    logger.error('NetworkManager', `Failed to list session networks: ${error}`);
    return [];
  }
}

/**
 * Get network name from session ID
 */
export function getNetworkName(sessionId: string): string {
  return `${config.network.sessionNetworkPrefix}${sessionId}`;
}

/**
 * Get subnet allocator statistics
 */
export function getSubnetStats() {
  return subnetAllocator.getStats();
}

/**
 * Create session network with retry logic and exponential backoff
 */
async function createSessionNetworkWithRetry(sessionId: string, maxRetries: number = 3): Promise<string> {
  const networkName = `${config.network.sessionNetworkPrefix}${sessionId}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await createSessionNetwork(sessionId);
    } catch (error: any) {
      // If network already exists (race condition), verify and return
      if (error.message.includes('already exists')) {
        const exists = await networkExists(networkName);
        if (exists) {
          logger.debug('NetworkManager', `Network created by concurrent request: ${networkName}`);
          return networkName;
        }
      }

      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff: 100ms, 200ms, 400ms...
      const backoffMs = 100 * Math.pow(2, attempt - 1);
      logger.info('NetworkManager', `Retry ${attempt}/${maxRetries} for ${networkName} after ${backoffMs}ms`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  throw new Error(`Failed to create network after ${maxRetries} attempts`);
}

/** 
 * Create a session network with explicit subnet allocation via Docker SDK.
 * Eliminates shell process spawning overhead.
 */
export async function createSessionNetwork(sessionId: string): Promise<string> {
  const networkName = `${config.network.sessionNetworkPrefix}${sessionId}`;

  // Double-check if network already exists (could have been created concurrently)
  const exists = await dockerNetworkExists(networkName);
  if (exists) {
    logger.debug('NetworkManager', `Network already exists (race): ${networkName}`);
    return networkName;
  }

  // Allocate a subnet from configured pools
  const subnet = subnetAllocator.allocateSubnet();
  if (!subnet) {
    throw new Error('Failed to allocate subnet: all address pools exhausted');
  }

  try {
    logger.info('NetworkManager', `Creating network: ${networkName} with subnet ${subnet}`);
    await dockerCreateNetwork({
      name: networkName,
      driver: config.network.networkDriver,
      subnet,
      labels: {
        'type': 'coderunner',
        'session': sessionId,
      },
    });
    networkMetrics.networksCreated++;
    logger.info('NetworkManager', `Network created: ${networkName}`);
    return networkName;
  } catch (error: any) {
    logger.error('NetworkManager', `Failed to create network ${networkName}: ${error.message}`);
    networkMetrics.cleanupErrors++;

    // Handle "network already exists" race condition
    if (error.message?.includes('already exists') || error.statusCode === 409) {
      logger.debug('NetworkManager', `Network ${networkName} already exists (concurrent creation)`);
      subnetAllocator.releaseSubnet(subnet);
      const existsNow = await dockerNetworkExists(networkName);
      if (existsNow) return networkName;
      throw new Error(`Network ${networkName} claimed to exist but not found`);
    }

    subnetAllocator.releaseSubnet(subnet);

    // If creation fails due to subnet conflict, try emergency cleanup
    if (error.message?.includes('address pool') || error.message?.includes('subnet') || error.message?.includes('overlap')) {
      logger.warn('NetworkManager', 'Subnet conflict detected, attempting emergency cleanup...');
      try {
        await emergencyNetworkCleanup();
      } catch (cleanupError) {
        logger.error('NetworkManager', `Emergency cleanup failed: ${cleanupError}`);
      }
      throw new Error(`Failed to create network due to subnet conflict: ${error.message}`);
    }

    throw new Error(`Failed to create session network: ${error.message}`);
  }
}

/**
 * Delete a Docker network and release its subnet (via SDK)
 */
export async function deleteSessionNetwork(sessionId: string): Promise<void> {
  const networkName = `${config.network.sessionNetworkPrefix}${sessionId}`;

  try {
    // Get subnet before deleting so we can release it
    let subnet = '';
    try {
      const info = await dockerInspectNetwork(networkName);
      subnet = info.subnet;
    } catch {
      // Network may already be gone
    }

    logger.info('NetworkManager', `Deleting network: ${networkName} (subnet: ${subnet})`);
    await dockerRemoveNetwork(networkName);
    networkMetrics.networksDeleted++;
    logger.info('NetworkManager', `Network deleted: ${networkName}`);

    if (subnet) {
      subnetAllocator.releaseSubnet(subnet);
      logger.debug('NetworkManager', `Subnet ${subnet} released back to pool`);
    }
  } catch (error: any) {
    logger.error('NetworkManager', `Failed to delete network ${networkName}: ${error.message}`);
    networkMetrics.cleanupErrors++;
  }
}

/**
 * Cleanup orphaned networks (networks older than maxAge with no containers)
 */
export async function cleanupOrphanedNetworks(maxAgeMs: number = 300000): Promise<void> {
  try {
    const startTime = Date.now();
    const networks = await listSessionNetworks();
    const now = Date.now();
    let cleanedCount = 0;
    const orphanedCount = networks.length;

    // Determine escalation level based on orphaned network count
    let escalationLevel = 0; // 0=normal, 1=warning, 2=critical
    let effectiveMaxAge = maxAgeMs;

    if (orphanedCount > 50) {
      escalationLevel = 2;
      effectiveMaxAge = 0; // Clean all orphaned networks immediately
      logger.warn('NetworkManager', `CRITICAL: ${orphanedCount} orphaned networks detected! Emergency cleanup engaged.`);
    } else if (orphanedCount > 20) {
      escalationLevel = 1;
      effectiveMaxAge = Math.min(maxAgeMs, 30000); // Max 30 seconds age
      logger.warn('NetworkManager', `WARNING: ${orphanedCount} orphaned networks detected. Aggressive cleanup enabled.`);
    }

    networkMetrics.escalationLevel = escalationLevel;
    logger.info('NetworkManager', `Checking ${networks.length} networks for cleanup (max age: ${effectiveMaxAge / 1000}s, escalation: ${escalationLevel})`);

    // Batch process networks for faster cleanup (via SDK — no shell overhead)
    const batchSize = escalationLevel === 2 ? 20 : 10;
    const cleanupPromises: Promise<void>[] = [];

    for (const networkName of networks) {
      const cleanupTask = (async () => {
        try {
          const info = await dockerInspectNetwork(networkName);
          const createdAt = new Date(info.created).getTime();
          const ageMs = now - createdAt;
          const containerCount = info.containerCount;

          // Check if network should be cleaned up
          if (ageMs > effectiveMaxAge && containerCount === 0) {
            logger.info('NetworkManager', `Cleaning up orphaned network: ${networkName} (age: ${Math.floor(ageMs / 1000)}s)`);
            const sessionId = networkName.replace(config.network.sessionNetworkPrefix, '');
            await deleteSessionNetwork(sessionId);
            cleanedCount++;
          }
        } catch (error) {
          logger.error('NetworkManager', `Failed to check/cleanup network ${networkName}: ${error}`);
          networkMetrics.cleanupErrors++;
        }
      })();

      cleanupPromises.push(cleanupTask);

      // Process in batches
      if (cleanupPromises.length >= batchSize) {
        await Promise.all(cleanupPromises);
        cleanupPromises.length = 0;
      }
    }

    // Wait for remaining cleanup tasks
    if (cleanupPromises.length > 0) {
      await Promise.all(cleanupPromises);
    }

    const duration = Date.now() - startTime;
    if (cleanedCount > 0) {
      logger.info('NetworkManager', `Cleanup complete: removed ${cleanedCount} orphaned networks in ${duration}ms (escalation level: ${escalationLevel})`);
    }
  } catch (error) {
    logger.error('NetworkManager', `Failed to cleanup orphaned networks: ${error}`);
  }
}

/**
 * Emergency cleanup - prune all unused CodeRunner networks immediately
 * Used when subnet exhaustion is detected
 * Uses mutex to prevent concurrent prune operations which Docker doesn't allow
 */
export async function emergencyNetworkCleanup(): Promise<void> {
  const now = Date.now();

  // Check if emergency cleanup is already running
  if (emergencyCleanupRunning) {
    logger.warn('NetworkManager', 'EMERGENCY: Cleanup already in progress, skipping...');
    return;
  }

  // Check cooldown to avoid spamming cleanup
  if (now - lastEmergencyCleanup < EMERGENCY_CLEANUP_COOLDOWN) {
    const remainingMs = EMERGENCY_CLEANUP_COOLDOWN - (now - lastEmergencyCleanup);
    logger.warn('NetworkManager', `EMERGENCY: Cleanup on cooldown, ${remainingMs}ms remaining`);
    return;
  }

  emergencyCleanupRunning = true;
  lastEmergencyCleanup = now;

  try {
    logger.warn('NetworkManager', 'EMERGENCY: Pruning all unused CodeRunner networks');

    // Use SDK prune — no process spawn
    try {
      const deleted = await pruneNetworks(config.network.networkLabel);
      logger.info('NetworkManager', `Emergency prune removed ${deleted.length} networks`);
    } catch (pruneError: any) {
      if (pruneError.message?.includes('already running')) {
        logger.warn('NetworkManager', 'EMERGENCY: Prune already running in another process');
      } else {
        throw pruneError;
      }
    }

    // Additional manual cleanup of session networks with no containers
    const networks = await listSessionNetworks();
    let manualCleanupCount = 0;

    const batchSize = 10;
    for (let i = 0; i < networks.length; i += batchSize) {
      const batch = networks.slice(i, i + batchSize);
      const cleanupPromises = batch.map(async (networkName) => {
        try {
          const info = await dockerInspectNetwork(networkName);
          if (info.containerCount === 0) {
            const sessionId = networkName.replace(config.network.sessionNetworkPrefix, '');
            await deleteSessionNetwork(sessionId);
            manualCleanupCount++;
          }
        } catch {
          // Ignore errors during emergency cleanup
        }
      });

      await Promise.all(cleanupPromises);
    }

    logger.info('NetworkManager', `Emergency cleanup: manually removed ${manualCleanupCount} additional networks`);
  } catch (error) {
    logger.error('NetworkManager', `Emergency cleanup failed: ${error}`);
  } finally {
    emergencyCleanupRunning = false;
  }
}

/**
 * Get network statistics for monitoring (via SDK)
 */
export async function getNetworkStats(): Promise<{
  total: number;
  withContainers: number;
  empty: number;
  networks: Array<{
    name: string;
    containerCount: number;
    ageSeconds: number;
  }>;
}> {
  try {
    const networks = await listSessionNetworks();
    const now = Date.now();
    let withContainers = 0;
    let empty = 0;
    const networkDetails: Array<{
      name: string;
      containerCount: number;
      ageSeconds: number;
    }> = [];

    // Process in parallel batches for speed
    const batchSize = 10;
    for (let i = 0; i < networks.length; i += batchSize) {
      const batch = networks.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (networkName) => {
          const info = await dockerInspectNetwork(networkName);
          const createdAt = new Date(info.created).getTime();
          const ageSeconds = Math.floor((now - createdAt) / 1000);

          if (info.containerCount > 0) withContainers++;
          else empty++;

          networkDetails.push({
            name: networkName,
            containerCount: info.containerCount,
            ageSeconds,
          });
        }),
      );
    }

    return { total: networks.length, withContainers, empty, networks: networkDetails };
  } catch (error) {
    logger.error('NetworkManager', `Failed to get network stats: ${error}`);
    return { total: 0, withContainers: 0, empty: 0, networks: [] };
  }
}

/**
 * Get network cleanup metrics
 */
export function getNetworkMetrics(): NetworkCleanupMetrics {
  return { ...networkMetrics };
}

/**
 * Aggressive bulk network cleanup (based on cleanup.sh script)
 * Use when there are many orphaned networks (>100)
 * This is much faster than the careful cleanup approach
 */
export async function aggressiveBulkNetworkCleanup(): Promise<number> {
  try {
    logger.warn('NetworkManager', 'Starting aggressive bulk network cleanup...');
    const startTime = Date.now();
    let removedCount = 0;

    // Step 1: Get all CodeRunner session networks
    const networks = await listSessionNetworks();
    if (networks.length === 0) {
      logger.info('NetworkManager', 'No networks found for bulk cleanup');
      return 0;
    }
    logger.info('NetworkManager', `Found ${networks.length} networks for bulk removal`);

    // Step 2: Force-disconnect all containers from these networks
    logger.info('NetworkManager', 'Disconnecting containers from networks...');
    await Promise.allSettled(
      networks.map((name) => disconnectAllFromNetwork(name)),
    );

    // Step 3: Brief pause for Docker to process disconnections
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Step 4: Bulk remove networks in parallel batches via SDK
    logger.info('NetworkManager', 'Bulk removing networks in parallel...');
    const batchSize = 20;

    for (let i = 0; i < networks.length; i += batchSize) {
      const batch = networks.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (name) => {
          const sessionId = name.replace(config.network.sessionNetworkPrefix, '');
          await deleteSessionNetwork(sessionId);
        }),
      );

      removedCount += results.filter((r) => r.status === 'fulfilled').length;
    }

    const duration = Date.now() - startTime;
    logger.info('NetworkManager', `Aggressive cleanup complete: removed ${removedCount}/${networks.length} networks in ${duration}ms`);
    return removedCount;
  } catch (error) {
    logger.error('NetworkManager', `Aggressive bulk cleanup failed: ${error}`);
    return 0;
  }
}
