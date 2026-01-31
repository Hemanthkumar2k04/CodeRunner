/**
 * Test utilities and mocks for server tests
 */

/**
 * Mock for child_process.exec
 */
export const mockExec = jest.fn();

/**
 * Mock for child_process.spawn
 */
export const mockSpawn = jest.fn(() => ({
  stdout: { on: jest.fn() },
  stderr: { on: jest.fn() },
  on: jest.fn(),
  kill: jest.fn(),
  pid: 12345,
}));

/**
 * Mock for child_process.execSync
 */
export const mockExecSync = jest.fn((cmd: string) => {
  if (cmd.includes('docker')) {
    return 'mock-container-output';
  }
  return '';
});

/**
 * Mock Socket.io connection
 */
export const createMockSocket = () => ({
  id: 'test-socket-123',
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  disconnect: jest.fn(),
  handshake: {
    query: {},
  },
});

/**
 * Mock Docker command responses
 */
export const createMockDockerResponse = (type: string) => {
  switch (type) {
    case 'create-network':
      return JSON.stringify({ ID: 'network-123' });
    case 'create-container':
      return 'container-123';
    case 'container-exists':
      return 'container-123';
    case 'network-exists':
      return 'true';
    default:
      return '';
  }
};

/**
 * Setup test environment
 */
export const setupTestEnvironment = () => {
  process.env.NODE_ENV = 'test';
  process.env.SERVER_PORT = '3000';
  process.env.SERVER_HOST = 'localhost';
};

/**
 * Cleanup test environment
 */
export const cleanupTestEnvironment = () => {
  jest.clearAllMocks();
};
