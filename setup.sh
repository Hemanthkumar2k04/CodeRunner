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
#   --skip-net       Skip network configuration (network config enabled by default)
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

# Helper for portable logging
log_info() { printf "${BLUE}[INFO]${NC} %s\n" "$1"; }
log_success() { printf "${GREEN}[SUCCESS]${NC} %s\n" "$1"; }
log_warn() { printf "${YELLOW}[WARN]${NC} %s\n" "$1"; }
log_error() { printf "${RED}[ERROR]${NC} %s\n" "$1"; }

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment variables from .env file if it exists
if [ -f "${SCRIPT_DIR}/server/.env" ]; then
    log_info "Loading environment variables from server/.env"
    set -a  # Export all variables
    source "${SCRIPT_DIR}/server/.env"
    set +a  # Stop exporting
else
    log_warn "server/.env file not found, using defaults"
fi

# Ensure helper scripts are executable
chmod +x "${SCRIPT_DIR}/cleanup.sh" 2>/dev/null || true
chmod +x "${SCRIPT_DIR}/server/tests/run_load_test.sh" 2>/dev/null || true

# Default options
SKIP_DOCKER=false
SKIP_DEPS=false
CONFIGURE_NET=true  # Network config now enabled by default for college deployment

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
        --skip-net)
            CONFIGURE_NET=false
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
            echo "  --skip-net       Skip network configuration (default: enabled)"
            echo "  -h, --help       Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Header
printf "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                  CodeRunner Setup                         ║"
echo "╚═══════════════════════════════════════════════════════════╝"
printf "${NC}\n"

# ─────────────────────────────────────────────────────────────────
# Step 1: Check Prerequisites
# ─────────────────────────────────────────────────────────────────
log_info "Step 1/4: Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed"
    echo "  Install from: https://nodejs.org/ (v18+ required)"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    log_error "Node.js v18+ required (found v$NODE_VERSION)"
    exit 1
fi
log_success "Node.js $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
    log_error "npm is not installed"
    exit 1
fi
log_success "npm $(npm -v)"

# Check Docker
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
    echo "  Install Docker Desktop or Engine from: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check Docker Permissions
if ! docker ps >/dev/null 2>&1; then
    log_error "Cannot connect to Docker daemon"
    echo "  Possible reasons:"
    echo "  1. Docker is not running"
    echo "  2. Current user is not in 'docker' group (Run: sudo usermod -aG docker \$USER)"
    exit 1
fi
log_success "Docker ($(docker --version | cut -d' ' -f3 | tr -d ','))"

# ─────────────────────────────────────────────────────────────────
# Step 2: Install Dependencies
# ─────────────────────────────────────────────────────────────────
if [ "$SKIP_DEPS" = false ]; then
    echo ""
    log_info "Step 2/4: Installing dependencies..."
    
    # Server Dependencies
    if [ -d "${SCRIPT_DIR}/server" ]; then
        log_info "Installing server dependencies..."
        (cd "${SCRIPT_DIR}/server" && npm install)
    else
        log_warn "Server directory not found!"
    fi
    
    # Client Dependencies
    if [ -d "${SCRIPT_DIR}/client" ]; then
        log_info "Installing client dependencies..."
        (cd "${SCRIPT_DIR}/client" && npm install)
    else
        log_warn "Client directory not found!"
    fi
else
    echo ""
    log_info "Step 2/4: Skipping dependencies installation"
fi

# ─────────────────────────────────────────────────────────────────
# Step 3: Build Runtime Images
# ─────────────────────────────────────────────────────────────────
if [ "$SKIP_DOCKER" = false ]; then
    echo ""
    log_info "Step 3/4: Building runtime images..."
    
    RUNTIMES_DIR="${SCRIPT_DIR}/runtimes"
    if [ -d "$RUNTIMES_DIR" ]; then
        for runtime in "$RUNTIMES_DIR"/*; do
            if [ -d "$runtime" ]; then
                lang=$(basename "$runtime")
                image_name="${lang}-runtime"
                
                log_info "Building ${image_name}..."
                if docker build -q -t "$image_name" "$runtime" > /dev/null; then
                     log_success "Built ${image_name}"
                else
                     log_error "Failed to build ${image_name}"
                     exit 1
                fi
            fi
        done
    else
        log_warn "Runtimes directory not found at $RUNTIMES_DIR"
    fi
else
    echo ""
    log_info "Step 3/4: Skipping Docker build"
fi

# ─────────────────────────────────────────────────────────────────
# Step 4: System Configuration (Optional)
# ─────────────────────────────────────────────────────────────────
if [ "$CONFIGURE_NET" = true ]; then
    echo ""
    log_info "Step 4/4: Configuring Network Limits (required for 500+ concurrent sessions)..."
    
    # Check for sudo
    if [ "$EUID" -ne 0 ]; then 
        log_warn "Root privileges needed to apply sysctl kernel settings."
        echo "Applying network configuration now (requires your password)..."
        if [ "$(uname)" == "Linux" ]; then
            if ! sudo -p "Enter sudo password to apply network configuration: " sysctl -w net.ipv4.ip_local_port_range="1024 65535" net.netfilter.nf_conntrack_max=1048576; then
                log_error "Failed to apply network configuration"
                exit 1
            fi
            log_success "Network limits updated"
        else
            log_warn "Network configuration only supported on Linux"
        fi
    else
        echo "Applying sysctl settings for high concurrency..."
        if [ "$(uname)" == "Linux" ]; then
            sysctl -w net.ipv4.ip_local_port_range="1024 65535"
            sysctl -w net.netfilter.nf_conntrack_max=1048576
            log_success "Network limits updated"
        else
            log_warn "Network configuration only supported on Linux"
        fi
    fi
else
    echo ""
    log_info "Step 4/4: Network configuration skipped (use --skip-net=false to enable)"
fi

echo ""
printf "${GREEN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║             Setup Completed Successfully!                 ║"
echo "╚═══════════════════════════════════════════════════════════╝"
printf "${NC}\n"
echo "To start the development server:"
echo "  cd server && npm run dev"
echo ""
echo "To start the client:"
echo "  cd client && npm run dev"
echo ""
