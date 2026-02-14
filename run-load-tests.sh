#!/bin/bash

# CodeRunner Performance Load Test Runner
# Usage: ./run-load-tests.sh [light|moderate|heavy]

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default intensity
INTENSITY="${1:-moderate}"

# Validate intensity
if [[ ! "$INTENSITY" =~ ^(light|moderate|heavy)$ ]]; then
    echo -e "${RED}Error: Invalid intensity level '$INTENSITY'${NC}"
    echo "Usage: $0 [light|moderate|heavy]"
    echo ""
    echo "Intensity levels:"
    echo "  light    - 10 concurrent connections, 30 seconds"
    echo "  moderate - 50 concurrent connections, 60 seconds (default)"
    echo "  heavy    - 100 concurrent connections, 90 seconds"
    exit 1
fi

# Check if server is running
echo -e "${YELLOW}Checking if server is running on port 3000...${NC}"
if ! curl -s -f http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${RED}✗ Server is not running on port 3000${NC}"
    echo "Please start the server first:"
    echo "  cd server && npm run dev"
    exit 1
fi

echo -e "${GREEN}✓ Server is running${NC}"
echo ""

# Check if autocannon is installed
if ! node -e "require('autocannon')" 2> /dev/null; then
    echo -e "${YELLOW}Installing autocannon...${NC}"
    cd server && npm install autocannon
    cd ..
fi

# Run the tests
echo -e "${GREEN}Starting load tests with ${INTENSITY} intensity...${NC}"
echo ""

node server/tests/run-tests.js "$INTENSITY"

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}✓ Load tests completed successfully!${NC}"
else
    echo -e "${RED}✗ Load tests failed with exit code $exit_code${NC}"
fi

exit $exit_code
