#!/bin/bash
# Test Suite Runner for CodeRunner
# Run all tests for the project

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}CodeRunner Test Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if node_modules exist
if [ ! -d "server/node_modules" ]; then
    echo -e "${YELLOW}Installing server dependencies...${NC}"
    cd server
    npm install
    cd ..
fi

if [ ! -d "client/node_modules" ]; then
    echo -e "${YELLOW}Installing client dependencies...${NC}"
    cd client
    npm install
    cd ..
fi

# Server Tests
echo -e "${BLUE}Running Server Tests (Jest)...${NC}"
cd server
if npm test 2>&1; then
    echo -e "${GREEN}✓ Server tests passed${NC}"
    SERVER_PASS=true
else
    echo -e "${RED}✗ Server tests failed${NC}"
    SERVER_PASS=false
fi
cd ..

echo ""

# Client Tests
echo -e "${BLUE}Running Client Tests (Vitest)...${NC}"
cd client
if npm run test:run 2>&1; then
    echo -e "${GREEN}✓ Client tests passed${NC}"
    CLIENT_PASS=true
else
    echo -e "${RED}✗ Client tests failed${NC}"
    CLIENT_PASS=false
fi
cd ..

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"

if [ "$SERVER_PASS" = true ] && [ "$CLIENT_PASS" = true ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    if [ "$SERVER_PASS" = false ]; then
        echo -e "  - Server tests failed"
    fi
    if [ "$CLIENT_PASS" = false ]; then
        echo -e "  - Client tests failed"
    fi
    exit 1
fi
