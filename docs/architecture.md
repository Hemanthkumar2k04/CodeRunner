# Architecture & Design

## 📂 Project Structure

```
CodeRunner/
├── client/                 # React Frontend application
│   ├── src/                # Frontend source code
│   └── vite.config.ts      # Vite configuration
├── server/                 # Backend Node.js application
│   ├── src/
│   │   └── index.ts        # Core runner logic & example usage
│   └── temp/               # Temporary directories for execution (gitignored)
├── runtimes/               # Dockerfile definitions for language runtimes
│   └── python/             # Python runtime configuration
└── docker-compose.yml      # Service orchestration
```

## 🧩 How It Works

The system uses a **Warm Container Pool** strategy to minimize execution latency.

1.  **Initialization**: On startup, the server pre-warms a set of Docker containers (default: 3 per language) that sit idle, waiting for requests.
2.  **Submission**: When a student clicks "Run", the frontend bundles the source files and identifies the entry point (marked with `toBeExec: true`).
3.  **Acquisition**: The server instantly acquires an idle container from the pool (0ms overhead). If the pool is empty, it creates a new one on demand.
4.  **File Transfer**: The server writes the files to a temporary directory on the host and copies them into the running container using `docker cp`.
5.  **Execution**: The entry file is executed inside the container using `docker exec`.
6.  **Recycling**: After execution, the used container is killed and removed to ensure isolation. A new container is immediately started in the background to replenish the pool.

## ⚡ Performance Optimization

To avoid the "Cold Start" penalty of Docker (which can take 1-2 seconds per request), CodeRunner maintains a pool of running containers.

- **Cold Start**: `docker run` -> Mount -> Execute -> Stop. (~1.5s latency)
- **Warm Pool**: `docker cp` -> `docker exec`. (~100ms latency)

## 🛡️ Security Features

- **Network Isolation**: Containers run with `--network none`.
- **Resource Limits**: Memory and CPU usage are strictly capped.
- **Ephemeral**: Containers are removed (`--rm`) immediately after execution.
- **Timeouts**: Execution is hard-capped (default 5s) to prevent infinite loops.
