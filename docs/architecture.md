# System Architecture

Comprehensive guide to CodeRunner's architecture and how all components work together.

## Overview

CodeRunner is a distributed code execution platform that safely executes user code in isolated Docker containers. The system manages execution requests through a priority-based queue and maintains container pools for different programming languages.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (Browser)                       │
│          React App with Monaco Editor + WebSocket           │
└──────────────────────┬──────────────────────────────────────┘
                       │ WebSocket Connection
┌──────────────────────▼──────────────────────────────────────┐
│                   Backend Server (Node.js)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         HTTP Routes & WebSocket Handlers             │   │
│  │    - Code Execution  - File Management              │   │
│  │    - Session Control - Admin Metrics                │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                     │
│  ┌──────────────────────▼───────────────────────────────┐   │
│  │         Execution Queue System                       │   │
│  │   ┌─────────────────────────────────────────────┐    │   │
│  │   │  - Task Prioritization (WebSocket > API)    │    │   │
│  │   │  - Concurrency Control (Max 50 concurrent)  │    │   │
│  │   │  - Timeout Management (60s expiration)      │    │   │
│  │   └─────────────────────────────────────────────┘    │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                     │
│  ┌──────────────────────▼───────────────────────────────┐   │
│  │      Container Pool Management                       │   │
│  │   ┌─────────────────────────────────────────────┐    │   │
│  │   │  - Python Runtime Containers                │    │   │
│  │   │  - JavaScript Runtime Containers            │    │   │
│  │   │  - Java Runtime Containers                  │    │   │
│  │   │  - C++ Runtime Containers                   │    │   │
│  │   │  - MySQL Database Containers                │    │   │
│  │   └─────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │    Docker Network         │
         │  (Isolated Containers)    │
         └───────────────────────────┘
```

## Core Components

### 1. Frontend (Client)

**Location**: `client/src/`

**Key Responsibilities**:

- Render code editor with Monaco Editor integration
- Manage file structure UI
- Handle user interactions for code execution
- Display real-time execution output via WebSocket
- Support multi-console tabs for different file executions

**Key Files**:

- `App.tsx` - Main application component
- `Workspace.tsx` - Main workspace layout
- `CodeEditor.tsx` - Monaco Editor integration
- `Console.tsx` - Output display component
- `FilePreview.tsx` - File explorer and management

### 2. Backend Server

**Location**: `server/src/`

**Main Responsibilities**:

- Handle HTTP API requests
- Manage WebSocket connections
- Coordinate task execution
- Manage container lifecycle
- Maintain session state

**Key Files**:

- `index.ts` - Express server setup and routes
- `kernelManager.ts` - Jupyter kernel management
- `workerPool.ts` - Worker thread pool management
- `pool.ts` - Container pool lifecycle management
- `config.ts` - Configuration management

### 3. Execution Queue System

**Location**: `server/src/workerPool.ts`

The queue is the heart of CodeRunner's execution model.

**Architecture**:

```typescript
ExecutionQueue {
  queue: QueuedTask[]        // Pending tasks, sorted by priority
  activeCount: number        // Currently executing tasks
  maxConcurrent: number      // Concurrency limit (default: 50)
  completedTasks: number     // Success counter
  failedTasks: number        // Error counter
  taskTimes: number[]        // Recent execution times
}

interface QueuedTask {
  task: () => Promise<void>  // Execution function
  priority: number           // Higher = more important
  timestamp: number          // Queue entry time
  language?: string          // For metrics tracking
}
```

**Priority Levels**:
| Source | Priority | Use Case |
|--------|----------|----------|
| WebSocket | 2 | User clicking "Run" |
| HTTP API | 1 | Programmatic execution |
| Notebooks | 0 | Background kernel execution |

**Task Processing**:

1. Client sends execution request via WebSocket or HTTP
2. Task is added to queue with appropriate priority
3. Queue sorts tasks by priority (descending), then FIFO
4. When concurrency slots available, task is executed
5. Task execution is non-blocking (fire-and-forget pattern)
6. On completion, metrics are recorded and next task is processed

**Key Optimization**: Tasks are executed without `await`, allowing true parallel execution without blocking the event loop.

### 4. Container Pool Management

**Location**: `server/src/pool.ts`

Manages Docker containers for each language runtime.

**Container Lifecycle**:

```
Request for Language X
    │
    ▼
Check if container available in pool
    │
    ├─ Yes → Reuse container (200-400ms)
    │
    └─ No → Create new container (1-2s first run)
    │
    ▼
Execute code in container
    │
    ▼
Return output to client
    │
    ▼
Container TTL = 60 seconds
    │
    ├─ Used again → Reset TTL
    │
    └─ Unused → Auto cleanup
```

**Container Features**:

- Isolated Docker networks for each session
- Resource limits (CPU, memory)
- Automatic cleanup after TTL expires
- Metrics collection (container creation time, reuse rate)

**Supported Languages**:

- Python 3.x
- JavaScript/Node.js
- Java 11+
- C++ (g++)
- MySQL/SQL

### 5. WebSocket Real-Time Communication

**Location**: `server/src/index.ts` and `lib/socket.ts`

**Message Flow**:

```
Client                          Server
  │                               │
  ├─ "execute_code" ─────────────►│
  │                          (queued)
  │                               │ (processing)
  │◄─ "output" (streaming) ───────┤
  │◄─ "status" ─────────────────────┤
  │◄─ "completion" ────────────────┤
  │                               │
```

**Event Types**:

- `execute_code` - Request to execute code
- `output` - Code output lines
- `status` - Execution status updates
- `completion` - Execution completed with metrics
- `error` - Execution errors

### 6. Network Management

**Container Networking**:

- Each session gets isolated Docker network
- Subnet allocation follows pattern `172.25.{session_id}.0/24`
- Enables socket programming and multi-container communication
- MySQL containers accessible within same network

**Network Features**:

- Container-to-container communication
- Network isolation between sessions
- Automatic cleanup when session ends

## Request Lifecycle

### Code Execution Request

1. **Client sends request**:

   ```javascript
   socket.emit("execute_code", {
     files: [{ name: "main.py", content: "..." }],
     language: "python",
     mainFile: "main.py",
   });
   ```

2. **Server queues task**:
   - Validates input
   - Creates QueuedTask with WebSocket priority
   - Adds to execution queue

3. **Queue processes task**:
   - Sorts by priority and FIFO
   - Executes when slot available
   - Non-blocking execution

4. **Execution engine**:
   - Gets container from pool or creates new one
   - Writes code files to container
   - Executes in container environment
   - Streams output via WebSocket

5. **Client receives output**:
   - Real-time output display
   - Execution metrics (duration, status)
   - Errors if any

## Performance Characteristics

### Timing

- **First execution** (new container): ~1-2 seconds
- **Subsequent execution** (reused container): ~200-400ms
- **Queue processing**: ~10-50ms per task
- **Output streaming**: Real-time (WebSocket)

### Scalability

- **Concurrent sessions**: Up to 50 concurrent (configurable)
- **Queue capacity**: 200 pending tasks
- **Container pools**: Per-language container reuse
- **Worker threads**: Configurable (default: based on CPU cores)

### Resource Management

- Container TTL: 60 seconds
- Auto cleanup: Unused containers
- Memory limits: Per container
- CPU limits: Per container

## Configuration

**Key Configuration Files**:

- `server/.env` - Environment variables
- `server/src/config.ts` - Configuration loading and defaults

**Important Variables**:

- `MAX_CONCURRENT_SESSIONS` - Concurrency limit (default: 50)
- `QUEUE_TIMEOUT` - Task expiration time (default: 60s)
- `CONTAINER_TTL` - Container reuse timeout (default: 60s)
- `WORKER_THREADS` - Worker thread count

## Technology Stack

### Frontend

- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Monaco Editor** - Code editor
- **Socket.IO** - Real-time communication

### Backend

- **Node.js** - Runtime
- **Express** - Web framework
- **TypeScript** - Type safety
- **Docker** - Container runtime
- **Worker Threads** - Parallel execution
- **Socket.IO** - WebSocket server

### Execution

- **Docker** - Container technology
- **Language Runtimes** - Python, Node.js, Java, C++, MySQL in containers

## Error Handling

### Client-Side Errors

- Syntax errors in code
- File not found errors
- Execution timeouts

### Server-Side Errors

- Container creation failures
- Resource exhaustion
- Queue timeouts
- Network isolation failures

All errors are streamed to client via WebSocket with descriptive messages.

## Security

### Isolation

- Code runs in isolated Docker containers
- Network isolation per session
- Resource limits prevent DoS
- No access to host system

### Protection

- Queue timeout prevents runaway tasks
- Concurrency limits prevent resource exhaustion
- Container TTL ensures cleanup
- WebSocket authentication via session tokens

## Monitoring & Metrics

**Metrics Collected**:

- Task completion time
- Success/failure counts
- Queue depth
- Active containers
- Container reuse rate
- Network metrics

**Endpoints**:

- `GET /api/queue-stats` - Queue and execution metrics
- `GET /api/admin/metrics` - System-wide metrics

## Future Enhancements

- Multi-node deployment
- Advanced scheduling algorithms
- Container image caching
- Distributed task queue
- Advanced monitoring and alerting
