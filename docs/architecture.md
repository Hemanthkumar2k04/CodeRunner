# Architecture

## Overview

CodeRunner executes user code in isolated Docker containers with real-time output streaming via WebSockets.

```
┌─────────────┐     WebSocket      ┌─────────────┐     Docker      ┌─────────────┐
│   Browser   │ ◄───────────────► │   Server    │ ◄─────────────► │  Container  │
│   (React)   │    Socket.IO      │  (Node.js)  │                 │  (Runtime)  │
└─────────────┘                   └─────────────┘                 └─────────────┘
```

## Execution Flow

1. **Connection**: Client connects via Socket.IO, gets unique session ID
2. **Network Creation**: Isolated Docker bridge network created for session
3. **Code Submission**: Files sent to server via `run` event
4. **Container**: On-demand container created, attached to session network
5. **Execution**: Code compiled/run, stdout/stderr streamed back in real-time
6. **Cleanup**: Container reused (60s TTL) or deleted, network removed on disconnect

## Session-Based Container Pool

Each user session gets:
- **Isolated network**: `coderunner-session-{socketId}`
- **On-demand containers**: Created when code runs, reused within TTL
- **Automatic cleanup**: Containers expire after 60s inactivity

```
Session Connect → Network Created → Code Run → Container Created → Reused for 60s → Cleanup
                                                    ↑                    │
                                                    └────────────────────┘
```

## Container Lifecycle

| Event | Action |
|-------|--------|
| First code run | Create container, attach to session network |
| Subsequent runs | Reuse existing container, refresh TTL |
| 60s inactivity | Container auto-deleted |
| Disconnect | Immediate container + network cleanup |

## Security Model

| Layer | Protection |
|-------|-----------|
| **Network** | Each session has isolated Docker bridge network |
| **Resources** | CPU: 0.5 cores, Memory: 128MB per container |
| **Execution** | 30-second timeout per execution |
| **Cleanup** | Automatic removal of expired containers/networks |

## Project Structure

```
CodeRunner/
├── client/                 # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── components/    # UI components (CodeEditor, Console, Workspace)
│   │   ├── hooks/         # useSocket (WebSocket connection)
│   │   ├── stores/        # Zustand state (useEditorStore)
│   │   └── lib/           # Utilities
│   └── package.json
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── index.ts       # Socket.IO server, execution handler
│   │   ├── pool.ts        # Container pool with TTL management
│   │   ├── networkManager.ts  # Docker network lifecycle
│   │   ├── kernelManager.ts   # Notebook kernel support
│   │   └── config.ts      # Configuration
│   └── package.json
├── runtimes/              # Docker images for each language
│   ├── python/
│   ├── javascript/
│   ├── java/
│   ├── cpp/
│   └── mysql/
├── docs/                  # Documentation
└── setup.sh               # One-command setup script
```

## Performance

| Metric | Value |
|--------|-------|
| First execution | ~1-2s (container creation) |
| Subsequent runs | ~200-400ms (container reuse) |
| Container TTL | 60 seconds |
| Cleanup interval | 30 seconds |
| Max concurrent sessions | ~30 (default), 4000+ (with `--configure-net`) |
