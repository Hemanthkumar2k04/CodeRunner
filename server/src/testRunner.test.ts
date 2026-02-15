import { startLoadTest, getTestRunner, stopTest, getActiveTests } from './testRunner';

// Helper to attach error listener on a test runner to prevent unhandled 'error' events
function suppressRunnerErrors(testId: string) {
  const runner = getTestRunner(testId);
  if (runner) {
    (runner as any).on('error', () => {});
  }
}

describe('testRunner', () => {
  describe('startLoadTest', () => {
    it('should reject invalid intensity', async () => {
      await expect(startLoadTest('extreme')).rejects.toThrow('Invalid intensity: extreme');
    });

    it('should accept valid intensities', async () => {
      // These will fail because the test script doesn't exist in test env,
      // but the function should not throw on validation
      for (const intensity of ['light', 'moderate', 'heavy']) {
        const testId = await startLoadTest(intensity);
        expect(testId).toBeDefined();
        expect(testId.startsWith('test_')).toBe(true);

        suppressRunnerErrors(testId);
        stopTest(testId);
      }
    });

    it('should generate unique test IDs', async () => {
      const id1 = await startLoadTest('light');
      const id2 = await startLoadTest('light');
      expect(id1).not.toBe(id2);

      suppressRunnerErrors(id1);
      suppressRunnerErrors(id2);
      stopTest(id1);
      stopTest(id2);
    });
  });

  describe('getTestRunner', () => {
    it('should return undefined for unknown test ID', () => {
      const runner = getTestRunner('nonexistent');
      expect(runner).toBeUndefined();
    });

    it('should return runner for active test', async () => {
      const testId = await startLoadTest('light');
      const runner = getTestRunner(testId);
      expect(runner).toBeDefined();
      expect(runner?.id).toBe(testId);
      expect(runner?.intensity).toBe('light');

      suppressRunnerErrors(testId);
      stopTest(testId);
    });
  });

  describe('stopTest', () => {
    it('should return false for unknown test', () => {
      expect(stopTest('nonexistent')).toBe(false);
    });

    it('should stop a running test', async () => {
      const testId = await startLoadTest('light');
      suppressRunnerErrors(testId);
      const result = stopTest(testId);
      expect(result).toBe(true);

      const runner = getTestRunner(testId);
      expect(runner?.status).toBe('failed');
    });
  });

  describe('getActiveTests', () => {
    it('should return array of active tests', async () => {
      const id1 = await startLoadTest('light');
      const id2 = await startLoadTest('moderate');

      suppressRunnerErrors(id1);
      suppressRunnerErrors(id2);

      const active = getActiveTests();
      expect(Array.isArray(active)).toBe(true);
      expect(active.length).toBeGreaterThanOrEqual(2);

      const test1 = active.find(t => t.id === id1);
      expect(test1).toBeDefined();
      expect(test1?.intensity).toBe('light');
      expect(test1?.startTime).toBeGreaterThan(0);

      stopTest(id1);
      stopTest(id2);
    });

    it('should include duration', async () => {
      const testId = await startLoadTest('light');
      suppressRunnerErrors(testId);

      // Small delay to get non-zero duration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const active = getActiveTests();
      const test = active.find(t => t.id === testId);
      expect(test?.duration).toBeGreaterThanOrEqual(0);

      stopTest(testId);
    });
  });
});
