export const config = {
  server: {
    port: process.env.PORT || 3000,
  },
  docker: {
    memory: '128m',
    cpus: '0.5',
    network: 'none',
    timeout: '5s',
  },
  pool: {
    maxSize: 3, // Number of warm containers per language
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
  },
};
