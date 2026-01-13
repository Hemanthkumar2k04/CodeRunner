import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Network Manager for Session-based Docker Networks
 * 
 * This module manages Docker networks for session-based container execution.
 * Each user session gets its own isolated Docker network, allowing socket
 * programming (e.g., Java Server/Client) without port conflicts between users.
 */

const NETWORK_PREFIX = 'coderunner-session-';
const NETWORK_DRIVER = 'bridge';
const NETWORK_LABEL = 'type=coderunner';

/**
 * Check if a Docker network exists
 */
export async function networkExists(networkName: string): Promise<boolean> {
  try {
    await execAsync(`docker network inspect ${networkName}`, { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

/** with labels for cleanup
 */
export async function createSessionNetwork(sessionId: string): Promise<string> {
  const networkName = `${NETWORK_PREFIX}${sessionId}`;
  const command = `docker network create --driver ${NETWORK_DRIVER} --label ${NETWORK_LABEL} --label session=${sessionId} ${networkName}`;
  
  try {
    console.log(`[NetworkManager] Creating network: ${networkName}`);
    console.log(`[NetworkManager] Executing: ${command}`);
    await execAsync(command, { timeout: 10000 });
    console.log(`[NetworkManager] Network created: ${networkName}`);
    return networkName;
  } catch (error: any) {
    console.error(`[NetworkManager] Failed to create network ${networkName}:`, error.message);
    
    // If creation fails due to subnet exhaustion, attempt emergency cleanup and retry once
    if (error.message.includes('address pool') || error.message.includes('subnet')) {
      console.log(`[NetworkManager] Subnet exhaustion detected, attempting emergency cleanup...`);
      await emergencyNetworkCleanup();
      
      try {
        await execAsync(command, { timeout: 10000 });
        console.log(`[NetworkManager] Network created after cleanup: ${networkName}`);
        return networkName;
      } catch (retryError: any) {
        throw new Error(`Failed to create session network after cleanup: ${retryError.message}`);
      }
    }
    
    console.error(`[NetworkManager] Failed to create network ${networkName}:`, error.message);
    throw new Error(`Failed to create session network: ${error.message}`);
  }
}

/**
 * Delete a Docker network
 */
export async function deleteSessionNetwork(sessionId: string): Promise<void> {
  const networkName = `${NETWORK_PREFIX}${sessionId}`;
  
  try {
    console.log(`[NetworkManager] Deleting network: ${networkName}`);
    await execAsync(`docker network rm ${networkName}`, { timeout: 10000 });
    console.log(`[NetworkManager] Network deleted: ${networkName}`);
  } catch (error: any) {
    console.error(`[NetworkManager] Failed to delete network ${networkName}:`, error.message);
    // Don't throw - network might already be deleted or not exist
  }
}

/**
 * Get or create a session network (idempotent)
 */
export async function getOrCreateSessionNetwork(sessionId: string): Promise<string> {
  const networkName = `${NETWORK_PREFIX}${sessionId}`;
  
  const exists = await networkExists(networkName);
  if (exists) {
    console.log(`[NetworkManager] Network already exists: ${networkName}`);
    return networkName;
  }
  
  return await createSessionNetwork(sessionId);
}

/**
 * List all session networks
 */
export async function listSessionNetworks(): Promise<string[]> {
  try {
    const { stdout } = await execAsync(
      `docker network ls --filter name=${NETWORK_PREFIX} --format "{{.Name}}"`,
      { timeout: 10000 }
    );
    return stdout.trim().split('\n').filter(name => name.length > 0);
  } catch (error) {
    console.error('[NetworkManager] Failed to list session networks:', error);
    return [];
  }
}

/**
 * Cleanup orphaned networks (networks older than maxAge with no containers)
 */
export async function cleanupOrphanedNetworks(maxAgeMs: number = 300000): Promise<void> {
  try {
    const networks = await listSessionNetworks();
    const now = Date.now();
    let cleanedCount = 0;
    
    console.log(`[NetworkManager] Checking ${networks.length} networks for cleanup (max age: ${maxAgeMs / 1000}s)`);
    
    for (const networkName of networks) {
      try {
        // Get network creation time
        const { stdout: inspectOutput } = await execAsync(
          `docker network inspect ${networkName} --format "{{.Created}}"`,
          { timeout: 10000 }
        );
        const createdAt = new Date(inspectOutput.trim()).getTime();
        const ageMs = now - createdAt;
        
        // Check if network is old enough
        if (ageMs > maxAgeMs) {
          // Check if network has any containers
          const { stdout: containersOutput } = await execAsync(
            `docker network inspect ${networkName} --format "{{len .Containers}}"`,
            { timeout: 10000 }
          );
          const containerCount = parseInt(containersOutput.trim(), 10);
          
          if (containerCount === 0) {
            console.log(`[NetworkManager] Cleaning up orphaned network: ${networkName} (age: ${Math.floor(ageMs / 1000)}s)`);
            const sessionId = networkName.replace(NETWORK_PREFIX, '');
            await deleteSessionNetwork(sessionId);
            cleanedCount++;
          }
        }
      } catch (error) {
        console.error(`[NetworkManager] Failed to check/cleanup network ${networkName}:`, error);
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[NetworkManager] Cleanup complete: removed ${cleanedCount} orphaned networks`);
    }
  } catch (error) {
    console.error('[NetworkManager] Failed to cleanup orphaned networks:', error);
  }
}

/**
 * Emergency cleanup - prune all unused CodeRunner networks immediately
 * Used when subnet exhaustion is detected
 */
export async function emergencyNetworkCleanup(): Promise<void> {
  try {
    console.log('[NetworkManager] ⚠️ EMERGENCY: Pruning all unused CodeRunner networks');
    
    // Docker network prune removes all unused networks matching filter
    const { stdout } = await execAsync(
      `docker network prune -f --filter "label=${NETWORK_LABEL}"`,
      { timeout: 30000 }
    );
    
    console.log(`[NetworkManager] Emergency cleanup result: ${stdout.trim()}`);
    
    // Additional manual cleanup of session networks with no containers
    const networks = await listSessionNetworks();
    let manualCleanupCount = 0;
    
    for (const networkName of networks) {
      try {
        const { stdout: containersOutput } = await execAsync(
          `docker network inspect ${networkName} --format "{{len .Containers}}"`,
          { timeout: 5000 }
        );
        const containerCount = parseInt(containersOutput.trim(), 10);
        
        if (containerCount === 0) {
          const sessionId = networkName.replace(NETWORK_PREFIX, '');
          await deleteSessionNetwork(sessionId);
          manualCleanupCount++;
        }
      } catch (error) {
        // Ignore errors during emergency cleanup
      }
    }
    
    console.log(`[NetworkManager] Emergency cleanup: manually removed ${manualCleanupCount} additional networks`);
  } catch (error) {
    console.error('[NetworkManager] Emergency cleanup failed:', error);
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
 * Get network name from session ID
 */
export function getNetworkName(sessionId: string): string {
  return `${NETWORK_PREFIX}${sessionId}`;
}
