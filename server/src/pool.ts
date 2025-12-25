import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from './config';

const execAsync = promisify(exec);

class ContainerPool {
  private pool: Record<string, string[]> = {};
  private maxSize: number;

  constructor() {
    this.maxSize = config.pool.maxSize;
    // Initialize empty pools for each language
    Object.keys(config.runtimes).forEach(lang => {
      this.pool[lang] = [];
    });
  }

  /**
   * Initialize the pool with warm containers
   */
  async initialize() {
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
   * Creates a new container and adds it to the pool
   */
  private async createContainer(language: string) {
    const runtimeConfig = config.runtimes[language as keyof typeof config.runtimes];
    if (!runtimeConfig) return;

    try {
      // Start a container that stays alive (tail -f /dev/null)
      const { stdout } = await execAsync(
        `docker run -d --network ${config.docker.network} --memory ${config.docker.memory} --cpus ${config.docker.cpus} ${runtimeConfig.image} tail -f /dev/null`
      );
      
      const containerId = stdout.trim();
      this.pool[language].push(containerId);
    } catch (error) {
      console.error(`Failed to create ${language} container:`, error);
    }
  }

  /**
   * Get a container from the pool.
   */
  async getContainer(language: string): Promise<string> {
    if (this.pool[language].length > 0) {
      return this.pool[language].shift()!;
    }
    
    console.warn(`Pool empty for ${language}, creating on-demand.`);
    await this.createContainer(language);
    return this.pool[language].shift()!;
  }

  /**
   * Recycle the container
   */
  async recycleContainer(language: string, containerId: string) {
    exec(`docker rm -f ${containerId}`, (err) => {
      if (err) console.error(`Failed to remove container ${containerId}:`, err);
    });
    this.createContainer(language);
  }

  /**
   * Cleanup all containers in the pool
   */
  async cleanup() {
    console.log('Cleaning up container pool...');
    const promises = [];
    for (const lang of Object.keys(this.pool)) {
      for (const containerId of this.pool[lang]) {
        promises.push(execAsync(`docker rm -f ${containerId}`));
      }
      this.pool[lang] = []; // Clear the pool
    }
    await Promise.all(promises);
    console.log('Container Pool Cleaned Up 🧹');
  }
}

export const containerPool = new ContainerPool();
