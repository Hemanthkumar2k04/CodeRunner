# CodeRunner

CodeRunner is a centralized code execution platform designed for educational lab environments. Its primary goal is to provide a seamless coding experience for multiple programming languages without requiring students to install compilers, interpreters, or runtime environments on their local machines.

The server hosts a local web application featuring a full-featured code editor. Students can write code, import local files or folders into a temporary workspace, and execute their programs instantly. The code runs securely within isolated Docker containers on the server, and the output is streamed back to the browser.

## ✨ Key Features

- **Zero-Setup Lab Environment**: Students can start coding immediately using just a web browser. No local software installation is required.
- **Multi-File Project Support**: Unlike simple snippet runners, CodeRunner supports complex projects. You can upload multiple files (e.g., a Python script importing a custom class from another file) and execute them together.
- **Smart Execution**: The system is designed to handle dependencies between files, ensuring that all necessary context is available during execution.
- **Secure Sandbox**: All code runs in ephemeral, network-isolated Docker containers, ensuring the host server remains safe from malicious or accidental damage.

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

## 🛠️ Prerequisites

- **Node.js** (v18 or higher)
- **Docker** (Must be installed and running)
- **npm**

## 🏁 Getting Started

### 1. Setup Runtimes

The code runner relies on Docker images to execute code. You must build the runtime images before using the runner.

**Python Runtime:**
```bash
cd runtimes/python
docker build -t python-runtime .
```

*> Note: The system also supports `cpp` and `javascript`, but you will need to build `cpp-runtime` and `node-runtime` images for them to work.*

### 2. Backend Setup

Currently, the backend logic is contained in a standalone runner script.

```bash
cd server
npm install
```

**Running the Example:**
The `src/index.ts` file contains an example that attempts to run a C++ project. Since the C++ runtime might not be built yet, you may want to modify the example in `src/index.ts` to use `'python'` if you only built the Python image.

```bash
# Run the runner script
npm run dev
```

### 3. Frontend Setup

```bash
cd client
npm install
npm run dev
```

## 🧩 How It Works

1.  **The Workspace**: The student opens the web interface and creates a temporary workspace. They can type code directly or import local files/folders.
2.  **Submission**: When "Run" is clicked, the editor bundles the necessary source files and sends them to the server.
3.  **Isolation**: The server creates a unique, temporary directory and spins up a language-specific Docker container.
4.  **Execution**: The files are mounted into the container, and the entry point (e.g., `main.py`) is executed.
5.  **Result**: Standard output (`stdout`) and errors (`stderr`) are captured and displayed in the browser's terminal console.

## 🛡️ Security Features

- **Network Isolation**: Containers run with `--network none`.
- **Resource Limits**: Memory and CPU usage are strictly capped.
- **Ephemeral**: Containers are removed (`--rm`) immediately after execution.
- **Timeouts**: Execution is hard-capped (default 5s) to prevent infinite loops.

## 🤝 Contributing

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/amazing-feature`).
3.  Commit your changes (`git commit -m 'Add some amazing feature'`).
4.  Push to the branch (`git push origin feature/amazing-feature`).
5.  Open a Pull Request.

## 🚀 Tech Stack

**Frontend:**
- TypeScript
- React
- TailwindCSS
- ShadCN UI
- Monaco Editor

**Backend:**
- TypeScript
- Node.js
- Express (API Layer)
- Docker (Execution Sandbox)
