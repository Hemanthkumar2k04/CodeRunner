# Architecture

## System Overview

CodeRunner supports two execution modes:

### Fast Mode (Default - Warm Container Pool)

1. **Initialization**: Server pre-warms 3 Docker containers per language on startup
2. **Execution**: When code runs, the frontend sends files + entry point to backend via Socket.io
3. **Container Acquisition**: Server grabs an idle container from the pool (~0ms overhead)
4. **Execution**: Files are copied and executed inside container
5. **Output Streaming**: Stdout/stderr/exit events streamed back via WebSockets
6. **Cleanup**: Container returned to pool for reuse

### Network Mode (User-Controlled Toggle)

1. **Session Networks**: Each socket connection gets isolated Docker network: `coderunner-session-{socketId}`
2. **On-Demand Containers**: Containers created when needed and attached to session network
3. **Socket Programming**: Containers can communicate via localhost (e.g., Java Server/Client)
4. **Cleanup**: Containers deleted after execution, networks cleaned on disconnect
5. **Isolation**: Multiple users can use same ports without conflicts

**Switching Modes**: Users toggle network mode via Navbar button (Wifi icon). Network mode trades ~1-2s startup time for full networking capabilities.

## Multi-Console Architecture

Each file execution gets its own isolated console:

- **Session Tracking**: Each execution assigned unique sessionId
- **Per-File Consoles**: Console named with file path (e.g., "src/main.py")
- **Output Limits**: 2,000 entries per console, FIFO eviction when full
- **Isolation**: Output properly routed by sessionId between server and client
- **Tab Interface**: Switch between active consoles like VS Code

## Performance

### Fast Mode (Pool)

- **Cold Start**: N/A (pre-warmed)
- **Execution**: `docker cp` + `docker exec` (~100ms)
- **Network**: Disabled (`--network none`)

### Network Mode (Session)

- **First Run**: `docker network create` + `docker run` (~1-2s)
- **Execution**: `docker cp` + `docker exec` (~100-200ms)
- **Network**: Enabled (bridge network per session)

- **Virtualization**: React Virtual renders only visible rows (~30 rows visible, 10,000+ supported)

## Security

### Fast Mode

- **Network Isolation**: `--network none` on all containers
- **Resource Limits**: CPU (0.5) and memory (128MB) capped per container
- **Ephemeral Execution**: Containers returned to pool, cleaned periodically

### Network Mode

- **Session Isolation**: Each user gets unique Docker network (random socket ID)
- **No Cross-User Access**: Networks completely isolated from each other
- **Resource Limits**: Same CPU/memory limits as fast mode
- **Cleanup**: Containers deleted immediately, networks removed on disconnect or after 1 hour
- **Execution Timeout**: Same 30-second timeout per execution
