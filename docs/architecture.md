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
│  │   │  - PostgreSQL Database Containers             │    │   │
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
- Manage file structure UI with collapsible sidebar
- Handle user interactions for code execution
- Display real-time execution output via WebSocket
- Support multi-console tabs for different file executions
- Provide admin dashboard for system metrics and monitoring

**Key Files**:

- `App.tsx` - Main application component with routing to `/editor` by default
- `Workspace.tsx` - Main workspace layout with collapsible sidebar support
- `CodeEditor.tsx` - Monaco Editor integration
- `Console.tsx` - Output display component
- `FilePreview.tsx` - File explorer and management
- `AdminPage.tsx` - Admin dashboard with system metrics and monitoring
- `ResponsiveLayout.tsx` - Responsive layout with collapsible sidebar toggle

**Recent Enhancements (Feb 2026)**:

- Removed HomePage and LabPage components, routing now defaults to `/editor`
- Implemented collapsible sidebar for better mobile/small screen experience
- Admin dashboard enhanced with real-time system metrics (CPU, memory, uptime)

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
- `pool.ts` - Container pool lifecycle management
- `config.ts` - Configuration management

### 3. Execution Queue System

**Location**: `server/src/index.ts`

The queue is the heart of CodeRunner's execution model, managing task prioritization and concurrent container execution.

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
- PostgreSQL/SQL

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

**Location**: `server/src/networkManager.ts`

**Container Networking**:

- Each session gets isolated Docker network
- Subnet allocation follows pattern `172.25.{session_id}.0/24`
- Enables socket programming and multi-container communication
- PostgreSQL containers accessible within same network

**Network Features**:

- Container-to-container communication
- Network isolation between sessions
- Automatic cleanup when session ends
- **Mutex-based concurrent creation** to prevent race conditions during network setup
- **Emergency cleanup procedures** to force-disconnect containers before network removal
- **Thread-safe network creation** ensuring proper isolation in high-concurrency scenarios

**Recent Enhancements (Feb 2026)**:

- Added mutex locks for concurrent network creation operations
- Implemented force-disconnect mechanism before network removal
- Improved error handling for network cleanup edge cases
- Enhanced resilience during high-load scenarios

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
- **Language Runtimes** - Python, Node.js, Java, C++, PostgreSQL in containers

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

### Authentication & Authorization

- **Admin routes** now require `X-Admin-Key` header instead of query parameters
- Admin key validation in production prevents unauthorized access
- Improved error handling for missing/invalid ADMIN_KEY

### Input Validation & Sanitization

- File validation on upload to prevent malicious files
- File path sanitization to prevent directory traversal attacks
- Content validation before code execution
- Protection against injection attacks

**Recent Enhancements (Feb 2026)**:

- Migrated admin authentication from query parameters to secure header-based auth
- Added comprehensive file validation and sanitization routines
- Enhanced error messages for security-related failures

## Monitoring & Metrics

**Metrics Collected**:

- Task completion time
- Success/failure counts
- Queue depth
- Active containers
- Container reuse rate
- Network metrics
- System metrics: CPU usage, memory consumption, uptime
- Request latencies (with daily cap to prevent memory growth)

**Metrics Interfaces**:

```typescript
interface SystemMetrics {
  cpu: number; // CPU usage percentage
  memory: number; // Memory usage in MB
  uptime: number; // Uptime in seconds
  timestamp: number; // Metric collection time
}

interface AdminMetrics {
  requestCount: number;
  requestLatencies: number[]; // Capped at daily limit
  containerMetrics: ContainerMetrics;
  networkMetrics: NetworkMetrics;
  systemMetrics: SystemMetrics;
}
```

**Endpoints**:

- `GET /api/queue-stats` - Queue and execution metrics
- `GET /api/admin/metrics` - System-wide metrics (requires X-Admin-Key header)

**Recent Enhancements (Feb 2026)**:

- Added SystemMetrics interface with CPU, memory, and uptime tracking
- Implemented resource history tracking for visual representation
- Added latency cap to AdminMetricsService to prevent unbounded memory growth
- Enhanced admin dashboard with real-time metrics visualization
- Improved metrics retrieval performance with optimized data structures

## Recent Improvements (February 2026)

### Frontend Enhancements

1. **Simplified Routing**: Removed HomePage and LabPage components for streamlined navigation
   - Default route `/` now redirects to `/editor`
   - Reduced component complexity and bundle size
   - All routes now redirect to editor on unknown paths

2. **Collapsible Sidebar**: Implemented togglable workspace sidebar
   - Improves space utilization on small screens
   - Shows collapsed icon indicator in minimized state
   - Smooth transitions between states
   - Maintains state across navigation

3. **Enhanced Admin Dashboard**: Real-time system monitoring
   - Live CPU and memory usage tracking
   - System uptime monitoring
   - Historical data visualization
   - Improved layout with navigation sidebar

### Backend Enhancements

1. **Network Management Improvements**
   - Mutex-based locking for concurrent network creation
   - Emergency cleanup procedures for force-disconnecting containers
   - Prevention of race conditions in high-concurrency scenarios
   - Code readability improvements and whitespace cleanup

2. **Security Hardening**
   - Migrated admin route authentication from query parameters to `X-Admin-Key` header
   - Added file validation and sanitization on upload
   - Improved error handling for production environments
   - Protected against injection and traversal attacks

3. **Metrics & Monitoring**
   - Added latency cap in AdminMetricsService to prevent memory growth
   - SystemMetrics interface for OS-level metrics (CPU, memory, uptime)
   - Enhanced request latency tracking with daily limits
   - Graceful shutdown improvements for proper resource cleanup

4. **Container Pool Management**
   - Mutex-based concurrent access to container pools
   - Enhanced SessionContainerPool with thread-safe operations
   - Added resetMetrics functionality for metrics reset

### Quality Assurance

- Added comprehensive test suite for configuration validation
- Network manager test coverage
- Session container pool tests
- Test runner functionality tests
- File utilities comprehensive test coverage
- Store mutations comprehensive test coverage
- Clipboard blocker functionality tests

## Future Enhancements

- Multi-node deployment
- Advanced scheduling algorithms
- Container image caching
- Distributed task queue
- Advanced monitoring and alerting
