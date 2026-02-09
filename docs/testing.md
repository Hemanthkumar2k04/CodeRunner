# Testing Guide

Complete guide for running all tests in the CodeRunner project.

## Quick Start

```bash
# Run all tests (server + client)
./run-tests.sh

# Server tests only
cd server && npm test

# Client tests only
cd client && npm run test:run

# Load testing
cd server/tests/load-test-java
./run-load-test.sh
```

## Server Tests

### Unit & Integration Tests

The server has comprehensive tests covering:

- **Configuration**: Validates all config settings and environment variables
- **Network Management**: Tests Docker network naming, isolation, and subnet allocation
- **Container Pool**: Verifies pool lifecycle, metrics, and cleanup operations
- **Execution Queue**: Tests concurrent execution, priority handling, and resource limits

**Run server tests:**

```bash
cd server
npm test
```

**Test file location:** [server/tests/server.test.ts](../server/tests/server.test.ts)

**Test coverage:**

- 73 test cases
- ~100% pass rate
- Covers all critical system components

### Load Testing (Java)

High-performance multi-threaded load tester built with Java 11.

**Quick start:**

```bash
cd server/tests/load-test-java
./run-load-test.sh
```

**Custom load test:**

```bash
# Compile (first time only)
mvn clean package

# Run with custom parameters
java -jar target/load-tester-1.0.0-jar-with-dependencies.jar \
  --users 60 \              # Total users to simulate
  --ramp-time 30 \          # Ramp-up period in seconds
  --duration 60 \           # Test duration in seconds
  --concurrent 30           # Max concurrent users
```

**Available test scenarios:**

- Python: Hello World, Loops
- JavaScript: Hello World, Loops
- Java: Hello World, ArrayList
- SQL: Basic queries

**What it tests:**

- Concurrent execution capacity (up to 60 users)
- Response times (P50, P95, P99 percentiles)
- Success rate (target: ≥95%)
- System stability under load
- Queue management and prioritization

**Example output:**

```
========================================
         LOAD TEST REPORT
========================================
Test Duration: 60.2s
Total Users: 60
Ramp Time: 30s
Max Concurrent: 30

Results:
  Total Requests: 500
  Successful: 498 (99.60%)
  Failed: 2 (0.40%)

Response Times:
  Average: 435ms
  P50: 421ms
  P95: 712ms
  P99: 1,203ms

Status: ✓ PASS
All success criteria met!
========================================
```

**Pass Criteria:**

- Success rate ≥ 95%
- P95 response time < 10 seconds

**Detailed documentation:** [server/tests/load-test-java/README.md](../server/tests/load-test-java/README.md)

## Client Tests

The client uses Vitest for component and integration testing.

**Run client tests:**

```bash
cd client
npm run test:run         # Run once
npm run test:watch       # Watch mode for development
npm run test:ui          # Visual UI for tests
```

**Test coverage:**

- Component rendering tests
- Socket.io communication tests
- File system utilities
- Editor store state management

**Test files:**

- `src/hooks/useSocket.test.ts` - WebSocket connection handling
- `src/stores/useEditorStore.test.ts` - State management
- `src/lib/file-utils.test.ts` - File operations
- `src/components/Console.test.tsx` - Console component

## Running All Tests

**Automated script (recommended):**

```bash
./run-tests.sh
```

This script:

1. Runs server tests
2. Runs client tests
3. Shows combined results

**Manual approach:**

```bash
# Terminal 1: Server tests
cd server && npm test

# Terminal 2: Client tests
cd client && npm run test:run
```

## Continuous Integration

For CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Server Tests
  run: |
    cd server
    npm install
    npm test

- name: Run Client Tests
  run: |
    cd client
    npm install
    npm run test:run

- name: Run Load Tests
  run: |
    cd server/tests/load-test-java
    mvn clean package
    ./run-load-test.sh
```

## Test Configuration

### Server Tests (Jest)

Configuration: [server/jest.config.js](../server/jest.config.js)

```javascript
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.ts"],
  collectCoverageFrom: ["src/**/*.ts"],
};
```

### Client Tests (Vitest)

Configuration: [client/vitest.config.ts](../client/vitest.config.ts)

Uses React Testing Library and jsdom for browser environment simulation.

### Load Test Configuration

Configuration: [server/tests/load-test-java/pom.xml](../server/tests/load-test-java/pom.xml)

Dependencies:

- OkHttp 4.12.0 (HTTP client with connection pooling)
- Gson 2.10.1 (JSON serialization)
- Java 11+

## Troubleshooting

### Docker Not Running

Some server tests require Docker to be running (network stats tests).

```bash
# Check Docker status
docker ps

# Start Docker if needed
sudo systemctl start docker  # Linux
# or start Docker Desktop     # macOS/Windows
```

### Port Already in Use

If tests fail due to port conflicts:

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Load Test Fails to Compile

```bash
# Ensure Maven is installed
mvn --version

# Clean and rebuild
cd server/tests/load-test-java
mvn clean
mvn package
```

### Test Timeouts

Some tests have longer timeouts (10 seconds) for:

- Queue concurrent execution tests
- Network allocation tests
- Container lifecycle tests

This is expected behavior for integration tests.

## Writing New Tests

### Server Test Example

```typescript
describe("My Feature", () => {
  it("should do something", () => {
    const result = myFunction();
    expect(result).toBe(expected);
  });
});
```

### Client Test Example

```typescript
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

## Performance Benchmarks

Based on load testing results:

| Metric               | Value | Target |
| -------------------- | ----- | ------ |
| Max Concurrent Users | 60    | 50+    |
| Success Rate         | 99.6% | ≥95%   |
| P50 Response Time    | 421ms | <1s    |
| P95 Response Time    | 712ms | <10s   |
| Average Response     | 435ms | <1s    |

**System Capacity:**

- 4,000+ simultaneous connections supported
- 200-400 active executions (depending on resource allocation)
- Network subnets: 4,352 available

**Container Performance:**

- First execution: ~1-2s (container creation)
- Subsequent runs: ~200-400ms (container reuse)
- TTL: 30 seconds (configurable)

## Best Practices

1. **Run tests before committing:** `./run-tests.sh`
2. **Test in isolation:** Each test should be independent
3. **Mock external dependencies:** Don't rely on running services
4. **Use meaningful test names:** Describe what is being tested
5. **Keep tests fast:** Aim for <100ms per unit test
6. **Load test regularly:** Verify system capacity after major changes

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [OkHttp Documentation](https://square.github.io/okhttp/)
