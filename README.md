<p align="center">
  <img width="512" height="111" alt="image" src="https://github.com/user-attachments/assets/db7696aa-0ef2-400d-84c5-a440536b3e12" />

</p>

# CodeRunner

A web-based code execution platform built for educational lab environments. Write, run, and test code directly in your browser — no compilers or runtimes to install.

## Features

- **Browser IDE** — Monaco editor with syntax highlighting and IntelliSense
- **Multi-Language** — Python, JavaScript, C/C++, Java, SQL, Python Notebooks
- **Real-Time** — WebSocket streaming of output with performance metrics
- **Isolated Execution** — every run happens in a fresh Docker container
- **Admin Dashboard** — live metrics, logs, load testing at `/admin`

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (with Compose V2)
- [Node.js](https://nodejs.org/) v18+ *(local dev only)*

---

### Docker Compose (recommended)

One command to build and run everything:

```bash
./setup.sh --docker
```

The app will be available at **http://localhost:8080**.

Or manually:

```bash
docker compose up --build -d
```

| Command | Description |
|---|---|
| `docker compose up -d` | Start containers |
| `docker compose down` | Stop containers |
| `docker compose logs -f` | Follow logs |
| `docker compose up --build -d` | Rebuild and start |

---

### Local Development

```bash
# 1. Install deps and build runtime images
./setup.sh

# 2. Start backend (terminal 1)
cd server && npm run dev

# 3. Start frontend (terminal 2)
cd client && npm run dev
```

Frontend at `http://localhost:5173`, backend at `http://localhost:3000`.

## Project Structure

```
CodeRunner/
├── client/              # React + Vite frontend
│   └── nginx.conf       # Nginx reverse proxy config
├── server/              # Express + TypeScript backend
│   └── src/             # Server source code
├── runtimes/            # Docker images for each language
├── scripts/             # Utility scripts
│   ├── cleanup.sh       # Remove orphaned containers/networks
│   ├── run-tests.sh     # Run all test suites
│   ├── run-load-tests.sh
│   └── setup.ps1        # Windows setup script
├── docs/                # Architecture & testing docs
├── docker-compose.yml   # Production deployment
├── server.Dockerfile    # Backend container
├── client.Dockerfile    # Frontend container
└── setup.sh             # Setup script
```

## Admin Dashboard

Access at **http://localhost:8080/admin** (requires admin key).

### Security Configuration

IMPORTANT: Before pushing to production, you **must** change the default admin key. Secure it using an environment variable or by editing the `docker-compose.yml` file.

**Option A: Environment Variable (Recommended)**
Create a `.env` file in the root or set it in your shell:
```bash
ADMIN_KEY=your_very_secure_secret_key
```

**Option B: Docker Compose**
Edit the `environment` section in `docker-compose.yml`:
```yaml
services:
  backend:
    environment:
      - ADMIN_KEY=your_very_secure_secret_key
```

Default key: `development_key`
Authenticate via the `X-Admin-Key` header (handled by the dashboard UI).

## Testing

```bash
# Unit & integration tests
cd server && npm test
cd client && npm run test:run

# All tests
./scripts/run-tests.sh

# Load tests (from admin dashboard or CLI)
./scripts/run-load-tests.sh light
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Monaco Editor |
| Backend | Node.js, Express, TypeScript, Socket.IO |
| Execution | Docker containers, queue system, container pools |
| Proxy | Nginx (gzip, caching, WebSocket) |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

MIT — see [LICENSE](LICENSE).
