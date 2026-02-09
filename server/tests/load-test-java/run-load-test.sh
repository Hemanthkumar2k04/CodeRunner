#!/bin/bash

# Load Test Runner Script
# Builds and runs the Java load tester with sensible defaults

set -e

echo "========================================="
echo "   CodeRunner Load Test Runner"
echo "========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "pom.xml" ]; then
    echo "❌ Error: pom.xml not found"
    echo "Please run this script from: server/tests/load-test-java/"
    exit 1
fi

# Check if Java is installed
if ! command -v java &> /dev/null; then
    echo "❌ Error: Java not found"
    echo "Please install Java 11 or higher"
    exit 1
fi

# Check Java version
JAVA_VERSION=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d'.' -f1)
if [ "$JAVA_VERSION" -lt 11 ]; then
    echo "❌ Error: Java 11 or higher required (found: $JAVA_VERSION)"
    exit 1
fi

# Check if Maven is installed
if ! command -v mvn &> /dev/null; then
    echo "❌ Error: Maven not found"
    echo "Please install Maven 3.6 or higher"
    exit 1
fi

# Build if jar doesn't exist
JAR_FILE="target/load-tester-1.0.0-jar-with-dependencies.jar"
if [ ! -f "$JAR_FILE" ]; then
    echo "📦 Building load tester..."
    mvn clean package -q
    echo "✓ Build complete"
    echo ""
fi

# Check if server is running
echo "🔍 Checking if server is running..."
if ! curl -s -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "⚠️  Warning: Server does not appear to be running on http://localhost:3000"
    echo "Please start the server first:"
    echo "  cd server && npm run dev"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✓ Server is running"
fi

echo ""
echo "========================================="
echo "   Starting Load Test"
echo "========================================="
echo ""

# Default parameters (can be overridden)
USERS=${USERS:-60}
RAMP_TIME=${RAMP_TIME:-30}
DURATION=${DURATION:-60}
CONCURRENT=${CONCURRENT:-30}

echo "Test Configuration:"
echo "  Users: $USERS"
echo "  Ramp Time: ${RAMP_TIME}s"
echo "  Duration: ${DURATION}s"
echo "  Max Concurrent: $CONCURRENT"
echo ""
echo "Tip: Override with environment variables:"
echo "  USERS=100 CONCURRENT=50 ./run-load-test.sh"
echo ""

# Run the load test
java -jar "$JAR_FILE" \
  --users "$USERS" \
  --ramp-time "$RAMP_TIME" \
  --duration "$DURATION" \
  --concurrent "$CONCURRENT"

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Load test completed successfully"
else
    echo "❌ Load test failed with exit code $EXIT_CODE"
fi

exit $EXIT_CODE
