# Getting Started

## Prerequisites

- **Node.js** v18+
- **Docker** (installed and running)
- **npm**

## Setup

### Automated Setup (Recommended)

```bash
git clone <repo-url>
cd CodeRunner
chmod +x setup.sh
sudo ./setup.sh
```

### Manual Setup

1. **Build Docker images:**

```bash
cd runtimes/python && docker build -t python-runtime .
cd ../javascript && docker build -t node-runtime .
cd ../java && docker build -t java-runtime .
cd ../cpp && docker build -t cpp-runtime .
cd ../mysql && docker build -t mysql-runtime .
cd ../..
```

2. **Start backend:**

```bash
cd server && npm install && npm run dev  # http://localhost:3000
```

3. **Start frontend (new terminal):**

```bash
cd client && npm install && npm run dev  # http://localhost:5173
```

## Supported Languages

- Python, JavaScript/Node.js, Java, C++, SQL (MySQL)

## Troubleshooting

**Port already in use:**

```bash
lsof -i :3000    # Find & kill process
kill -9 <PID>
```

**Can't connect to Docker:**

```bash
sudo systemctl start docker  # Linux
```

**Frontend can't reach backend:** Ensure both services are running on the same host.
