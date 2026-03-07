#!/bin/bash
#
# CodeRunner Setup Script
# Supports two modes:
#   1. Docker Compose (production) — single command, fully containerized
#   2. Local development — installs deps locally, builds runtime images
#
# Usage:
#   ./setup.sh              Local development setup (default)
#   ./setup.sh --docker     Docker Compose production setup
#   ./setup.sh --help       Show help
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()    { printf "${BLUE}[INFO]${NC} %s\n" "$1"; }
log_success() { printf "${GREEN}[✓]${NC} %s\n" "$1"; }
log_warn()    { printf "${YELLOW}[WARN]${NC} %s\n" "$1"; }
log_error()   { printf "${RED}[ERROR]${NC} %s\n" "$1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

MODE="local"
SKIP_DOCKER=false
SKIP_DEPS=false
SKIP_NET=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --docker)      MODE="docker";    shift ;;
        --skip-docker) SKIP_DOCKER=true; shift ;;
        --skip-deps)   SKIP_DEPS=true;   shift ;;
        --skip-net)    SKIP_NET=true;    shift ;;
        -h|--help)
            echo "CodeRunner Setup Script"
            echo ""
            echo "Usage: ./scripts/setup.sh [options]"
            echo ""
            echo "Modes:"
            echo "  (default)        Local development setup"
            echo "  --docker         Docker Compose production setup"
            echo ""
            echo "Options (local mode only):"
            echo "  --skip-docker    Skip building runtime images"
            echo "  --skip-deps      Skip installing npm dependencies"
            echo "  --skip-net       Skip network configuration"
            echo "  -h, --help       Show this help message"
            exit 0
            ;;
        *) log_error "Unknown option: $1"; exit 1 ;;
    esac
done

printf "${CYAN}"
echo "╔════════════════════════════════════════╗"
echo "║          CodeRunner Setup              ║"
echo "╚════════════════════════════════════════╝"
printf "${NC}\n"

# ── Prerequisite checks ──────────────────────────────────────────

check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        echo "  Install from: https://docs.docker.com/get-docker/"
        exit 1
    fi
    if ! docker ps >/dev/null 2>&1; then
        log_error "Cannot connect to Docker daemon"
        echo "  1. Is Docker running?"
        echo "  2. Is your user in the 'docker' group? (sudo usermod -aG docker \$USER)"
        exit 1
    fi
    log_success "Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"
}

check_node() {
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed (v18+ required)"
        exit 1
    fi
    local ver=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$ver" -lt 18 ]; then
        log_error "Node.js v18+ required (found v$ver)"
        exit 1
    fi
    log_success "Node.js $(node -v)"
    log_success "npm $(npm -v)"
}

# ══════════════════════════════════════════════════════════════════
# Docker Compose Mode
# ══════════════════════════════════════════════════════════════════

if [ "$MODE" = "docker" ]; then
    log_info "Mode: Docker Compose (production)"
    echo ""

    check_docker

    # Check docker compose
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose V2 is required"
        exit 1
    fi
    log_success "Docker Compose $(docker compose version --short)"

    echo ""
    log_info "Building and starting containers..."
    cd "$PROJECT_DIR"
    docker compose up --build -d

    echo ""
    log_info "Waiting for health checks..."
    docker compose ps

    printf "\n${GREEN}"
    echo "╔════════════════════════════════════════╗"
    echo "║        Setup Complete!                 ║"
    echo "╚════════════════════════════════════════╝"
    printf "${NC}\n"
    echo "Application running at: http://localhost:8080"
    echo "Admin dashboard:        http://localhost:8080/admin"
    echo ""
    echo "Commands:"
    echo "  docker compose logs -f      Follow logs"
    echo "  docker compose down         Stop containers"
    echo "  docker compose up -d        Start containers"
    echo ""
    exit 0
fi

# ══════════════════════════════════════════════════════════════════
# Local Development Mode
# ══════════════════════════════════════════════════════════════════

log_info "Mode: Local development"
echo ""

check_docker
check_node

# ── Install dependencies ─────────────────────────────────────────

if [ "$SKIP_DEPS" = false ]; then
    echo ""
    log_info "Installing dependencies..."

    if [ -d "${PROJECT_DIR}/server" ]; then
        log_info "  Server dependencies..."
        (cd "${PROJECT_DIR}/server" && npm install)
    fi

    if [ -d "${PROJECT_DIR}/client" ]; then
        log_info "  Client dependencies..."
        (cd "${PROJECT_DIR}/client" && npm install)
    fi
else
    log_info "Skipping dependency installation"
fi

# ── Build runtime images ─────────────────────────────────────────

if [ "$SKIP_DOCKER" = false ]; then
    echo ""
    log_info "Building runtime images..."

    RUNTIMES_DIR="${PROJECT_DIR}/runtimes"
    if [ -d "$RUNTIMES_DIR" ]; then
        for runtime in "$RUNTIMES_DIR"/*; do
            if [ -d "$runtime" ]; then
                lang=$(basename "$runtime")
                log_info "  Building ${lang}-runtime..."
                if docker build -q -t "${lang}-runtime" "$runtime" > /dev/null; then
                    log_success "  ${lang}-runtime"
                else
                    log_error "  Failed to build ${lang}-runtime"
                    exit 1
                fi
            fi
        done
    else
        log_warn "Runtimes directory not found"
    fi
else
    log_info "Skipping Docker image builds"
fi

# ── Network configuration (Linux only) ───────────────────────────

if [ "$SKIP_NET" = false ] && [ "$(uname)" = "Linux" ]; then
    echo ""
    log_info "Configuring network limits for high concurrency..."
    if [ "$EUID" -ne 0 ]; then
        sudo sysctl -q -w net.ipv4.ip_local_port_range="1024 65535" net.netfilter.nf_conntrack_max=1048576 2>/dev/null && \
            log_success "Network limits updated" || \
            log_warn "Could not update network limits (non-critical)"
    else
        sysctl -q -w net.ipv4.ip_local_port_range="1024 65535" net.netfilter.nf_conntrack_max=1048576
        log_success "Network limits updated"
    fi
fi

# ── Done ─────────────────────────────────────────────────────────

printf "\n${GREEN}"
echo "╔════════════════════════════════════════╗"
echo "║        Setup Complete!                 ║"
echo "╚════════════════════════════════════════╝"
printf "${NC}\n"
echo "Start the application:"
echo "  Terminal 1:  cd server && npm run dev"
echo "  Terminal 2:  cd client && npm run dev"
echo ""
echo "Frontend:  http://localhost:5173"
echo "Backend:   http://localhost:3000"
echo ""
