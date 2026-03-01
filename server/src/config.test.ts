import { config, validateConfig, getRuntimeConfig } from './config';

describe('config', () => {
    describe('config object', () => {
        it('should have server configuration', () => {
            expect(config.server).toBeDefined();
            expect(typeof config.server.port).toBe('number');
            expect(typeof config.server.host).toBe('string');
        });

        it('should have default port 3000', () => {
            expect(config.server.port).toBe(3000);
        });

        it('should have docker configuration', () => {
            expect(config.docker).toBeDefined();
            expect(config.docker.memory).toBeDefined();
            expect(config.docker.cpus).toBeDefined();
            expect(config.docker.timeout).toBeDefined();
        });

        it('should have network configuration', () => {
            expect(config.network).toBeDefined();
            expect(config.network.sessionNetworkPrefix).toBe('coderunner-session-');
            expect(config.network.networkDriver).toBe('bridge');
            expect(config.network.subnetPools).toHaveLength(2);
        });

        it('should have subnet pools with capacity', () => {
            const pool1 = config.network.subnetPools[0];
            expect(pool1.name).toBe('pool1');
            expect(pool1.capacity).toBe(4096);

            const pool2 = config.network.subnetPools[1];
            expect(pool2.name).toBe('pool2');
            expect(pool2.capacity).toBe(256);
        });

        it('should have session container configuration', () => {
            expect(config.sessionContainers).toBeDefined();
            expect(config.sessionContainers.ttl).toBe(90000);
            expect(config.sessionContainers.cleanupInterval).toBe(30000);
            expect(config.sessionContainers.maxConcurrentSessions).toBe(50);
        });

        it('should have execution queue configuration', () => {
            expect(config.executionQueue).toBeDefined();
            expect(config.executionQueue.maxQueueSize).toBe(200);
            expect(config.executionQueue.queueTimeout).toBe(60000);
        });

        it('should have runtime configurations for all languages', () => {
            expect(config.runtimes.python).toBeDefined();
            expect(config.runtimes.python.image).toBe('python-runtime');
            expect(config.runtimes.cpp).toBeDefined();
            expect(config.runtimes.javascript).toBeDefined();
            expect(config.runtimes.java).toBeDefined();
            expect(config.runtimes.sql).toBeDefined();
        });

        it('should have logging configuration', () => {
            expect(config.logging).toBeDefined();
            expect(config.logging.format).toBe('text');
        });

        it('should have file management configuration', () => {
            expect(config.files).toBeDefined();
            expect(config.files.maxFileSize).toBe(10485760); // 10MB
            expect(config.files.maxFilesPerSession).toBe(50);
        });
    });

    describe('validateConfig', () => {
        it('should not throw for valid configuration', () => {
            expect(() => validateConfig()).not.toThrow();
        });
    });

    describe('getRuntimeConfig', () => {
        it('should return config for python', () => {
            const runtime = getRuntimeConfig('python');
            expect(runtime.image).toBe('python-runtime');
            expect(runtime.language).toBe('python');
        });

        it('should return config for javascript', () => {
            const runtime = getRuntimeConfig('javascript');
            expect(runtime.image).toBe('javascript-runtime');
            expect(runtime.language).toBe('javascript');
        });

        it('should return config for java', () => {
            const runtime = getRuntimeConfig('java');
            expect(runtime.image).toBe('java-runtime');
        });

        it('should return config for cpp', () => {
            const runtime = getRuntimeConfig('cpp');
            expect(runtime.image).toBe('cpp-runtime');
        });

        it('should return config for sql', () => {
            const runtime = getRuntimeConfig('sql');
            expect(runtime.image).toBe('postgres-runtime');
        });

        it('should throw for unsupported language', () => {
            expect(() => getRuntimeConfig('ruby')).toThrow('Unsupported language: ruby');
            expect(() => getRuntimeConfig('go')).toThrow('Unsupported language: go');
        });
    });
});
