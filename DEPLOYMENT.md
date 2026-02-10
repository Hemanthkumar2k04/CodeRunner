# Production Deployment Guide

## Branch Strategy

This project uses two main branches:

- **`master`** - Development branch with TypeScript source
- **`production`** - Production-ready branch with compiled JavaScript

Both branches contain **identical code** to ensure safe merges without conflicts. The difference is in how they're executed.

## Environment Detection

The codebase automatically detects the runtime environment:

- **Development mode** (`npm run dev`):
  - Uses `ts-node` to run TypeScript directly
  - Worker threads load `.ts` files
  - Fast development iteration

- **Production mode** (`node dist/index.js`):
  - Uses compiled JavaScript from `dist/`
  - Worker threads load `.js` files
  - Optimized for performance

## Production Deployment Steps

### 1. Switch to Production Branch

```bash
git checkout production
git pull origin production
```

### 2. Merge Latest Changes from Master (if needed)

```bash
git merge master
# Resolve any conflicts if they exist
# Rebuild to ensure everything works
npm run build
```

### 3. Configure Environment

```bash
cd server
cp .env.production.example .env
# Edit .env with your production values
nano .env
```

**Key production settings:**

- `NODE_ENV=production` (required)
- `LOG_FORMAT=json` (structured logging for production)
- `WORKER_THREADS=4` (or based on CPU cores)
- `MAX_CONCURRENT_SESSIONS=50` (adjust based on resources)

### 4. Build the Application

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

### 5. Verify Build Artifacts

```bash
ls -la dist/
# Should see: index.js, worker.js, workerPool.js, config.js, etc.
```

### 6. Run Production Server

```bash
# Direct execution
node dist/index.js

# Or with process manager (recommended)
pm2 start dist/index.js --name coderunner
pm2 save
pm2 startup
```

### 7. Verify Worker Threads

```bash
# Check server logs for:
# [Server] Initializing worker pool with 4 threads (experimental)
# [WorkerPool] Worker 0 initialized
# [WorkerPool] Worker 1 initialized
# ...

# Test the stats endpoint
curl http://localhost:3000/api/queue-stats | jq '.workerPool'
```

Expected output:

```json
{
  "totalWorkers": 4,
  "activeWorkers": 0,
  "idleWorkers": 4,
  "queuedTasks": 0,
  "completedTasks": 0,
  "failedTasks": 0,
  "averageTaskTime": 0
}
```

## Merging Changes from Master to Production

Since both branches use **identical code** with environment detection, merging is straightforward:

```bash
git checkout production
git merge master
npm run build  # Rebuild after merge
npm test       # Verify everything works
git push origin production
```

**No code conflicts** will occur in `workerPool.ts` because the environment detection logic works in both dev and prod.

## Troubleshooting

### Worker threads failing to start

**Issue:** Workers show errors about missing `.ts` or `.js` files

**Solution:**

- In production: Ensure `npm run build` was run
- Check `dist/worker.js` exists
- Verify `NODE_ENV=production` in `.env`

### Dev mode using .js instead of .ts

**Issue:** Development mode tries to load `worker.js`

**Solution:**

- Ensure running with `npm run dev` (uses ts-node)
- Check `process.execArgv` includes `ts-node`
- Verify `NODE_ENV=development` in `.env`

## Architecture Overview

```
Development (master branch)
├── npm run dev
├── ts-node executes src/index.ts
├── Worker detection: process.execArgv → 'ts-node' found
└── Loads: src/worker.ts (with ts-node/register)

Production (production branch)
├── npm run build → creates dist/
├── node executes dist/index.js
├── Worker detection: __filename.endsWith('.js') → true
└── Loads: dist/worker.js (compiled JavaScript)
```

## System Requirements

- Node.js 18+
- Docker with daemon running
- 4GB+ RAM (for 50 concurrent sessions)
- 4+ CPU cores (for worker threads)

## Monitoring

```bash
# Queue and worker pool stats
curl http://localhost:3000/api/queue-stats

# Container and network stats
docker ps --filter "label=type=coderunner-session"
docker network ls --filter "label=type=coderunner"
```

## Security Notes

- Never commit `.env` files (already in `.gitignore`)
- Use `.env.production.example` as a template
- Rotate secrets regularly
- Enable firewall rules for port 3000
- Use reverse proxy (nginx) with SSL in production
