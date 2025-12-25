# Getting Started Guide

## 🛠️ Prerequisites

- **Node.js** (v18 or higher)
- **Docker** (Must be installed and running)
- **npm**

## 🏁 Setup Instructions

### 1. Setup Runtimes

The code runner relies on Docker images to execute code. You must build the runtime images before using the runner.

**Python Runtime:**

```bash
cd runtimes/python
docker build -t python-runtime .
```

_> Note: The system also supports `cpp` and `javascript`, but you will need to build `cpp-runtime` and `node-runtime` images for them to work._

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
