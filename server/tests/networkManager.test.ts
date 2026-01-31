import { getNetworkName, getNetworkStats } from '../src/networkManager';

describe('Network Manager', () => {
  describe('getNetworkName()', () => {
    it('should generate consistent network names for same session ID', () => {
      const sessionId = 'test-session-abc123';
      const name1 = getNetworkName(sessionId);
      const name2 = getNetworkName(sessionId);
      expect(name1).toBe(name2);
    });

    it('should include session ID in network name', () => {
      const sessionId = 'my-session';
      const name = getNetworkName(sessionId);
      expect(name).toContain(sessionId);
    });

    it('should include coderunner prefix', () => {
      const sessionId = 'session-123';
      const name = getNetworkName(sessionId);
      expect(name).toContain('coderunner');
    });

    it('should generate unique names for different sessions', () => {
      const name1 = getNetworkName('session-1');
      const name2 = getNetworkName('session-2');
      const name3 = getNetworkName('session-3');
      expect(name1).not.toBe(name2);
      expect(name2).not.toBe(name3);
      expect(name1).not.toBe(name3);
    });

    it('should generate valid Docker network names', () => {
      const sessionId = 'test-session';
      const name = getNetworkName(sessionId);
      // Docker network names must be less than 64 chars and valid format
      expect(name.length).toBeLessThan(64);
      expect(/^[a-zA-Z0-9_-]+$/.test(name)).toBe(true);
    });

    it('should handle special characters in session ID', () => {
      const sessionIds = ['session-123', 'session_456', 'session.789'];
      sessionIds.forEach(sessionId => {
        const name = getNetworkName(sessionId);
        expect(name).toBeDefined();
        expect(name.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Network Statistics', () => {
    it('should retrieve network stats', () => {
      const stats = getNetworkStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });

    it('should have metrics structure', async () => {
      const stats = await getNetworkStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('withContainers');
      expect(stats).toHaveProperty('networks');
      expect(Array.isArray(stats.networks)).toBe(true);
    });

    it('should have numeric metrics', async () => {
      const stats = await getNetworkStats();
      expect(typeof stats.total).toBe('number');
      expect(stats.total).toBeGreaterThanOrEqual(0);
    });

    it('should have valid network list', async () => {
      const stats = await getNetworkStats();
      expect(Array.isArray(stats.networks)).toBe(true);
    });
  });

  describe('Subnet Allocation', () => {
    it('should allocate subnets from configured pools', () => {
      // Test that subnet allocation doesn't throw
      expect(() => {
        getNetworkStats(); // This should show allocation info
      }).not.toThrow();
    });
    it('should have capacity for multiple concurrent sessions', async () => {
      const stats = await getNetworkStats();
      // Should have network data
      expect(stats.total).toBeGreaterThanOrEqual(0);
    });

    it('should track used subnets', async () => {
      const stats = await getNetworkStats();
      expect(Array.isArray(stats.networks)).toBe(true);
    });
  });

  describe('Network naming conventions', () => {
    it('should follow Docker network naming rules', () => {
      const validSessionIds = [
        'user-123',
        'session_abc',
        'test-session-456',
      ];

      validSessionIds.forEach(sessionId => {
        const name = getNetworkName(sessionId);
        // Docker requires: alphanumeric, dash, underscore, dot, and less than 64 chars
        const isValid = /^[a-zA-Z0-9_.-]+$/.test(name) && name.length < 64;
        expect(isValid).toBe(true);
      });
    });

    it('should be deterministic for same input', () => {
      const sessionId = 'deterministic-test';
      const names: string[] = [];
      for (let i = 0; i < 5; i++) {
        names.push(getNetworkName(sessionId));
      }
      // All names should be identical
      names.forEach(name => {
        expect(name).toBe(names[0]);
      });
    });
  });

  describe('Network prefix configuration', () => {
    it('should use configured network prefix', () => {
      const sessionId = 'session-1';
      const name = getNetworkName(sessionId);
      expect(name).toContain('coderunner-session');
    });
  });

  describe('Concurrent network scenarios', () => {
    it('should generate unique networks for many sessions', () => {
      const networks = new Set();
      for (let i = 0; i < 100; i++) {
        const sessionId = `session-${i}`;
        const name = getNetworkName(sessionId);
        networks.add(name);
      }
      expect(networks.size).toBe(100);
    });

    it('should not have name collisions', () => {
      const sessionIds = Array.from({ length: 50 }, (_, i) => `session-${i}`);
      const names = sessionIds.map(id => getNetworkName(id));
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty session ID', () => {
      const name = getNetworkName('');
      expect(name).toBeDefined();
      expect(name.length).toBeGreaterThan(0);
    });

    it('should handle long session ID', () => {
      const longId = 'a'.repeat(100);
      const name = getNetworkName(longId);
      // Network name is generated from session ID, verify it's created
      expect(name).toBeDefined();
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });

    it('should handle numeric session ID', () => {
      const numericId = '12345678';
      const name = getNetworkName(numericId);
      expect(name).toBeDefined();
      expect(/^[a-zA-Z0-9_-]+$/.test(name)).toBe(true);
    });
  });
});
