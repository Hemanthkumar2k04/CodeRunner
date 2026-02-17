/**
 * Tests for SessionContainerPool
 * 
 * Since the pool interacts with Docker via the SDK, we mock dockerClient
 * and test the pool's logic (metrics, session management, stats) without Docker.
 */

jest.mock('./dockerClient', () => ({
    createContainer: jest.fn().mockResolvedValue('mock-container-id'),
    execInContainer: jest.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
    removeContainers: jest.fn().mockResolvedValue(undefined),
    listContainers: jest.fn().mockResolvedValue([]),
    waitForHealthy: jest.fn().mockResolvedValue(undefined),
}));

import { sessionPool } from './pool';

describe('SessionContainerPool', () => {
    beforeEach(() => {
        sessionPool.resetMetrics();
    });

    describe('getMetrics', () => {
        it('should return metrics object', () => {
            const metrics = sessionPool.getMetrics();
            expect(metrics).toHaveProperty('containersCreated');
            expect(metrics).toHaveProperty('containersReused');
            expect(metrics).toHaveProperty('containersDeleted');
            expect(metrics).toHaveProperty('cleanupErrors');
            expect(metrics).toHaveProperty('lastCleanupDuration');
            expect(metrics).toHaveProperty('totalActiveContainers');
            expect(metrics).toHaveProperty('queueDepth');
        });

        it('should start with zero counts after reset', () => {
            const metrics = sessionPool.getMetrics();
            expect(metrics.containersCreated).toBe(0);
            expect(metrics.containersReused).toBe(0);
            expect(metrics.cleanupErrors).toBe(0);
        });
    });

    describe('resetMetrics', () => {
        it('should reset all counter metrics', () => {
            sessionPool.resetMetrics();
            const metrics = sessionPool.getMetrics();
            expect(metrics.containersCreated).toBe(0);
            expect(metrics.containersReused).toBe(0);
            expect(metrics.containersDeleted).toBe(0);
            expect(metrics.cleanupErrors).toBe(0);
            expect(metrics.lastCleanupDuration).toBe(0);
            expect(metrics.queueDepth).toBe(0);
        });
    });

    describe('getStats', () => {
        it('should return pool statistics', () => {
            const stats = sessionPool.getStats();
            expect(stats).toHaveProperty('totalContainers');
            expect(stats).toHaveProperty('bySession');
            expect(stats).toHaveProperty('byLanguage');
            expect(typeof stats.totalContainers).toBe('number');
        });

        it('should have empty records initially', () => {
            const stats = sessionPool.getStats();
            expect(stats.totalContainers).toBe(0);
            expect(Object.keys(stats.bySession)).toHaveLength(0);
            expect(Object.keys(stats.byLanguage)).toHaveLength(0);
        });
    });

    describe('getSessionCount', () => {
        it('should return 0 when no sessions exist', () => {
            expect(sessionPool.getSessionCount()).toBe(0);
        });
    });
});
