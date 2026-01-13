# Getting Started

## Prerequisites

- **Node.js** v18 or higher
- **Docker** installed and running
- **npm** (comes with Node.js)

## Quick Setup

```bash
git clone <repo-url>
cd CodeRunner
./setup.sh
```

The setup script will:
1. Check all prerequisites
2. Install npm dependencies
3. Build Docker runtime images

## Start the Application

Open two terminals:

```bash
# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend  
cd client && npm run dev
```

Then open http://localhost:5173 in your browser.

## Setup Options

```bash
./setup.sh --help              # Show all options
./setup.sh --skip-docker       # Skip rebuilding Docker images
./setup.sh --skip-deps         # Skip npm install
./setup.sh --configure-net     # Configure Docker for 500+ users (requires sudo)
```

## Troubleshooting

**Docker permission denied:**
```bash
sudo usermod -aG docker $USER
# Log out and back in, or run: newgrp docker
```

**Port already in use:**
```bash
lsof -i :3000   # Find process using port
kill -9 <PID>   # Kill it
```

**Docker not running:**
```bash
sudo systemctl start docker
```

## High Concurrency Setup

For lab environments with 50+ concurrent users:

```bash
./setup.sh --configure-net
```

This expands Docker's network address pools from ~30 to 4000+ concurrent sessions.
