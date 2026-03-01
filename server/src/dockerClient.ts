/**
 * Docker SDK Client
 *
 * Replaces shell-based `docker` CLI calls with the dockerode SDK.
 * Eliminates process-spawning overhead (~20-50ms per operation) and provides
 * type-safe, structured access to the Docker Engine API.
 *
 * All methods are thin wrappers that mirror the operations previously done
 * via `exec('docker ...')`, making migration straightforward.
 */

import Docker from 'dockerode';
import { logger } from './logger';
import { Readable, PassThrough } from 'stream';
import * as tar from 'tar-stream';
import { execSync } from 'child_process';

/**
 * Resolve the Docker socket path from the active Docker CLI context,
 * falling back to the default `/var/run/docker.sock`.
 */
function resolveDockerSocket(): string {
  try {
    const host = execSync(
      'docker context inspect --format "{{.Endpoints.docker.Host}}"',
      { encoding: 'utf-8', timeout: 5000 },
    ).trim();
    if (host.startsWith('unix://')) {
      return host.replace('unix://', '');
    }
  } catch {
    // ignore – fall through to default
  }
  return '/var/run/docker.sock';
}

/** Singleton Docker client connected to the local daemon */
const docker = new Docker({ socketPath: resolveDockerSocket() });

// ─── Container Operations ────────────────────────────────────────────────────

export interface CreateContainerOptions {
  image: string;
  labels: Record<string, string>;
  networkName?: string;
  memory: string;
  cpus: string;
  env?: string[];
  cmd?: string[];
}

/**
 * Create and start a container, returning its full ID.
 * Equivalent to `docker run -d --label ... --network ... --memory ... --cpus ... <image> [cmd]`
 */
export async function createContainer(opts: CreateContainerOptions): Promise<string> {
  const memoryBytes = parseMemoryString(opts.memory);
  const nanoCpus = parseCpuString(opts.cpus);

  const container = await docker.createContainer({
    Image: opts.image,
    Labels: opts.labels,
    Cmd: opts.cmd ?? ['tail', '-f', '/dev/null'],
    Env: opts.env,
    HostConfig: {
      Memory: memoryBytes,
      NanoCpus: nanoCpus,
      // If network is omitted, Docker puts it on the default bridge initially
      ...(opts.networkName ? { NetworkMode: opts.networkName } : {}),
    },
    WorkingDir: '/app',
  });

  return container.id;
}

/**
 * Start an existing container.
 */
export async function startContainer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);
  await container.start();
}

/**
 * Execute a command inside a running container and return combined output.
 * Equivalent to `docker exec [-w workDir] <id> /bin/sh -c "<command>"`
 */
export async function execInContainer(
  containerId: string,
  command: string,
  options: { workDir?: string; timeout?: number } = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const container = docker.getContainer(containerId);
  const exec = await container.exec({
    Cmd: ['/bin/sh', '-c', command],
    AttachStdout: true,
    AttachStderr: true,
    WorkingDir: options.workDir ?? '/app',
  });

  return new Promise((resolve, reject) => {
    const timeoutMs = options.timeout ?? 30_000;
    let timer: NodeJS.Timeout | undefined;

    exec.start({ hijack: true, stdin: false }, (err: Error | null, stream: NodeJS.ReadableStream | undefined) => {
      if (err || !stream) {
        return reject(err ?? new Error('Failed to start exec stream'));
      }

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      // Docker multiplexes stdout/stderr on a single stream.
      // Use dockerode's demux helper to split them.
      const stdoutStream = new PassThrough();
      const stderrStream = new PassThrough();

      docker.modem.demuxStream(stream, stdoutStream, stderrStream);

      stdoutStream.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
      stderrStream.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          (stream as any).destroy?.();
          reject(new Error(`Exec timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }

      (stream as NodeJS.ReadableStream).on('end', async () => {
        if (timer) clearTimeout(timer);
        try {
          const inspectData = await exec.inspect();
          resolve({
            stdout: Buffer.concat(stdoutChunks).toString(),
            stderr: Buffer.concat(stderrChunks).toString(),
            exitCode: inspectData.ExitCode ?? 0,
          });
        } catch {
          resolve({
            stdout: Buffer.concat(stdoutChunks).toString(),
            stderr: Buffer.concat(stderrChunks).toString(),
            exitCode: -1,
          });
        }
      });

      (stream as NodeJS.ReadableStream).on('error', (streamErr: Error) => {
        if (timer) clearTimeout(timer);
        reject(streamErr);
      });
    });
  });
}

/**
 * Spawn an interactive exec session that returns raw stdout/stderr streams
 * and an stdin writable. Used for long-running processes that need streaming output.
 *
 * Equivalent to `docker exec -i -w /app <id> /bin/sh -c "<command>"`
 */
export async function execInteractive(
  containerId: string,
  command: string,
  options: { workDir?: string } = {},
): Promise<{
  stdout: PassThrough;
  stderr: PassThrough;
  stdin: NodeJS.WritableStream;
  getExitCode: () => Promise<number>;
  kill: () => void;
}> {
  const container = docker.getContainer(containerId);
  const exec = await container.exec({
    Cmd: ['/bin/sh', '-c', command],
    AttachStdout: true,
    AttachStderr: true,
    AttachStdin: true,
    WorkingDir: options.workDir ?? '/app',
    Tty: false,
  });

  return new Promise((resolve, reject) => {
    exec.start({ hijack: true, stdin: true }, (err: Error | null, stream: any) => {
      if (err || !stream) {
        return reject(err ?? new Error('Failed to start interactive exec'));
      }

      const stdoutStream = new PassThrough();
      const stderrStream = new PassThrough();
      docker.modem.demuxStream(stream, stdoutStream, stderrStream);

      // Ensure PassThrough streams end when the raw Docker stream closes.
      // demuxStream only listens for 'end', but hijacked connections
      // (especially via Docker Desktop) may only emit 'close'.
      const endStreams = () => {
        if (!stdoutStream.destroyed) stdoutStream.end();
        if (!stderrStream.destroyed) stderrStream.end();
      };
      stream.on('close', endStreams);
      stream.on('error', endStreams);

      resolve({
        stdout: stdoutStream,
        stderr: stderrStream,
        stdin: stream,
        getExitCode: async () => {
          const inspectData = await exec.inspect();
          return inspectData.ExitCode ?? -1;
        },
        kill: () => {
          try {
            stream.destroy();
          } catch {
            // Best-effort cleanup
          }
        },
      });
    });
  });
}

/**
 * Force-remove one or more containers.
 * Equivalent to `docker rm -fv <ids...>`
 */
export async function removeContainers(containerIds: string[]): Promise<void> {
  await Promise.allSettled(
    containerIds.map(async (id) => {
      try {
        const container = docker.getContainer(id);
        await container.remove({ force: true, v: true });
      } catch (err: any) {
        // Container may already be gone — ignore 404
        if (err.statusCode !== 404) {
          logger.warn('DockerClient', `Failed to remove container ${id.substring(0, 12)}: ${err.message}`);
        }
      }
    }),
  );
}

/**
 * List containers matching a label filter.
 * Equivalent to `docker ps -a --filter "label=key=value" --format "{{.ID}}|{{.CreatedAt}}"`
 */
export async function listContainers(
  labelFilter: Record<string, string>,
  all = true,
): Promise<Array<{ id: string; created: number; labels: Record<string, string> }>> {
  const filters: Record<string, string[]> = {
    label: Object.entries(labelFilter).map(([k, v]) => (v ? `${k}=${v}` : k)),
  };

  const containers = await docker.listContainers({ all, filters });
  return containers.map((c) => ({
    id: c.Id,
    created: c.Created * 1000, // Docker returns seconds, we use ms
    labels: c.Labels,
  }));
}

// ─── File Transfer ───────────────────────────────────────────────────────────

export interface FileEntry {
  /** Relative path inside the container (e.g. "main.py" or "src/app.java") */
  path: string;
  /** UTF-8 file content */
  content: string;
}

/**
 * Stream files directly into a container via an in-memory tar archive.
 * Replaces the host-filesystem temp dir + `docker cp` pattern entirely:
 *
 *   Old: fs.writeFileSync → docker cp → fs.rmSync  (3 I/O steps)
 *   New: tar-stream → container.putArchive          (0 host I/O)
 *
 * This is the single biggest latency improvement for warm-reuse scenarios.
 */
export async function putFiles(containerId: string, files: FileEntry[], destDir = '/app'): Promise<void> {
  const container = docker.getContainer(containerId);
  const archive = await createTarArchive(files);
  await container.putArchive(archive, { path: destDir });
}

/**
 * Create an in-memory tar archive from an array of file entries.
 * Uses tar-stream for zero-disk I/O streaming.
 */
function createTarArchive(files: FileEntry[]): Promise<Readable> {
  return new Promise((resolve, reject) => {
    const pack = tar.pack();

    for (const file of files) {
      const content = Buffer.from(file.content, 'utf-8');
      pack.entry({ name: file.path, size: content.length }, content);
    }

    pack.finalize();

    // Collect into a buffer, then wrap as Readable (dockerode expects Readable)
    const chunks: Buffer[] = [];
    pack.on('data', (chunk: Buffer) => chunks.push(chunk));
    pack.on('end', () => {
      const fullBuffer = Buffer.concat(chunks);
      const readable = new Readable({
        read() {
          this.push(fullBuffer);
          this.push(null);
        },
      });
      resolve(readable);
    });
    pack.on('error', reject);
  });
}

// ─── Network Operations ──────────────────────────────────────────────────────

export interface CreateNetworkOptions {
  name: string;
  driver: string;
  subnet: string;
  labels: Record<string, string>;
}

/**
 * Create a Docker network with explicit subnet.
 * Equivalent to `docker network create --driver ... --subnet=... --label ... <name>`
 */
export async function createNetwork(opts: CreateNetworkOptions): Promise<string> {
  const network = await docker.createNetwork({
    Name: opts.name,
    Driver: opts.driver,
    IPAM: {
      Driver: 'default',
      Config: [{ Subnet: opts.subnet }],
    },
    Labels: opts.labels,
  });

  return network.id;
}

/**
 * Check if a network exists by name.
 * Equivalent to `docker network inspect <name>` (returns true/false).
 */
export async function networkExists(name: string): Promise<boolean> {
  try {
    const network = docker.getNetwork(name);
    await network.inspect();
    return true;
  } catch {
    return false;
  }
}

/**
 * Inspect a network and return its metadata.
 */
export async function inspectNetwork(name: string): Promise<{
  created: string;
  subnet: string;
  containerCount: number;
}> {
  const network = docker.getNetwork(name);
  const info = await network.inspect();
  const subnet = info.IPAM?.Config?.[0]?.Subnet ?? '';
  const containerCount = Object.keys(info.Containers ?? {}).length;
  return { created: info.Created, subnet, containerCount };
}

/**
 * Remove a Docker network.
 * Equivalent to `docker network rm <name>`
 */
export async function removeNetwork(name: string): Promise<void> {
  try {
    const network = docker.getNetwork(name);
    await network.remove();
  } catch (err: any) {
    if (err.statusCode !== 404) {
      throw err;
    }
  }
}

/**
 * List all networks matching a name prefix.
 * Equivalent to `docker network ls --filter name=<prefix>`
 */
export async function listNetworks(namePrefix: string): Promise<string[]> {
  const networks = await docker.listNetworks({
    filters: { name: [namePrefix] },
  });
  return networks.map((n) => n.Name);
}

/**
 * Force-disconnect all containers from a network.
 */
export async function disconnectAllFromNetwork(networkName: string): Promise<void> {
  try {
    const network = docker.getNetwork(networkName);
    const info = await network.inspect();
    const containerIds = Object.keys(info.Containers ?? {});

    await Promise.allSettled(
      containerIds.map((id) =>
        network.disconnect({ Container: id, Force: true }).catch(() => {
          // Container may already be gone
        }),
      ),
    );
  } catch {
    // Network may not exist
  }
}

/**
 * Prune unused CodeRunner networks.
 * Equivalent to `docker network prune -f --filter label=type=coderunner`
 */
export async function pruneNetworks(label: string): Promise<string[]> {
  const result = await docker.pruneNetworks({
    filters: { label: [label] },
  });
  return result.NetworksDeleted ?? [];
}

/**
 * Check if a container is healthy via a command.
 * Used for MySQL readiness checking.
 */
export async function waitForHealthy(
  containerId: string,
  checkCmd: string,
  timeoutMs = 30_000,
  intervalMs = 500,
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const result = await execInContainer(containerId, checkCmd, { timeout: 5000 });
      if (result.exitCode === 0) return;
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`Container ${containerId.substring(0, 12)} not healthy after ${timeoutMs}ms`);
}

// ─── Image Operations ────────────────────────────────────────────────────────

/**
 * Check if an image exists locally.
 * Equivalent to `docker image inspect <name>`
 */
export async function imageExists(name: string): Promise<boolean> {
  try {
    const image = docker.getImage(name);
    await image.inspect();
    return true;
  } catch {
    return false;
  }
}

/**
 * Check Docker daemon connectivity.
 * Equivalent to `docker version`
 */
export async function pingDaemon(): Promise<boolean> {
  try {
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Parse a memory string like "512m" or "1g" into bytes.
 */
function parseMemoryString(mem: string): number {
  const match = mem.match(/^(\d+)(b|k|m|g)?$/i);
  if (!match) return 512 * 1024 * 1024; // Default 512MB

  const value = parseInt(match[1], 10);
  const unit = (match[2] || 'b').toLowerCase();

  switch (unit) {
    case 'g': return value * 1024 * 1024 * 1024;
    case 'm': return value * 1024 * 1024;
    case 'k': return value * 1024;
    default: return value;
  }
}

/**
 * Parse a CPU string like "0.5" into NanoCPUs.
 */
function parseCpuString(cpus: string): number {
  return Math.round(parseFloat(cpus) * 1e9);
}

/** Export the raw docker instance for edge cases */
export { docker };
