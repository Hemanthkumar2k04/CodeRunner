# 🏁 Getting Started Guide

This guide shows how to run CodeRunner locally or in GitHub Codespaces.

## 🛠️ Prerequisites

- **Node.js** (v18 or higher)
- **Docker** (Must be installed and running)
- **npm**

⚠️ **Note:** If using Codespaces, Node.js, npm, and Docker are already installed.

---

## 💻 Setup Options

### 1️⃣ GitHub Codespaces

1. **Open the repo in Codespaces** via GitHub:
   ```
   Code → Codespaces → New codespace
   ```

2. **Wait for the workspace to load.** Your repo will be at:
   ```
   /workspaces/CodeRunner
   ```

3. **No installations needed** — Node.js, npm, and Docker are ready.

4. **Build runtimes:**
   ```bash
   cd runtimes/python
   docker build -t python-runtime .
   ```
   
   _> Note: The system also supports `cpp` and `javascript`, but you will need to build `cpp-runtime` and `node-runtime` images for them to work._

5. **Start backend:**
   ```bash
   cd ../../server
   npm install
   npm run dev
   ```
   
   **Running the Example:** The `src/index.ts` file contains an example that attempts to run a C++ project. Since the C++ runtime might not be built yet, you may want to modify the example in `src/index.ts` to use `'python'` if you only built the Python image.

6. **Start frontend:**
   ```bash
   cd ../client
   npm install
   npm run dev
   ```

7. **Open frontend** via Ports → Open in Browser.

---

### 2️⃣ Local Setup (Laptop/PC)

1. **Clone the repo:**
   ```bash
   git clone <repo-url>
   cd CodeRunner
   ```

2. **Build runtimes** (Docker must be running):
   ```bash
   cd runtimes/python
   docker build -t python-runtime .
   ```
   
   _> Note: The system also supports `cpp` and `javascript`, but you will need to build `cpp-runtime` and `node-runtime` images for them to work._

3. **Setup backend:**
   ```bash
   cd ../../server
   npm install
   npm run dev
   ```
   
   **Running the Example:** The `src/index.ts` file contains an example that attempts to run a C++ project. Since the C++ runtime might not be built yet, you may want to modify the example in `src/index.ts` to use `'python'` if you only built the Python image.

4. **Setup frontend:**
   ```bash
   cd ../client
   npm install
   npm run dev
   ```

5. **Open frontend:** http://localhost:5173

---

## ⚙️ Notes

- **Codespaces** automatically saves your work. Locally, commit often.
- **Build runtimes only once** unless dependencies change.
- **Backend must run before frontend.**
- If you encounter issues with the C++ example, modify `server/src/index.ts` to use Python instead.