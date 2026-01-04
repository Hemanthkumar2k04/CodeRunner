export const config = {
  server: {
    port: process.env.PORT || 3000,
  },
  docker: {
    memory: '128m',
    cpus: '0.5',
    timeout: '30s', // Increased to handle compilation + execution time
  },
  sessionContainers: {
    networkPrefix: 'coderunner-session-',
    ttl: 60000,              // 1 minute (60000ms)
    cleanupInterval: 30000,  // Check for expired containers every 30 seconds
    maxPerSession: 10,       // Warning threshold (not hard limit)
    autoCleanup: true,
  },
  runtimes: {
    python: {
      image: 'python-runtime',
    },
    cpp: {
      image: 'cpp-runtime',
    },
    javascript: {
      image: 'node-runtime',
    },
    java: {
      image: 'java-runtime',
    },
    sql: {
      image: 'mysql-runtime',
    },
  },
};
