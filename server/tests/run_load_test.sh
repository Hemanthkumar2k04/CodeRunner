#!/bin/bash
#
# CodeRunner Load Test Runner
#
# This script sets up and runs the load test suite.
# Reports are saved with timestamps for historical comparison.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORTS_DIR="${SCRIPT_DIR}/reports"
VENV_DIR="${SCRIPT_DIR}/.venv"

# Default values
NUM_STUDENTS=20
SERVER_URL="http://localhost:3000"
MODE="burst"
RAMP_INTERVAL=5
RAMP_BATCH_SIZE=2

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { printf "${BLUE}[INFO]${NC} %s\n" "$1"; }
log_success() { printf "${GREEN}[SUCCESS]${NC} %s\n" "$1"; }
log_warn() { printf "${YELLOW}[WARN]${NC} %s\n" "$1"; }
log_error() { printf "${RED}[ERROR]${NC} %s\n" "$1"; }

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--students)
            NUM_STUDENTS="$2"
            shift 2
            ;;
        -s|--server)
            SERVER_URL="$2"
            shift 2
            ;;
        -m|--mode)
            MODE="$2"
            shift 2
            ;;
        -i|--interval)
            RAMP_INTERVAL="$2"
            shift 2
            ;;
        -b|--batch)
            RAMP_BATCH_SIZE="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

printf "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           CodeRunner Load Test Suite                      ║"
echo "╚═══════════════════════════════════════════════════════════╝"
printf "${NC}\n"

# Check Python or Python3
if command -v python3 &> /dev/null; then
    PYTHON_CMD=python3
elif command -v python &> /dev/null; then
    PYTHON_CMD=python
else
    log_error "Python 3 is required but not found."
    exit 1
fi

log_info "Using Python: $PYTHON_CMD"

# Setup Virtual Environment
if [ ! -d "$VENV_DIR" ]; then
    log_info "Creating virtual environment..."
    $PYTHON_CMD -m venv "$VENV_DIR"
    log_success "Created virtualenv"
fi

# Install dependencies
log_info "Installing dependencies..."
if [ -f "${VENV_DIR}/bin/pip" ]; then
    PIP_CMD="${VENV_DIR}/bin/pip"
else
    PIP_CMD="${VENV_DIR}/Scripts/pip" # Windows support just in case
fi

$PIP_CMD install -q requests socketio-client-v2 matplotlib >/dev/null

# Run Test
log_info "Starting load test..."
if [ -f "${VENV_DIR}/bin/python" ]; then
    PY_RUN="${VENV_DIR}/bin/python"
else
    PY_RUN="${VENV_DIR}/Scripts/python"
fi

LOAD_TEST_SCRIPT="${SCRIPT_DIR}/load_test.py"
if [ ! -f "$LOAD_TEST_SCRIPT" ]; then
    log_error "Load test script not found at $LOAD_TEST_SCRIPT"
    exit 1
fi

$PY_RUN "$LOAD_TEST_SCRIPT" \
    --students "$NUM_STUDENTS" \
    --url "$SERVER_URL" \
    --mode "$MODE" \
    --interval "$RAMP_INTERVAL" \
    --batch "$RAMP_BATCH_SIZE"

log_success "Load test finished. Check reports directory for results."
