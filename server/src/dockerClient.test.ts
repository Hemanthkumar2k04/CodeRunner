/**
 * Tests for Docker SDK Client
 *
 * Unit tests that mock the dockerode library to verify the SDK wrapper
 * behaves correctly without requiring a real Docker daemon.
 */

import { PassThrough } from 'stream';

// ─── Stable mock objects (survive clearAllMocks) ─────────────────────────────

const mockStart = jest.fn().mockResolvedValue(undefined);
const mockRemove = jest.fn().mockResolvedValue(undefined);
const mockPutArchive = jest.fn().mockResolvedValue(undefined);
const mockExecInspect = jest.fn().mockResolvedValue({ ExitCode: 0 });

const mockExecStart = jest.fn();
const mockExec = jest.fn().mockResolvedValue({
  start: mockExecStart,
  inspect: mockExecInspect,
});

const mockContainerInstance = {
  id: 'abc123container',
  start: mockStart,
  remove: mockRemove,
  exec: mockExec,
  putArchive: mockPutArchive,
};

const mockNetworkRemove = jest.fn().mockResolvedValue(undefined);
const mockNetworkInspect = jest.fn().mockResolvedValue({
  Created: '2024-01-01T00:00:00.000000000Z',
  IPAM: { Config: [{ Subnet: '172.20.0.0/16' }] },
  Containers: {},
});
const mockNetworkDisconnect = jest.fn().mockResolvedValue(undefined);

const mockNetworkInstance = {
  id: 'net123',
  inspect: mockNetworkInspect,
  remove: mockNetworkRemove,
  disconnect: mockNetworkDisconnect,
};

// Shared docker instance mock — same reference used throughout test lifetime
const mockDockerInstance = {
  createContainer: jest.fn().mockResolvedValue(mockContainerInstance),
  getContainer: jest.fn().mockReturnValue(mockContainerInstance),
  listContainers: jest.fn().mockResolvedValue([]),
  createNetwork: jest.fn().mockResolvedValue(mockNetworkInstance),
  getNetwork: jest.fn().mockReturnValue(mockNetworkInstance),
  listNetworks: jest.fn().mockResolvedValue([]),
  pruneNetworks: jest.fn().mockResolvedValue({ NetworksDeleted: ['net1'] }),
  getImage: jest.fn().mockReturnValue({
    inspect: jest.fn().mockResolvedValue({}),
  }),
  ping: jest.fn().mockResolvedValue('OK'),
  modem: {
    demuxStream: jest.fn(),
  },
};

jest.mock('dockerode', () => {
  // The default export is a constructor — return a function that always
  // yields the same shared mock so module-level `new Docker()` works.
  return jest.fn().mockImplementation(() => mockDockerInstance);
});

jest.mock('tar-stream', () => {
  const { PassThrough: PT } = require('stream');
  return {
    pack: () => {
      const stream = new PT();
      stream.entry = (_opts: any, content: Buffer) => {
        stream.write(content);
      };
      stream.finalize = () => {
        stream.end();
      };
      return stream;
    },
  };
});

// ─── Import after mocking ───────────────────────────────────────────────────

import {
  createContainer,
  removeContainers,
  listContainers,
  putFiles,
  createNetwork,
  networkExists,
  inspectNetwork,
  removeNetwork,
  listNetworks,
  pruneNetworks,
  pingDaemon,
  imageExists,
} from './dockerClient';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('DockerClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-apply default resolved values after clearAllMocks wipes them
    mockStart.mockResolvedValue(undefined);
    mockRemove.mockResolvedValue(undefined);
    mockPutArchive.mockResolvedValue(undefined);
    mockExecInspect.mockResolvedValue({ ExitCode: 0 });
    mockNetworkRemove.mockResolvedValue(undefined);
    mockNetworkInspect.mockResolvedValue({
      Created: '2024-01-01T00:00:00.000000000Z',
      IPAM: { Config: [{ Subnet: '172.20.0.0/16' }] },
      Containers: {},
    });
    mockDockerInstance.createContainer.mockResolvedValue(mockContainerInstance);
    mockDockerInstance.getContainer.mockReturnValue(mockContainerInstance);
    mockDockerInstance.listContainers.mockResolvedValue([]);
    mockDockerInstance.createNetwork.mockResolvedValue(mockNetworkInstance);
    mockDockerInstance.getNetwork.mockReturnValue(mockNetworkInstance);
    mockDockerInstance.listNetworks.mockResolvedValue([]);
    mockDockerInstance.pruneNetworks.mockResolvedValue({ NetworksDeleted: ['net1'] });
    mockDockerInstance.getImage.mockReturnValue({
      inspect: jest.fn().mockResolvedValue({}),
    });
    mockDockerInstance.ping.mockResolvedValue('OK');
  });

  describe('createContainer', () => {
    it('should create a container with correct options', async () => {
      const id = await createContainer({
        image: 'python-runtime:latest',
        labels: { type: 'coderunner', sessionId: 'sess-1' },
        networkName: 'runner-net',
        memory: '256m',
        cpus: '0.5',
        env: ['HOME=/home/runner'],
      });

      expect(id).toBe('abc123container');
      // start() is called separately via startContainer() — not inside createContainer
      expect(mockStart).not.toHaveBeenCalled();

      expect(mockDockerInstance.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Image: 'python-runtime:latest',
          Labels: { type: 'coderunner', sessionId: 'sess-1' },
          Env: ['HOME=/home/runner'],
          WorkingDir: '/app',
          HostConfig: expect.objectContaining({
            Memory: 256 * 1024 * 1024,
            NetworkMode: 'runner-net',
          }),
        }),
      );
    });

    it('should omit Cmd when cmd is not provided (e.g. database containers)', async () => {
      await createContainer({
        image: 'node-runtime',
        labels: {},
        networkName: 'net',
        memory: '128m',
        cpus: '1',
        // cmd intentionally omitted — pool passes undefined for SQL images
      });

      const callArg = mockDockerInstance.createContainer.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('Cmd');
    });

    it('should pass explicit Cmd when provided', async () => {
      await createContainer({
        image: 'node-runtime',
        labels: {},
        networkName: 'net',
        memory: '128m',
        cpus: '1',
        cmd: ['tail', '-f', '/dev/null'],
      });

      expect(mockDockerInstance.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: ['tail', '-f', '/dev/null'],
        }),
      );
    });
  });

  describe('removeContainers', () => {
    it('should remove containers with force and volume flags', async () => {
      await removeContainers(['c1', 'c2']);

      expect(mockDockerInstance.getContainer).toHaveBeenCalledTimes(2);
      expect(mockRemove).toHaveBeenCalledWith({ force: true, v: true });
    });

    it('should ignore 404 errors gracefully', async () => {
      mockRemove.mockRejectedValueOnce({ statusCode: 404, message: 'not found' });

      // Should not throw
      await removeContainers(['gone-container']);
    });
  });

  describe('listContainers', () => {
    it('should format label filter correctly', async () => {
      mockDockerInstance.listContainers.mockResolvedValueOnce([
        { Id: 'c1', Created: 1700000000, Labels: { type: 'coderunner' } },
      ]);

      const result = await listContainers({ type: 'coderunner' });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('c1');
      expect(result[0].created).toBe(1700000000000); // converted to ms
    });
  });

  describe('putFiles', () => {
    it('should create tar archive and put it into the container', async () => {
      await putFiles('container-1', [
        { path: 'main.py', content: 'print("hello")' },
        { path: 'utils.py', content: 'def add(a,b): return a+b' },
      ]);

      expect(mockDockerInstance.getContainer).toHaveBeenCalledWith('container-1');
      expect(mockPutArchive).toHaveBeenCalledWith(
        expect.anything(),
        { path: '/app' },
      );
    });

    it('should use custom destination directory', async () => {
      await putFiles('c1', [{ path: 'test.py', content: '' }], '/home/runner');

      expect(mockPutArchive).toHaveBeenCalledWith(
        expect.anything(),
        { path: '/home/runner' },
      );
    });
  });

  describe('Network operations', () => {
    it('createNetwork should create with proper options', async () => {
      const id = await createNetwork({
        name: 'runner-net-abc',
        driver: 'bridge',
        subnet: '172.20.0.0/16',
        labels: { type: 'coderunner' },
      });

      expect(id).toBe('net123');
      expect(mockDockerInstance.createNetwork).toHaveBeenCalledWith(
        expect.objectContaining({
          Name: 'runner-net-abc',
          Driver: 'bridge',
          IPAM: {
            Driver: 'default',
            Config: [{ Subnet: '172.20.0.0/16' }],
          },
        }),
      );
    });

    it('networkExists should return true when network exists', async () => {
      expect(await networkExists('runner-net')).toBe(true);
    });

    it('networkExists should return false when network is missing', async () => {
      mockNetworkInspect.mockRejectedValueOnce(new Error('not found'));
      expect(await networkExists('missing-net')).toBe(false);
    });

    it('inspectNetwork should return parsed metadata', async () => {
      const result = await inspectNetwork('runner-net');

      expect(result.subnet).toBe('172.20.0.0/16');
      expect(result.containerCount).toBe(0);
      expect(result.created).toBe('2024-01-01T00:00:00.000000000Z');
    });

    it('removeNetwork should ignore 404s', async () => {
      mockNetworkRemove.mockRejectedValueOnce({ statusCode: 404 });
      await expect(removeNetwork('gone-net')).resolves.toBeUndefined();
    });

    it('listNetworks should filter by name prefix', async () => {
      mockDockerInstance.listNetworks.mockResolvedValueOnce([
        { Name: 'runner-net-1' },
        { Name: 'runner-net-2' },
      ]);

      const result = await listNetworks('runner-net');
      expect(result).toEqual(['runner-net-1', 'runner-net-2']);
    });

    it('pruneNetworks should return deleted network names', async () => {
      const result = await pruneNetworks('type=coderunner');
      expect(result).toEqual(['net1']);
    });
  });

  describe('Daemon operations', () => {
    it('pingDaemon should return true on success', async () => {
      expect(await pingDaemon()).toBe(true);
    });

    it('pingDaemon should return false on failure', async () => {
      mockDockerInstance.ping.mockRejectedValueOnce(new Error('connection refused'));
      expect(await pingDaemon()).toBe(false);
    });

    it('imageExists should return true when image exists', async () => {
      expect(await imageExists('python-runtime')).toBe(true);
    });

    it('imageExists should return false when image is missing', async () => {
      mockDockerInstance.getImage.mockReturnValueOnce({
        inspect: jest.fn().mockRejectedValueOnce(new Error('not found')),
      });
      expect(await imageExists('missing-image')).toBe(false);
    });
  });
});
