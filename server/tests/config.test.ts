import { config, validateConfig, getRuntimeConfig } from '../src/config';

describe('Configuration', () => {
  describe('config object', () => {
    it('should have all required server properties', () => {
      expect(config.server).toBeDefined();
      expect(config.server.port).toBeGreaterThan(0);
      expect(config.server.host).toBeDefined();
      expect(config.server.env).toBeDefined();
    });

    it('should have all required docker properties', () => {
      expect(config.docker).toBeDefined();
      expect(config.docker.memory).toBeDefined();
      expect(config.docker.cpus).toBeDefined();
      expect(config.docker.timeout).toBeDefined();
    });

    it('should have all required network properties', () => {
      expect(config.network).toBeDefined();
      expect(config.network.sessionNetworkPrefix).toBeDefined();
      expect(config.network.subnetPools).toBeDefined();
      expect(config.network.subnetPools.length).toBeGreaterThan(0);
    });

    it('should have all required session properties', () => {
      expect(config.sessionContainers).toBeDefined();
      expect(config.sessionContainers.ttl).toBeGreaterThan(0);
      expect(config.sessionContainers.cleanupInterval).toBeGreaterThan(0);
    });

    it('should have all required runtime images', () => {
      const languages = ['python', 'javascript', 'cpp', 'java', 'sql'];
      languages.forEach(lang => {
        expect(config.runtimes[lang as keyof typeof config.runtimes]).toBeDefined();
        expect(config.runtimes[lang as keyof typeof config.runtimes].image).toBeDefined();
      });
    });
  });

  describe('validateConfig()', () => {
    it('should not throw for valid configuration', () => {
      expect(() => validateConfig()).not.toThrow();
    });

    it('should have subnet capacity calculation', () => {
      const totalCapacity = config.network.subnetPools.reduce((sum, pool) => sum + pool.capacity, 0);
      expect(totalCapacity).toBeGreaterThan(0);
      expect(totalCapacity).toBeGreaterThanOrEqual(256); // At least pool2 capacity
    });
  });

  describe('getRuntimeConfig()', () => {
    it('should return config for valid languages', () => {
      const languages = ['python', 'javascript', 'cpp', 'java', 'sql'];
      languages.forEach(lang => {
        const runtime = getRuntimeConfig(lang);
        expect(runtime).toBeDefined();
        expect(runtime.image).toBeDefined();
        expect(runtime.language).toBe(lang);
      });
    });

    it('should throw error for unsupported language', () => {
      expect(() => getRuntimeConfig('ruby')).toThrow('Unsupported language');
      expect(() => getRuntimeConfig('golang')).toThrow('Unsupported language');
    });

    it('should have consistent language mapping', () => {
      const python = getRuntimeConfig('python');
      expect(python.language).toBe('python');
      expect(python.image).toContain('python');
    });
  });

  describe('port configuration', () => {
    it('should use default port 3000', () => {
      expect(config.server.port).toBe(3000);
    });

    it('should be a valid port number', () => {
      expect(config.server.port).toBeGreaterThanOrEqual(1);
      expect(config.server.port).toBeLessThanOrEqual(65535);
    });
  });

  describe('environment-specific config', () => {
    it('should have test mode when NODE_ENV is set', () => {
      const env = config.server.env;
      expect(env).toBeDefined();
      expect(['development', 'production', 'test']).toContain(env);
    });

    it('should have memory limits configured', () => {
      const memory = config.docker.memory;
      expect(memory).toMatch(/^\d+(m|g|mb|gb)$/i);
    });
  });

  describe('network configuration', () => {
    it('should have session network prefix', () => {
      expect(config.network.sessionNetworkPrefix).toContain('coderunner');
      expect(config.network.sessionNetworkPrefix).toContain('session');
    });

    it('should have valid CIDR subnets in pools', () => {
      config.network.subnetPools.forEach(pool => {
        expect(pool.cidr).toMatch(/^\d+\.\d+\.\d+\.\d+\/\d+$/);
        expect(pool.capacity).toBeGreaterThan(0);
      });
    });

    it('should have proper pool naming', () => {
      const poolNames = config.network.subnetPools.map(p => p.name);
      expect(poolNames.length).toBeGreaterThan(0);
      poolNames.forEach(name => {
        expect(name).toBeDefined();
      });
    });
  });

  describe('session container config', () => {
    it('should have TTL in milliseconds', () => {
      expect(config.sessionContainers.ttl).toBeGreaterThan(0);
      expect(typeof config.sessionContainers.ttl).toBe('number');
    });

    it('should have cleanup interval', () => {
      expect(config.sessionContainers.cleanupInterval).toBeGreaterThan(0);
      expect(config.sessionContainers.cleanupInterval).toBeLessThan(config.sessionContainers.ttl * 2);
    });

    it('should enforce max containers per session', () => {
      expect(config.sessionContainers.maxPerSession).toBeGreaterThan(0);
      expect(config.sessionContainers.maxPerSession).toBeLessThanOrEqual(100);
    });
  });

  describe('file management config', () => {
    it('should have max file size limit', () => {
      expect(config.files.maxFileSize).toBeGreaterThan(0);
      expect(config.files.maxFileSize).toBeGreaterThanOrEqual(1048576); // At least 1MB
    });

    it('should have max files per session', () => {
      expect(config.files.maxFilesPerSession).toBeGreaterThan(0);
    });

    it('should have temp directory configured', () => {
      expect(config.files.tempDir).toBeDefined();
      expect(config.files.tempDir).not.toBe('');
    });
  });
});
