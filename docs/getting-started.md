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

The setup script now includes:

- Automatic cache cleanup after building images
- Docker build cache pruning
- npm cache cleaning
- Removal of dangling Docker images and volumes

## Environment Configuration

After setup, configure the server:

```bash
cp server/.env.example server/.env
```

Edit `server/.env` to customize:

- Server port and host
- Docker container resource limits
- Session TTL and cleanup intervals
- Runtime image names
- File size limits

Restart the server for changes to take effect.

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

This configures Docker with custom address pools supporting 4,352 concurrent sessions:

- Pool 1: `172.80.0.0/12` (4,096 /24 subnets)
- Pool 2: `10.10.0.0/16` (256 /24 subnets)

Then configure server resources in `server/.env`:

```env
DOCKER_MEMORY=256m          # Increase for heavy workloads
DOCKER_CPUS=1              # Increase for compute-intensive code
SESSION_TTL=120000         # Extend container lifetime if needed
```

Load test with 40 concurrent users shows 100% success rate.
