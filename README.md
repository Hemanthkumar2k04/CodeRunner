<p align="center">
  <img width="512" height="111" alt="image" src="https://github.com/user-attachments/assets/db7696aa-0ef2-400d-84c5-a440536b3e12" />

</p>

# CodeRunner

A web-based code execution platform built for educational lab environments. Write, run, and test code directly in your browser without installing compilers or runtimes.

## Features

- **Browser-Based IDE**: Full-featured code editor with syntax highlighting and IntelliSense
- **Zero Setup**: No installation needed—code runs instantly in isolated Docker containers
- **Multi-Language Support**: Python, Python Notebook, JavaScript, C++, Java, and SQL
- **Real-Time Output**: Stream execution results via WebSocket with performance metrics
- **File Management**: Create and organize multi-file projects with full dependency support
- **Smart Execution**: Priority-based task queue with concurrent execution and automatic cleanup
- **Network Capable**: Build networking and multi-file projects with container networking support
- **Session Isolation**: Temporary workspaces with automatic cleanup on disconnect

## Quick Start

### Prerequisites

- Node.js v18+
- Docker
- npm

### Setup

1. **Clone the repository:**

   ```bash
   git clone <repo-url>
   cd CodeRunner
   ```

2. **Run setup script:**

   ```bash
   ./setup.sh
   ```

   This builds Docker runtime images and installs dependencies.

3. **Start the application:**

   ```bash
   # Terminal 1 - Backend
   cd server && npm run dev

   # Terminal 2 - Frontend
   cd client && npm run dev
   ```

The frontend will be available at `http://localhost:5173`.

## Quick Commands

```bash
# Run all tests
./run-tests.sh

# Build for production
npm run build

# Clean up temporary files
./cleanup.sh
```

## Architecture

CodeRunner uses a **queue-based execution system** with Docker containers for each language runtime. Requests are prioritized and executed concurrently with automatic resource management.

For detailed architecture information, visit `docs/architecture.md`.

## Testing

CodeRunner includes unit tests, integration tests, and performance load testing. Run tests with:

```bash
cd server && npm test          # Unit & integration tests
cd client && npm run test:run  # Frontend tests
./run-tests.sh                 # All tests
```

For detailed testing information, visit `docs/testing.md`.

## Technology Stack

- **Frontend**: React, TypeScript, Vite, Monaco Editor
- **Backend**: Node.js, Express, TypeScript
- **Execution**: Docker, Queue System, Container Pools
- **Real-Time**: WebSocket (Socket.IO)
- **Testing**: Jest, Vitest, Java Load Tester

## License

Developed by F.A.B.R.I.C Club of Easwari Engineering College
