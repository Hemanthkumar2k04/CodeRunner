# Architecture

## System Overview

CodeRunner executes user code in isolated Docker containers with real-time output streaming via WebSockets. Supports 4,352 concurrent sessions with explicit subnet allocation and automatic resource management.

```
┌──────────────┐  WebSocket   ┌──────────────┐  Docker   ┌──────────────┐
│   Browser    │◄────────────►│   Server     │◄─────────►│  Container   │
│   (React)    │   Socket.IO  │  (Node.js)   │           │  (Runtime)   │
└──────────────┘              └──────────────┘           └──────────────┘
```

## Network Architecture

**Subnet Allocation System:**

- Pre-configured Docker pools: `172.80.0.0/12` and `10.10.0.0/16`
- Explicit /24 subnet assignment to each session
- Deterministic allocation with counters (race-condition safe)
- Pool 1: 4,096 /24 subnets, Pool 2: 256 /24 subnets
- Total capacity: **4,352 concurrent sessions**

**Session Isolation:**

```
Each session gets:
├── Unique Docker bridge network (explicit subnet)
├── On-demand containers with TTL
└── Automatic cleanup on disconnect
```

## Execution Pipeline

1. **Connection**: Client connects via Socket.IO, receives unique session ID
2. **Network**: Isolated Docker network created with pre-allocated subnet
3. **Code**: Files submitted, validated, and queued for execution
4. **Container**: On-demand container created/reused with 60s TTL
5. **Execution**: Code runs with resource limits, output streamed live
6. **Cleanup**: Container expires or network removed on disconnect

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

| Event           | Action                                      |
| --------------- | ------------------------------------------- |
| First code run  | Create container, attach to session network |
| Subsequent runs | Reuse existing container, refresh TTL       |
| 60s inactivity  | Container auto-deleted                      |
| Disconnect      | Immediate container + network cleanup       |

## Configuration Management

All backend settings are centralized in `config.ts` with environment variable overrides:

**Server Configuration:**

- Port, host, environment, logging level

**Docker Resources:**

- Memory limits per container type
- CPU allocation per container type
- Command execution timeout

**Network Configuration:**

- Subnet pool definitions with capacity tracking
- Network prefix, driver, and label customization

**Session Management:**

- Container TTL and cleanup intervals
- Max containers per session
- Orphaned network cleanup threshold

**Runtime Images:**

- Configurable Docker image names for all languages
- File size and count limits per session

See `server/.env.example` for complete configuration reference.

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

## Performance Metrics

| Aspect                   | Detail                                   |
| ------------------------ | ---------------------------------------- |
| **First Execution**      | ~1-2s (container creation + compilation) |
| **Reused Execution**     | ~200-400ms (existing container)          |
| **Container TTL**        | 60 seconds (auto-cleanup)                |
| **Memory per Container** | 128MB (standard), 256MB (notebooks)      |
| **CPU per Container**    | 0.5 cores (standard), 1 core (notebooks) |
| **Execution Timeout**    | 30 seconds per run                       |
| **Network Capacity**     | 4,352 concurrent subnets                 |
| **Load Test Result**     | 40 concurrent users = 100% success       |
