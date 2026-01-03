# CodeRunner

**Developed by F.A.B.R.I.C Club of Easwari Engineering College**

CodeRunner is a web-based code execution platform designed for educational lab environments. It provides a seamless coding experience without requiring students to install compilers or runtimes on their machines.

## ✨ Key Features

- **Zero-Setup Lab Environment**: Code directly from a browser. No software installation needed.
- **Full-Featured Code Editor**: Monaco Editor with syntax highlighting, IntelliSense, and shortcuts (Ctrl+S to save, Ctrl+Enter to run).
- **File Explorer**: Create, organize, and manage files in a tree structure.
- **Multi-File Project Support**: Write complex projects and execute with full dependency support.
- **Real-Time Console Output**: Stream execution output via WebSockets.
- **Multi-Console Interface**: Each file execution gets its own isolated console (like VS Code), limited to 2,000 outputs per console.
- **Session Isolation**: Temporary workspaces with automatic cleanup.
- **Secure Sandbox**: Code runs in isolated Docker containers.
- **Multi-Language Support**: Python, JavaScript, C++, Java, and SQL.

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **Docker** (Must be installed and running)
- **npm**

### Setup

1. **Clone the repository:**

   ```bash
   git clone <repo-url>
   cd CodeRunner
   ```

## Method - 1: Setup using automated script

2. **Run the setup script:**

   ```bash
   ./setup.sh
   ```

   This script will build the Docker images and setup both frontend and backend.

3. **Run Backend and Frontend:**

   Open two terminal windows/tabs.

   **Terminal 1 (Backend):**

   ```bash
   cd server
   npm run dev
   ```

   **Terminal 2 (Frontend):**

   ```bash
   cd client
   npm run dev
   ```

## Method - 2: Manual Setup

2. **Build Docker runtime images:**

   ```bash
   cd runtimes/python && docker build -t python-runtime .
   cd ../javascript && docker build -t node-runtime .
   cd ../java && docker build -t java-runtime .
   cd ../cpp && docker build -t cpp-runtime .
   ```

3. **Start the backend server:**

   ```bash
   cd server
   npm install
   npm run dev
   ```

   Server will run on `http://localhost:3000`

4. **Start the frontend (in a new terminal):**

   ```bash
   cd client
   npm install
   npm run dev
   ```

   Frontend will be available at `http://localhost:5173` (or the network URL shown)

5. **Access from another machine:**
   - The frontend displays both local and network URLs
   - Use the network URL (e.g., `http://192.168.x.x:5173/`) from other machines
   - The socket will automatically connect to the server using the same IP

## 📚 Documentation

For detailed information about the project, please refer to the documentation in the `docs/` folder:

- [**Getting Started**](docs/getting-started.md): Detailed installation and setup instructions.
- [**Architecture & Design**](docs/architecture.md): Project structure, execution flow, and security features.
- [**Tech Stack**](docs/tech-stack.md): Technologies used in the frontend and backend.
- [**API Documentation**](docs/api.md): WebSocket events and message formats.
- [**Contributing**](docs/contributing.md): Guidelines for contributing to the project.

## 🏗️ Project Structure

```
CodeRunner/
├── client/                    # React Frontend application
│   ├── src/
│   │   ├── components/       # React components (CodeEditor, Console, Workspace, etc.)
│   │   ├── hooks/            # Custom hooks (useSocket)
│   │   ├── stores/           # Zustand store (useEditorStore)
│   │   ├── lib/              # Utilities (socket, file-utils, etc.)
│   │   ├── App.tsx           # Main application layout
│   │   └── main.tsx          # Entry point
│   ├── vite.config.ts        # Vite configuration
│   └── package.json
├── server/                    # Backend Node.js application
│   ├── src/
│   │   ├── index.ts          # Socket.IO server & execution engine
│   │   ├── pool.ts           # Container pool management
│   │   └── config.ts         # Configuration settings
│   ├── temp/                 # Temporary files (gitignored)
│   ├── tsconfig.json
│   └── package.json
├── runtimes/                  # Docker runtime definitions
│   ├── python/
│   ├── javascript/
│   ├── java/
│   └── cpp/
├── docs/                      # Documentation
└── README.md
```

## 💻 Usage

1. **Create a file:** Click the `+` icon in the Workspace explorer to create a new file
2. **Write code:** The file opens automatically in the editor. Code syntax highlighting is automatic based on file extension
3. **Run code:** Click the **Run** button (or Ctrl+Enter) to execute all compatible files
4. **View output:** Console output appears in the bottom panel in real-time
5. **Organize files:** Right-click files/folders to rename, delete, or create new items

## 🔧 Configuration

### Backend Configuration

Edit `server/src/config.ts` to modify:

- Server port (default: 3000)
- Docker runtime images
- Container pool size
- Memory and CPU limits
- Execution timeout

### Frontend Configuration

Edit `client/vite.config.ts` to:

- Change the server address (if backend is on a different host)
- Modify the port

## 🛡️ Security

- **Network Isolation**: Containers run with `--network none`
- **Resource Limits**: Memory and CPU usage are capped
- **Ephemeral Execution**: Containers are removed after execution
- **Timeout Protection**: Execution is limited to 5 seconds by default
- **Session Isolation**: Each user's data exists only in browser sessionStorage

## 📊 Performance

CodeRunner uses a **Warm Container Pool** strategy:

- Pre-warmed containers are ready (~100ms latency)
- Eliminates Docker cold-start penalty (~1.5s)
- Containers are recycled after each execution
- Default: 3 containers per language

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](docs/contributing.md) for guidelines.

## 👥 Contributors

- Hemanthkumar K - [GitHub](https://github.com/hemanthkumar2k04)
- Gowsi S M - [GitHub](https://github.com/gowsism)
- Iniyaa P - [GitHub](https://github.com/Iniyaa21)

## 📄 License

This project is provided for educational purposes.

## ⚠️ Notes

- Each workspace is temporary (session-based) and cleared when the browser is closed
- Files are stored in `sessionStorage`, not persisted to the server
- Maximum file size: 500KB per file, 4MB total workspace
- Supported languages: Python, JavaScript, Java, C++
