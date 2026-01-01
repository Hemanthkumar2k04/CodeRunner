export const config = {
  server: {
    port: process.env.PORT || 3000,
  },
  docker: {
    memory: '128m',
    cpus: '0.5',
    network: 'none',
    timeout: '30s', // Increased to handle compilation + execution time
  },
  pool: {
    maxSize: 3, // Number of warm containers per language (scales on-demand beyond this)
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
