import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from './config';

const execAsync = promisify(exec);

/**
 * Safe exec wrapper that handles SIGINT gracefully during cleanup
 */
async function safeExecAsync(command: string, options: any = {}): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execAsync(command, options);
    return {
      stdout: result.stdout.toString(),
      stderr: result.stderr.toString()
    };
  } catch (error: any) {
    // If interrupted by SIGINT during cleanup, treat as non-fatal
    if (error.signal === 'SIGINT' || error.code === 'SIGINT') {
      return { stdout: '', stderr: 'Interrupted by SIGINT' };
    }
    throw error;
  }
}

/**
 * Network Manager for Session-based Docker Networks
 * 
 * Manages isolated Docker networks for code execution sessions.
 * Each session gets its own network with an explicitly allocated subnet
 * from configured address pools (172.80.0.0/12 and 10.10.0.0/16).
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

  console.log('[NetworkManager] Metrics reset');
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

    console.error('[SubnetAllocator] All address pools exhausted!');
    return null;
  }

  private generateSubnet(pool: (typeof config.network.subnetPools)[number], counter: number): string | null {
    if (pool.name === 'pool1') {
      // 172.80.0.0/12 generates 4096 /24 subnets
      const second = 80 + Math.floor(counter / 256);
      const third = counter % 256;
      return `172.${second}.${third}.0/24`;
    } else if (pool.name === 'pool2') {
      // 192.168.0.0/16 generates 256 /24 subnets
      return `192.168.${counter}.0/24`;
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
 * Check if a Docker network exists
 */
export async function networkExists(networkName: string): Promise<boolean> {
  try {
    await execAsync(`docker network inspect ${networkName}`, { timeout: config.docker.commandTimeout });
    return true;
  } catch {
    return false;
  }
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
    console.log(`[NetworkManager] Network already exists: ${networkName}`);
    return networkName;
  }

  // Check if another request is already creating this network
  const pendingCreation = pendingNetworkCreations.get(networkName);
  if (pendingCreation) {
    console.log(`[NetworkManager] Waiting for pending network creation: ${networkName}`);
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
 * List all session networks
 */
export async function listSessionNetworks(): Promise<string[]> {
  try {
    const { stdout } = await execAsync(
      `docker network ls --filter name=${config.network.sessionNetworkPrefix} --format "{{.Name}}"`,
      { timeout: config.docker.commandTimeout }
    );
    return stdout.trim().split('\n').filter(name => name.length > 0);
  } catch (error) {
    console.error('[NetworkManager] Failed to list session networks:', error);
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
          console.log(`[NetworkManager] Network created by concurrent request: ${networkName}`);
          return networkName;
        }
      }

      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff: 100ms, 200ms, 400ms...
      const backoffMs = 100 * Math.pow(2, attempt - 1);
      console.log(`[NetworkManager] Retry ${attempt}/${maxRetries} for ${networkName} after ${backoffMs}ms`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  throw new Error(`Failed to create network after ${maxRetries} attempts`);
}

/** 
 * Create a session network with explicit subnet allocation
 * Uses configured address pools to avoid Docker's default pool exhaustion
 */
export async function createSessionNetwork(sessionId: string): Promise<string> {
  const networkName = `${config.network.sessionNetworkPrefix}${sessionId}`;

  // Double-check if network already exists (could have been created by another concurrent request)
  const exists = await networkExists(networkName);
  if (exists) {
    console.log(`[NetworkManager] Network already exists (race): ${networkName}`);
    return networkName;
  }

  // Allocate a subnet from configured pools
  const subnet = subnetAllocator.allocateSubnet();
  if (!subnet) {
    throw new Error('Failed to allocate subnet: all address pools exhausted');
  }

  const command = `docker network create --driver ${config.network.networkDriver} --subnet=${subnet} --label ${config.network.networkLabel} --label session=${sessionId} ${networkName}`;

  try {
    console.log(`[NetworkManager] Creating network: ${networkName} with subnet ${subnet}`);
    await execAsync(command, { timeout: config.docker.commandTimeout });
    networkMetrics.networksCreated++;
    console.log(`[NetworkManager] Network created: ${networkName}`);
    return networkName;
  } catch (error: any) {
    console.error(`[NetworkManager] Failed to create network ${networkName}:`, error.message);
    networkMetrics.cleanupErrors++;

    // Check if the error is "network already exists" - this can happen in race conditions
    if (error.message.includes('already exists')) {
      console.log(`[NetworkManager] Network ${networkName} already exists (concurrent creation)`);
      subnetAllocator.releaseSubnet(subnet);

      // Verify the network exists and is usable
      const exists = await networkExists(networkName);
      if (exists) {
        return networkName;
      }
      throw new Error(`Network ${networkName} claimed to exist but not found`);
    }

    // Release the subnet since network creation failed
    subnetAllocator.releaseSubnet(subnet);

    // If creation fails due to subnet conflict, try emergency cleanup (with mutex)
    if (error.message.includes('address pool') || error.message.includes('subnet') || error.message.includes('overlap')) {
      console.log(`[NetworkManager] Subnet conflict detected, attempting emergency cleanup...`);

      try {
        await emergencyNetworkCleanup();
      } catch (cleanupError) {
        console.error(`[NetworkManager] Emergency cleanup failed:`, cleanupError);
        // Continue anyway - the retry mechanism will handle it
      }

      // Don't retry here - let the caller (createSessionNetworkWithRetry) handle retries
      throw new Error(`Failed to create network due to subnet conflict: ${error.message}`);
    }

    throw new Error(`Failed to create session network: ${error.message}`);
  }
}

/**
 * Delete a Docker network and release its subnet
 */
export async function deleteSessionNetwork(sessionId: string): Promise<void> {
  const networkName = `${config.network.sessionNetworkPrefix}${sessionId}`;

  try {
    // Get subnet before deleting
    const { stdout } = await execAsync(`docker network inspect ${networkName} --format "{{range .IPAM.Config}}{{.Subnet}}{{end}}"`, { timeout: 5000 });
    const subnet = stdout.trim();

    console.log(`[NetworkManager] Deleting network: ${networkName} (subnet: ${subnet})`);
    await execAsync(`docker network rm ${networkName}`, { timeout: config.docker.commandTimeout });
    networkMetrics.networksDeleted++;
    console.log(`[NetworkManager] Network deleted: ${networkName}`);

    // Release subnet back to pool
    if (subnet && subnet !== '') {
      subnetAllocator.releaseSubnet(subnet);
      console.log(`[NetworkManager] Subnet ${subnet} released back to pool`);
    }
  } catch (error: any) {
    console.error(`[NetworkManager] Failed to delete network ${networkName}:`, error.message);
    networkMetrics.cleanupErrors++;
    // Don't throw - network might already be deleted or not exist
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
      console.warn(`[NetworkManager] ⚠️  CRITICAL: ${orphanedCount} orphaned networks detected! Emergency cleanup engaged.`);
    } else if (orphanedCount > 20) {
      escalationLevel = 1;
      effectiveMaxAge = Math.min(maxAgeMs, 30000); // Max 30 seconds age
      console.warn(`[NetworkManager] ⚠️  WARNING: ${orphanedCount} orphaned networks detected. Aggressive cleanup enabled.`);
    }

    networkMetrics.escalationLevel = escalationLevel;
    console.log(`[NetworkManager] Checking ${networks.length} networks for cleanup (max age: ${effectiveMaxAge / 1000}s, escalation: ${escalationLevel})`);

    // Batch process networks for faster cleanup
    const batchSize = escalationLevel === 2 ? 20 : 10;
    const cleanupPromises: Promise<void>[] = [];

    for (const networkName of networks) {
      const cleanupTask = (async () => {
        try {
          // Get network creation time and container count in parallel
          const [inspectOutput, containersOutput] = await Promise.all([
            safeExecAsync(
              `docker network inspect ${networkName} --format "{{.Created}}"`,
              { timeout: config.docker.commandTimeout }
            ),
            safeExecAsync(
              `docker network inspect ${networkName} --format "{{len .Containers}}"`,
              { timeout: config.docker.commandTimeout }
            )
          ]);

          // Skip if interrupted or empty response
          if (!inspectOutput.stdout.trim() || !containersOutput.stdout.trim()) {
            return;
          }

          const createdAt = new Date(inspectOutput.stdout.trim()).getTime();
          const ageMs = now - createdAt;
          const containerCount = parseInt(containersOutput.stdout.trim(), 10);

          // Check if network should be cleaned up
          if (ageMs > effectiveMaxAge && containerCount === 0) {
            console.log(`[NetworkManager] Cleaning up orphaned network: ${networkName} (age: ${Math.floor(ageMs / 1000)}s)`);
            const sessionId = networkName.replace(config.network.sessionNetworkPrefix, '');
            await deleteSessionNetwork(sessionId);
            cleanedCount++;
          }
        } catch (error) {
          console.error(`[NetworkManager] Failed to check/cleanup network ${networkName}:`, error);
          networkMetrics.cleanupErrors++;
        }
      })();

      cleanupPromises.push(cleanupTask);

      // Process in batches to avoid overwhelming Docker daemon
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
      console.log(`[NetworkManager] Cleanup complete: removed ${cleanedCount} orphaned networks in ${duration}ms (escalation level: ${escalationLevel})`);
    }
  } catch (error) {
    console.error('[NetworkManager] Failed to cleanup orphaned networks:', error);
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
    console.log('[NetworkManager] ⚠️ EMERGENCY: Cleanup already in progress, skipping...');
    return;
  }

  // Check cooldown to avoid spamming cleanup
  if (now - lastEmergencyCleanup < EMERGENCY_CLEANUP_COOLDOWN) {
    const remainingMs = EMERGENCY_CLEANUP_COOLDOWN - (now - lastEmergencyCleanup);
    console.log(`[NetworkManager] ⚠️ EMERGENCY: Cleanup on cooldown, ${remainingMs}ms remaining`);
    return;
  }

  emergencyCleanupRunning = true;
  lastEmergencyCleanup = now;

  try {
    console.log('[NetworkManager] ⚠️ EMERGENCY: Pruning all unused CodeRunner networks');

    // Docker network prune removes all unused networks matching filter
    try {
      const { stdout } = await execAsync(
        `docker network prune -f --filter "label=${config.network.networkLabel}"`,
        { timeout: 30000 }
      );
      console.log(`[NetworkManager] Emergency cleanup result: ${stdout.trim()}`);
    } catch (pruneError: any) {
      // If prune is already running (by another process), that's okay
      if (pruneError.message.includes('already running')) {
        console.log('[NetworkManager] ⚠️ EMERGENCY: Prune already running in another process');
      } else {
        throw pruneError;
      }
    }

    // Additional manual cleanup of session networks with no containers
    const networks = await listSessionNetworks();
    let manualCleanupCount = 0;

    // Process in batches to avoid overwhelming Docker
    const batchSize = 10;
    for (let i = 0; i < networks.length; i += batchSize) {
      const batch = networks.slice(i, i + batchSize);
      const cleanupPromises = batch.map(async (networkName) => {
        try {
          const { stdout: containersOutput } = await execAsync(
            `docker network inspect ${networkName} --format "{{len .Containers}}"`,
            { timeout: 5000 }
          );
          const containerCount = parseInt(containersOutput.trim(), 10);

          if (containerCount === 0) {
            const sessionId = networkName.replace(config.network.sessionNetworkPrefix, '');
            await deleteSessionNetwork(sessionId);
            manualCleanupCount++;
          }
        } catch (error) {
          // Ignore errors during emergency cleanup - network might already be deleted
        }
      });

      await Promise.all(cleanupPromises);
    }

    console.log(`[NetworkManager] Emergency cleanup: manually removed ${manualCleanupCount} additional networks`);
  } catch (error) {
    console.error('[NetworkManager] Emergency cleanup failed:', error);
  } finally {
    emergencyCleanupRunning = false;
  }
}

/**
 * Get network statistics for monitoring
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

    for (const networkName of networks) {
      try {
        const { stdout: containersOutput } = await execAsync(
          `docker network inspect ${networkName} --format "{{len .Containers}}"`,
          { timeout: 5000 }
        );
        const containerCount = parseInt(containersOutput.trim(), 10);

        const { stdout: createdOutput } = await execAsync(
          `docker network inspect ${networkName} --format "{{.Created}}"`,
          { timeout: 5000 }
        );
        const createdAt = new Date(createdOutput.trim()).getTime();
        const ageSeconds = Math.floor((now - createdAt) / 1000);

        if (containerCount > 0) {
          withContainers++;
        } else {
          empty++;
        }

        networkDetails.push({
          name: networkName,
          containerCount,
          ageSeconds
        });
      } catch (error) {
        // Ignore errors for individual networks
      }
    }

    return {
      total: networks.length,
      withContainers,
      empty,
      networks: networkDetails
    };
  } catch (error) {
    console.error('[NetworkManager] Failed to get network stats:', error);
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
    console.log('[NetworkManager] 🔥 Starting aggressive bulk network cleanup...');
    const startTime = Date.now();
    let removedCount = 0;

    // Step 1: Get all CodeRunner networks
    const networksResult = await safeExecAsync(
      `docker network ls --filter "name=${config.network.sessionNetworkPrefix}" --quiet`,
      { timeout: 10000 }
    );

    if (!networksResult.stdout.trim()) {
      console.log('[NetworkManager] No networks found for bulk cleanup');
      return 0;
    }

    const networkIds = networksResult.stdout.trim().split('\n').filter(id => id.trim());
    console.log(`[NetworkManager] Found ${networkIds.length} networks for bulk removal`);

    // Step 2: Force disconnect and remove all containers in these networks
    console.log('[NetworkManager] Disconnecting containers from networks...');
    for (const networkId of networkIds) {
      try {
        // Get containers in this network
        const containersResult = await safeExecAsync(
          `docker network inspect ${networkId} --format '{{range .Containers}}{{.Name}} {{end}}'`,
          { timeout: 5000 }
        );

        if (containersResult.stdout.trim()) {
          const containerNames = containersResult.stdout.trim().split(' ').filter(n => n.trim());

          // Force disconnect each container
          for (const containerName of containerNames) {
            await safeExecAsync(
              `docker network disconnect -f ${networkId} ${containerName}`,
              { timeout: 5000 }
            ).catch(() => {
              // Ignore errors - container might already be gone
            });
          }
        }
      } catch (error) {
        // Continue even if this network fails
      }
    }

    // Step 3: Brief pause for Docker to process disconnections
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 4: Bulk remove all networks in parallel batches
    console.log('[NetworkManager] Bulk removing networks in parallel...');
    const batchSize = 20; // Process 20 at a time

    for (let i = 0; i < networkIds.length; i += batchSize) {
      const batch = networkIds.slice(i, i + batchSize);
      const removePromises = batch.map(networkId =>
        safeExecAsync(`docker network rm ${networkId}`, { timeout: 10000 })
          .then(() => {
            removedCount++;
            return true;
          })
          .catch(() => false) // Ignore failures
      );

      await Promise.all(removePromises);
    }

    const duration = Date.now() - startTime;
    console.log(`[NetworkManager] ✅ Aggressive cleanup complete: removed ${removedCount}/${networkIds.length} networks in ${duration}ms`);

    return removedCount;
  } catch (error) {
    console.error('[NetworkManager] Aggressive bulk cleanup failed:', error);
    return 0;
  }
}
