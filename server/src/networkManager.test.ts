import { getNetworkName, getNetworkMetrics, resetNetworkMetrics, getSubnetStats } from './networkManager';
import { config } from './config';

describe('networkManager', () => {
    describe('getNetworkName', () => {
        it('should generate network name from session ID', () => {
            const name = getNetworkName('abc123');
            expect(name).toBe(`${config.network.sessionNetworkPrefix}abc123`);
        });

        it('should use the configured prefix', () => {
            const name = getNetworkName('test-session');
            expect(name).toContain('coderunner-session-');
            expect(name).toContain('test-session');
        });

        it('should handle empty session ID', () => {
            const name = getNetworkName('');
            expect(name).toBe(config.network.sessionNetworkPrefix);
        });
    });

    describe('getNetworkMetrics', () => {
        it('should return metrics object', () => {
            const metrics = getNetworkMetrics();
            expect(metrics).toHaveProperty('networksCreated');
            expect(metrics).toHaveProperty('networksDeleted');
            expect(metrics).toHaveProperty('cleanupErrors');
            expect(metrics).toHaveProperty('lastCleanupDuration');
            expect(metrics).toHaveProperty('totalActiveNetworks');
            expect(metrics).toHaveProperty('orphanedNetworkCount');
            expect(metrics).toHaveProperty('escalationLevel');
        });

        it('should return a copy (not the original object)', () => {
            const metrics1 = getNetworkMetrics();
            const metrics2 = getNetworkMetrics();
            expect(metrics1).not.toBe(metrics2);
            expect(metrics1).toEqual(metrics2);
        });
    });

    describe('resetNetworkMetrics', () => {
        it('should reset counter metrics to zero', () => {
            resetNetworkMetrics();
            const metrics = getNetworkMetrics();
            expect(metrics.networksCreated).toBe(0);
            expect(metrics.networksDeleted).toBe(0);
            expect(metrics.cleanupErrors).toBe(0);
            expect(metrics.lastCleanupDuration).toBe(0);
            expect(metrics.escalationLevel).toBe(0);
        });
    });

    describe('getSubnetStats', () => {
        it('should return subnet allocation statistics', () => {
            const stats = getSubnetStats();
            expect(stats).toHaveProperty('totalUsed');
            expect(stats).toHaveProperty('totalAvailable');
            expect(stats).toHaveProperty('activeSubnets');
            expect(stats).toHaveProperty('poolStats');
        });

        it('should have pool1 and pool2 stats', () => {
            const stats = getSubnetStats();
            expect(stats.poolStats).toHaveProperty('pool1');
            expect(stats.poolStats).toHaveProperty('pool2');
        });

        it('should show available capacity', () => {
            const stats = getSubnetStats();
            expect(stats.totalAvailable).toBeGreaterThan(0);
            expect(stats.poolStats.pool1.available).toBe(4096);
            expect(stats.poolStats.pool2.available).toBe(256);
        });

        it('should have utilization percentage', () => {
            const stats = getSubnetStats();
            expect(stats.poolStats.pool1.utilization).toContain('%');
            expect(stats.poolStats.pool2.utilization).toContain('%');
        });
    });
});
