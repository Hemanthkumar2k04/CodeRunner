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
   * Creates a new container and adds it to the pool
   */
  private async createContainer(language: string) {
    const runtimeConfig = config.runtimes[language as keyof typeof config.runtimes];
    if (!runtimeConfig) return;

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
      this.pool[language].push(containerId);
      console.log(`Created ${language} container: ${containerId}`);
      
      // For MySQL, wait longer for initialization
      if (language === 'sql') {
        console.log(`Waiting for MySQL to initialize...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
        console.log(`MySQL container ready`);
      }
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
   * Cleanup all containers in the pool (and any orphans)
   */
  async cleanup() {
    console.log('Cleaning up container pool...');
    
    // 1. Clear in-memory pool
    for (const lang of Object.keys(this.pool)) {
      this.pool[lang] = [];
    }

    // 2. Force remove ALL containers labeled as coderunner-worker
    try {
      const { stdout } = await execAsync('docker ps -aq --filter label=type=coderunner-worker');
      if (stdout.trim()) {
        await execAsync(`docker rm -f ${stdout.trim().replace(/\n/g, ' ')}`);
      }
    } catch (e) {
      // Ignore error
    }
    
    console.log('Container Pool Cleaned Up 🧹');
  }
}

export const containerPool = new ContainerPool();
