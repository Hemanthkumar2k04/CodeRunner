/**
 * Production-level configuration management
 * All configurable values are centralized here
 * Environment variables override defaults
 */

export const config = {
  // === Server Configuration ===
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },

  // === Docker Configuration ===
  docker: {
    // Resource limits per container
    memory: process.env.DOCKER_MEMORY || '512m',
    memorySQL: process.env.DOCKER_MEMORY_SQL || '512m', // SQL containers need more memory
    cpus: process.env.DOCKER_CPUS || '0.5',
    cpusNotebook: process.env.DOCKER_CPUS_NOTEBOOK || '1', // Notebook kernels get more CPU
    
    // Timeouts
    timeout: process.env.DOCKER_TIMEOUT || '30s', // Process execution timeout
    commandTimeout: parseInt(process.env.DOCKER_CMD_TIMEOUT || '15000', 10), // Docker command timeout (ms)
  },

  // === Network Configuration ===
  network: {
    // Session network naming and lifecycle
    sessionNetworkPrefix: process.env.NETWORK_PREFIX || 'coderunner-session-',
    networkDriver: 'bridge',
    networkLabel: 'type=coderunner',
    
    // Subnet allocation pools (must match /etc/docker/daemon.json)
    subnetPools: [
      {
        name: 'pool1',
        base: '172.80',
        cidr: '172.80.0.0/12',
        capacity: 4096, // 2^(24-12) /24 subnets
      },
      {
        name: 'pool2',
        base: '192.168',
        cidr: '192.168.0.0/16',
        capacity: 256, // 2^(24-16) /24 subnets
      },
    ],
  },

  // === Session Container Management ===
  sessionContainers: {
    // TTL and cleanup
    ttl: parseInt(process.env.SESSION_TTL || '30000', 10), // 30 seconds
    cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '30000', 10), // 30 seconds
    orphanedNetworkAge: parseInt(process.env.ORPHANED_NETWORK_AGE || '300000', 10), // 5 minutes
    
    // Concurrency control for parallel execution requests
    maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5', 10), // Number of simultaneous run requests
    
    // Pooling configuration
    maxPerSession: parseInt(process.env.MAX_CONTAINERS_PER_SESSION || '10', 10),
    autoCleanup: process.env.AUTO_CLEANUP !== 'false',
    preWarmPool: process.env.PREWARM_POOL === 'true',
  },

  // === Execution Queue Configuration ===
  executionQueue: {
    maxQueueSize: parseInt(process.env.MAX_QUEUE_SIZE || '200', 10),
    queueTimeout: parseInt(process.env.QUEUE_TIMEOUT || '60000', 10), // ms
    enablePriorityQueue: process.env.ENABLE_PRIORITY_QUEUE !== 'false',
  },

  // === Worker Thread Pool Configuration ===
  workerPool: {
    enabled: process.env.ENABLE_WORKER_POOL === 'true',
    threads: parseInt(process.env.WORKER_THREADS || '0', 10),
  },

  // === Container Runtime Images ===
  runtimes: {
    python: {
      image: process.env.PYTHON_RUNTIME_IMAGE || 'python-runtime',
      language: 'python',
    },
    cpp: {
      image: process.env.CPP_RUNTIME_IMAGE || 'cpp-runtime',
      language: 'cpp',
    },
    javascript: {
      image: process.env.JAVASCRIPT_RUNTIME_IMAGE || 'javascript-runtime',
      language: 'javascript',
    },
    java: {
      image: process.env.JAVA_RUNTIME_IMAGE || 'java-runtime',
      language: 'java',
    },
    sql: {
      image: process.env.MYSQL_RUNTIME_IMAGE || 'mysql-runtime',
      language: 'sql',
    },
  },

  // === Logging and Monitoring ===
  logging: {
    format: process.env.LOG_FORMAT || 'text', // 'text' or 'json'
    requestLogging: process.env.REQUEST_LOGGING !== 'false',
    errorDetails: process.env.NODE_ENV === 'development',
  },

  // === File Management ===
  files: {
    tempDir: process.env.TEMP_DIR || '/tmp',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    maxFilesPerSession: parseInt(process.env.MAX_FILES_PER_SESSION || '50', 10),
  },
} as const;

/**
 * Validate configuration at startup
 */
export function validateConfig(): void {
  if (config.server.port < 1 || config.server.port > 65535) {
    throw new Error(`Invalid port: ${config.server.port}`);
  }

  const validRuntimes = Object.keys(config.runtimes);
  if (validRuntimes.length === 0) {
    throw new Error('No runtime images configured');
  }

  const totalSubnetCapacity = config.network.subnetPools.reduce((sum, pool) => sum + pool.capacity, 0);
  console.log(`[Config] Network capacity: ${totalSubnetCapacity} concurrent sessions`);
}

/**
 * Get runtime configuration by language
 */
export function getRuntimeConfig(language: string) {
  const runtime = config.runtimes[language as keyof typeof config.runtimes];
  if (!runtime) {
    throw new Error(`Unsupported language: ${language}`);
  }
  return runtime;
}
