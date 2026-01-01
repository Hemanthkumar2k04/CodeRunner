import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from './config';

const execAsync = promisify(exec);

class ContainerPool {
  private pool: Record<string, string[]> = {};
  private maxSize: number;
  private pendingCreations: Record<string, Promise<string | null>[]> = {};

  constructor() {
    this.maxSize = config.pool.maxSize;
    // Initialize empty pools for each language
    Object.keys(config.runtimes).forEach(lang => {
      this.pool[lang] = [];
      this.pendingCreations[lang] = [];
    });
  }

  /**
   * Initialize the pool with warm containers
   */
  async initialize() {
    // Ensure we start clean by removing any old containers from previous runs
    await this.cleanup();

    console.log('Initializing Container Pool...');
    const promises = [];
    for (const lang of Object.keys(config.runtimes)) {
      for (let i = 0; i < this.maxSize; i++) {
        promises.push(this.createContainer(lang));
      }
    }
    await Promise.all(promises);
    console.log('Container Pool Initialized 🚀');
  }

  /**
   * Creates a new container and returns the container ID directly (doesn't add to pool)
   */
  private async createContainerDirect(language: string): Promise<string | null> {
    const runtimeConfig = config.runtimes[language as keyof typeof config.runtimes];
    if (!runtimeConfig) return null;

    try {
      // Build docker run command with appropriate settings
      // MySQL needs bridge network for its IPC, others can use none for security
      const network = language === 'sql' ? 'bridge' : config.docker.network;
      const memory = language === 'sql' ? '256m' : config.docker.memory;
      
      let dockerCmd = `docker run -d --label type=coderunner-worker --network ${network} --memory ${memory} --cpus ${config.docker.cpus}`;
      
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
      console.log(`Created ${language} container: ${containerId}`);
      
      // For MySQL, wait longer for initialization
      if (language === 'sql') {
        console.log(`Waiting for MySQL to initialize...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
        console.log(`MySQL container ready`);
      }

      return containerId;
    } catch (error) {
      console.error(`Failed to create ${language} container:`, error);
      return null;
    }
  }

  /**
   * Creates a new container and adds it to the pool
   */
  private async createContainer(language: string) {
    const containerId = await this.createContainerDirect(language);
    if (containerId) {
      this.pool[language].push(containerId);
    }
  }

  /**
   * Get a container from the pool.
   * Creates new containers on-demand if pool is empty.
   * Handles concurrent requests properly.
   */
  async getContainer(language: string): Promise<string> {
    // Check if pool has available container
    if (this.pool[language].length > 0) {
      const containerId = this.pool[language].shift()!;
      console.log(`[Pool] Got ${language} container from pool: ${containerId.substring(0, 12)}`);
      return containerId;
    }
    
    // Pool is empty - create a new container on-demand
    console.warn(`[Pool] Pool empty for ${language}, creating on-demand container...`);
    
    const containerId = await this.createContainerDirect(language);
    
    if (!containerId) {
      throw new Error(`Failed to create ${language} container on-demand`);
    }
    
    console.log(`[Pool] Created on-demand ${language} container: ${containerId.substring(0, 12)}`);
    return containerId;
  }

  /**
   * Return a container to the pool or delete it if pool is at max capacity
   * This ensures we maintain exactly maxSize warm containers per language
   */
  returnOrDeleteContainer(language: string, containerId: string) {
    // If pool has space, return the container
    if (this.pool[language].length < this.maxSize) {
      this.pool[language].push(containerId);
      console.log(`[Pool] Returned ${language} container to pool: ${containerId.substring(0, 12)} (pool size: ${this.pool[language].length})`);
    } else {
      // Pool is at capacity, delete the container after 5 second delay
      setTimeout(() => {
        exec(`docker rm -fv ${containerId}`, (err) => {
          if (err) {
            console.error(`[Pool] Failed to delete container ${containerId.substring(0, 12)}:`, err.message);
          } else {
            console.log(`[Pool] Deleted excess container: ${containerId.substring(0, 12)}`);
          }
        });
      }, 5000);
    }
  }

  /**
   * Recycle the container and create a new one for the pool
   * This is non-blocking - the new container is created asynchronously
   * @deprecated Use returnOrDeleteContainer instead
   */
  recycleContainer(language: string, containerId: string) {
    // Remove container with -v flag to also remove associated volumes
    exec(`docker rm -fv ${containerId}`, (err) => {
      if (err) console.error(`[Pool] Failed to remove container ${containerId.substring(0, 12)}:`, err.message);
      else console.log(`[Pool] Removed container: ${containerId.substring(0, 12)}`);
    });
    
    // Asynchronously replenish the pool
    this.createContainer(language).then(() => {
      console.log(`[Pool] Replenished ${language} pool (size: ${this.pool[language].length})`);
    });
  }

  /**
   * Get current pool status for monitoring
   */
  getStatus(): Record<string, number> {
    const status: Record<string, number> = {};
    for (const lang of Object.keys(this.pool)) {
      status[lang] = this.pool[lang].length;
    }
    return status;
  }

  /**
   * Cleanup all containers in the pool (and any orphans) and remove their volumes
   */
  async cleanup() {
    console.log('Cleaning up container pool...');
    
    // 1. Clear in-memory pool
    for (const lang of Object.keys(this.pool)) {
      this.pool[lang] = [];
    }

    // 2. Force remove ALL containers labeled as coderunner-worker and their volumes
    try {
      const { stdout } = await execAsync('docker ps -aq --filter label=type=coderunner-worker');
      if (stdout.trim()) {
        await execAsync(`docker rm -fv ${stdout.trim().replace(/\n/g, ' ')}`);
      }
    } catch (e) {
      // Ignore error
    }
    
    console.log('Container Pool Cleaned Up 🧹');
  }
}

export const containerPool = new ContainerPool();
