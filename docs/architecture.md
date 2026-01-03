# Architecture

## System Overview

CodeRunner uses a **Warm Container Pool** to minimize execution latency:

1. **Initialization**: Server pre-warms 3 Docker containers per language on startup
2. **Execution**: When code runs, the frontend sends files + entry point to backend via Socket.io
3. **Container Acquisition**: Server grabs an idle container from the pool (~0ms overhead)
4. **Execution**: Files are copied and executed inside container
5. **Output Streaming**: Stdout/stderr/exit events streamed back via WebSockets
6. **Cleanup**: Container killed and new one started to replenish pool

## Multi-Console Architecture

Each file execution gets its own isolated console:

- **Session Tracking**: Each execution assigned unique sessionId
- **Per-File Consoles**: Console named with file path (e.g., "src/main.py")
- **Output Limits**: 2,000 entries per console, FIFO eviction when full
- **Isolation**: Output properly routed by sessionId between server and client
- **Tab Interface**: Switch between active consoles like VS Code

## Performance

- **Cold Start**: `docker run` (~1.5s)
- **Warm Pool**: `docker cp` + `docker exec` (~100ms)
- **Virtualization**: React Virtual renders only visible rows (~30 rows visible, 10,000+ supported)

## Security

- **Network Isolation**: `--network none` on all containers
- **Resource Limits**: CPU and memory capped per container
- **Ephemeral Execution**: Containers removed immediately after use
- **Execution Timeout**: Hard 5-second limit per execution
