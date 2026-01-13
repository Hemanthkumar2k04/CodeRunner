#!/bin/bash
#
# CodeRunner Setup Script
# -----------------------
# Sets up the entire CodeRunner environment:
#   1. Checks prerequisites (Node.js, Docker, npm)
#   2. Installs dependencies for server and client
#   3. Builds all Docker runtime images
#   4. Optionally configures Docker for high concurrency
#
# Usage: ./setup.sh [options]
#
# Options:
#   --skip-docker    Skip building Docker images
#   --skip-deps      Skip installing npm dependencies
#   --configure-net  Configure Docker for 500+ concurrent networks (requires sudo)
#   -h, --help       Show this help message
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Default options
SKIP_DOCKER=false
SKIP_DEPS=false
CONFIGURE_NET=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-docker)
            SKIP_DOCKER=true
            shift
            ;;
        --skip-deps)
            SKIP_DEPS=true
            shift
            ;;
        --configure-net)
            CONFIGURE_NET=true
            shift
            ;;
        -h|--help)
            echo "CodeRunner Setup Script"
            echo ""
            echo "Usage: ./setup.sh [options]"
            echo ""
            echo "Options:"
            echo "  --skip-docker    Skip building Docker images"
            echo "  --skip-deps      Skip installing npm dependencies"
            echo "  --configure-net  Configure Docker for high concurrency (requires sudo)"
            echo "  -h, --help       Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Header
echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                  CodeRunner Setup                         ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ─────────────────────────────────────────────────────────────────
# Step 1: Check Prerequisites
# ─────────────────────────────────────────────────────────────────
echo -e "${BLUE}[1/4] Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed${NC}"
    echo "  Install from: https://nodejs.org/ (v18+ required)"
    exit 1
fi
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}✗ Node.js v18+ required (found v$NODE_VERSION)${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Node.js $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm is not installed${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} npm $(npm -v)"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed${NC}"
    echo "  Install from: https://docs.docker.com/get-docker/"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"

# Check Docker daemon
if ! docker info &> /dev/null; then
    echo -e "${RED}✗ Docker daemon is not running${NC}"
    echo "  Start with: sudo systemctl start docker"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Docker daemon running"

# Check Docker permissions (non-root)
if ! docker ps &> /dev/null; then
    echo -e "${YELLOW}⚠ Docker requires sudo or docker group membership${NC}"
    echo "  Add your user to docker group: sudo usermod -aG docker \$USER"
    echo "  Then log out and back in, or run: newgrp docker"
    exit 1
fi

# ─────────────────────────────────────────────────────────────────
# Step 2: Install Dependencies
# ─────────────────────────────────────────────────────────────────
if [ "$SKIP_DEPS" = false ]; then
    echo -e "\n${BLUE}[2/4] Installing dependencies...${NC}"
    
    # Load nvm if available
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
        . "$HOME/.nvm/nvm.sh"
        if [ -f "$SCRIPT_DIR/.nvmrc" ]; then
            nvm use 2>/dev/null || nvm install
        fi
    fi
    
    # Server dependencies
    echo -e "  ${CYAN}→${NC} Installing server dependencies..."
    cd "$SCRIPT_DIR/server"
    npm ci --silent 2>/dev/null || npm install --silent
    
    # Client dependencies
    echo -e "  ${CYAN}→${NC} Installing client dependencies..."
    cd "$SCRIPT_DIR/client"
    npm ci --silent 2>/dev/null || npm install --silent
    
    cd "$SCRIPT_DIR"
    echo -e "  ${GREEN}✓${NC} Dependencies installed"
else
    echo -e "\n${YELLOW}[2/4] Skipping dependencies (--skip-deps)${NC}"
fi

# ─────────────────────────────────────────────────────────────────
# Step 3: Build Docker Images
# ─────────────────────────────────────────────────────────────────
if [ "$SKIP_DOCKER" = false ]; then
    echo -e "\n${BLUE}[3/4] Building Docker runtime images...${NC}"
    
    RUNTIMES=(
        "python:python-runtime"
        "javascript:node-runtime"
        "java:java-runtime"
        "cpp:cpp-runtime"
        "mysql:mysql-runtime"
    )
    
    for runtime in "${RUNTIMES[@]}"; do
        DIR="${runtime%%:*}"
        IMAGE="${runtime##*:}"
        echo -e "  ${CYAN}→${NC} Building $IMAGE..."
        docker build -t "$IMAGE" "$SCRIPT_DIR/runtimes/$DIR" --quiet
    done
    
    echo -e "  ${GREEN}✓${NC} All runtime images built"
else
    echo -e "\n${YELLOW}[3/4] Skipping Docker images (--skip-docker)${NC}"
fi

# ─────────────────────────────────────────────────────────────────
# Step 4: Configure Docker Networking (Optional)
# ─────────────────────────────────────────────────────────────────
if [ "$CONFIGURE_NET" = true ]; then
    echo -e "\n${BLUE}[4/4] Configuring Docker networking for high concurrency...${NC}"
    
    DAEMON_JSON="/etc/docker/daemon.json"
    
    # Check if running with sudo capability
    if ! sudo -n true 2>/dev/null; then
        echo -e "${YELLOW}  This step requires sudo access.${NC}"
        echo "  Enter your password to continue, or Ctrl+C to skip."
    fi
    
    # Backup existing config
    if [ -f "$DAEMON_JSON" ]; then
        BACKUP="${DAEMON_JSON}.backup.$(date +%Y%m%d-%H%M%S)"
        echo -e "  ${CYAN}→${NC} Backing up existing daemon.json..."
        sudo cp "$DAEMON_JSON" "$BACKUP"
    fi
    
    # Create new config
    echo -e "  ${CYAN}→${NC} Writing new Docker daemon config..."
    sudo tee "$DAEMON_JSON" > /dev/null <<'EOF'
{
  "default-address-pools": [
    { "base": "172.80.0.0/12", "size": 24 },
    { "base": "10.10.0.0/16", "size": 24 }
  ],
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
EOF
    
    # Restart Docker
    echo -e "  ${CYAN}→${NC} Restarting Docker daemon..."
    sudo systemctl restart docker
    
    # Wait for Docker to be ready
    sleep 2
    if docker info &> /dev/null; then
        echo -e "  ${GREEN}✓${NC} Docker configured for 4,000+ concurrent networks"
    else
        echo -e "  ${RED}✗${NC} Docker failed to restart. Check: sudo systemctl status docker"
        exit 1
    fi
else
    echo -e "\n${YELLOW}[4/4] Skipping network config (use --configure-net for high concurrency)${NC}"
fi

# ─────────────────────────────────────────────────────────────────
# Done!
# ─────────────────────────────────────────────────────────────────
echo -e "\n${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  Setup Complete! ✓                        ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Start the application:"
echo -e "  ${CYAN}Terminal 1:${NC} cd server && npm run dev"
echo -e "  ${CYAN}Terminal 2:${NC} cd client && npm run dev"
echo ""
echo -e "Then open ${BLUE}http://localhost:5173${NC} in your browser."
echo ""
