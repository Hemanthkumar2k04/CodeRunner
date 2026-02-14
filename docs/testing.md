# Testing Guide

Complete testing guide for CodeRunner, covering unit tests, integration tests, and performance load testing.

## Why Test?

### Code Quality & Reliability

- **Catch regressions**: Ensure new changes don't break existing functionality
- **Validate behavior**: Confirm components work as designed
- **Increase confidence**: Deploy with assurance that critical systems work
- **Documentation**: Tests serve as executable documentation of expected behavior

### Performance & Stability

- **Load testing**: Verify system handles expected user concurrency
- **Bottleneck identification**: Find performance issues before production
- **Capacity planning**: Determine max concurrent users your infrastructure supports
- **Regression detection**: Catch performance degradation early

### System Components Requiring Testing

- **Execution Queue**: Priority handling, concurrency management, timeout behavior
- **Container Pool**: Lifecycle management, resource cleanup, reuse logic
- **Network Management**: Docker network isolation, subnet allocation
- **WebSocket Communication**: Real-time message delivery, session handling
- **Configuration**: Environment variable loading, defaults application

## Quick Start

### Run All Tests

```bash
./run-tests.sh
```

This runs unit tests, integration tests, and basic validation across the entire project.

### Run Specific Test Suites

**Server Unit & Integration Tests**:

```bash
cd server
npm test
```

**Client Unit Tests**:

```bash
cd client
npm run test:run
```

**Performance Load Testing**:

```bash
cd server/tests/load-test-java
./run-load-test.sh
```

## Server Tests

### Overview

The server test suite covers critical backend components with ~100+ test cases ensuring reliability and correctness.

**Location**: `server/tests/server.test.ts`

### What's Tested

#### 1. Configuration Management

- Environment variable loading
- Default value application
- Type validation
- Error handling for missing required configs

#### 2. Execution Queue System

- **Task queueing**: Adding tasks with different priorities
- **Priority sorting**: WebSocket > API > Notebook order
- **Concurrency control**: Limiting concurrent executions (default: 50)
- **Queue capacity**: Enforcing 200-task limit
- **Task timeout**: 60-second expiration
- **Non-blocking execution**: Verifying fire-and-forget pattern
- **Metrics tracking**: Success/failure/timing metrics

#### 3. Container Pool Management

- Container creation and destruction
- Pool lifecycle (creation, reuse, cleanup)
- TTL management (60-second timeout)
- Metrics collection
- Resource cleanup on session end

#### 4. Network Management

- Docker network creation
- Subnet allocation (172.25.x.0/24 pattern)
- Network isolation per session
- Cleanup on network deletion

### Running Server Tests

```bash
cd server
npm test
```

### Test Output

Successful test run shows:

```
PASS  tests/server.test.ts
  ✓ Queue Management
    ✓ Enqueue task with priority
    ✓ Sort tasks by priority then FIFO
    ✓ Enforce max concurrent limit
    ✓ Remove expired tasks
  ✓ Container Pool
    ✓ Create container on demand
    ✓ Reuse container within TTL
    ✓ Clean up expired containers
  ✓ Network Management
    ✓ Create isolated network
    ✓ Allocate unique subnet
    ✓ Clean up network

Tests:  73 passed, 0 failed
```

## Client Tests

### Overview

Frontend tests ensure UI components work correctly and integration with backend is seamless.

**Location**: `client/src/**/*.test.tsx`

### What's Tested

- Component rendering
- User interaction handling
- Socket.IO communication
- File explorer operations
- Code editor functionality
- Console output display

### Running Client Tests

```bash
cd client
npm run test:run
```

### Watch Mode (During Development)

```bash
cd client
npm run test
```

## Performance Load Testing

### Overview

High-performance concurrent load testing built with Java 11. Simulates multiple users executing code concurrently to verify system capacity and identify bottlenecks.

**Location**: `server/tests/load-test-java/`

### Why Load Test?

Load testing answers critical questions:

1. **Capacity**: How many concurrent users can the system handle?
2. **Response times**: What are P50, P95, P99 latencies?
3. **Stability**: Does performance degrade under sustained load?
4. **Bottlenecks**: Which component is the limiting factor?
5. **Resource usage**: CPU, memory, container utilization under load

### Quick Start

```bash
cd server/tests/load-test-java
./run-load-test.sh
```

This runs the default load test:

- **Users**: 60 concurrent
- **Ramp time**: 30 seconds (gradual ramp-up)
- **Duration**: 60 seconds
- **Scenarios**: All languages

### Custom Load Test

First compile (if not done recently):

```bash
cd server/tests/load-test-java
mvn clean package
```

Then run with custom parameters:

```bash
java -jar target/load-tester-1.0.0-jar-with-dependencies.jar \
  --users 100 \
  --ramp-time 20 \
  --duration 120 \
  --concurrent 50
```

### Parameters

- `--users` (default: 60): Total simulated users
- `--ramp-time` (default: 30): Ramp-up period in seconds (gradual load increase)
- `--duration` (default: 60): Total test duration in seconds
- `--concurrent` (default: 30): Maximum concurrent users at peak

### Test Scenarios

The load tester runs multiple language scenarios:

**Python**

- Hello World
- Loops and iterations

**JavaScript**

- Hello World
- Loops and iterations

**Java**

- Hello World
- ArrayList operations

**SQL**

- Basic queries
- Data operations

### Interpreting Results

**HTML Report**: Generated in `reports/` directory

- Visual charts for response times
- Success/failure breakdown
- Throughput metrics
- Detailed request logs

**Report Metrics**:

```
Total Requests:     500
Success Rate:       98%
Failed:             10

Response Times:
  Min:              105ms
  Max:              2,500ms
  Avg/Mean:         450ms
  P50 (Median):     350ms
  P95:              800ms
  P99:              1,500ms

Requests/Second:    8.3
```

### Performance Targets

Recommended targets for production:

- **Success rate**: ≥95% (some timeouts acceptable)
- **P95 latency**: <1,000ms
- **P99 latency**: <2,000ms
- **Throughput**: >5 req/sec per concurrent user

### Load Test Examples

#### Light Load (10 users)

```bash
java -jar target/load-tester-1.0.0-jar-with-dependencies.jar \
  --users 10 --ramp-time 5 --duration 30 --concurrent 5
```

Tests basic functionality and baseline performance.

#### Moderate Load (50 users)

```bash
java -jar target/load-tester-1.0.0-jar-with-dependencies.jar \
  --users 50 --ramp-time 15 --duration 60 --concurrent 25
```

Realistic production-like load.

#### Stress Test (100+ users)

```bash
java -jar target/load-tester-1.0.0-jar-with-dependencies.jar \
  --users 150 --ramp-time 30 --duration 120 --concurrent 75
```

Identifies breaking points and resource limits.

### Performance Optimization Tips

If load test results are poor:

1. **Increase max concurrent** in config (default: 50)

   ```bash
   # In server/.env
   MAX_CONCURRENT_SESSIONS=100
   ```

2. **Increase worker threads** (default: CPU cores)

   ```bash
   # In server/.env
   WORKER_THREADS=8
   ```

3. **Monitor container reuse**
   - Check `GET /api/queue-stats` for reuse rate
   - Aim for >80% reuse rate
   - Increase container TTL if reuse low

4. **Check Docker resources**
   - Ensure sufficient CPU/memory
   - Monitor with `docker stats`
   - Consider removing unused containers

5. **Profile bottleneck**
   - Check `GET /api/admin/metrics`
   - Identify slowest component
   - Optimize or add resources

### Batch Load Testing

Run multiple load tests with different parameters:

```bash
#!/bin/bash
cd server/tests/load-test-java

echo "Light load test..."
java -jar target/load-tester-1.0.0-jar-with-dependencies.jar --users 10 --duration 30

echo "Moderate load test..."
java -jar target/load-tester-1.0.0-jar-with-dependencies.jar --users 50 --duration 60

echo "Heavy load test..."
java -jar target/load-tester-1.0.0-jar-with-dependencies.jar --users 100 --duration 120
```

## Continuous Testing Strategy

### Before Each Commit

```bash
cd server && npm test  # Ensure no regressions
cd client && npm run test:run
```

### Weekly Load Testing

Run moderate load test to catch performance degradation:

```bash
cd server/tests/load-test-java
./run-load-test.sh
```

### Before Release

1. Run full test suite: `./run-tests.sh`
2. Run stress test (100+ users)
3. Review performance metrics
4. Verify no regressions from previous versions

### Production Monitoring

After deployment:

- Monitor production metrics at `GET /api/queue-stats`
- Watch response times and success rates
- Adjust `MAX_CONCURRENT_SESSIONS` if needed

## Troubleshooting

### Server Tests Failing

**Issue**: Docker not found

```bash
# Ensure Docker daemon is running
sudo systemctl start docker
```

**Issue**: Port already in use

```bash
# Find process using port 3000
lsof -i :3000
kill -9 <PID>
```

### Load Test Failing

**Issue**: Java version mismatch

```bash
java -version  # Should be 11 or higher
# Install if needed: sudo apt-get install openjdk-11-jdk
```

**Issue**: Server not responding

```bash
# Ensure backend is running
cd server && npm run dev
```

**Issue**: Low success rate (<90%)

- Server may be overloaded
- Reduce `--users` or `--concurrent` parameters
- Check logs for errors
- Increase `MAX_CONCURRENT_SESSIONS` and restart

## Advanced Testing

### Code Coverage

Server tests have high coverage of critical components:

```bash
cd server
npm test -- --coverage
```

### Integration Testing

Tests verify components work together:

- Queue → Container Pool → Docker integration
- WebSocket → Queue → Execution flow
- Network Management → Container lifecycle

### Profile Local Changes

Develop and test improvements:

```bash
# Make changes, then run targeted test
cd server && npm test -- --testNamePattern="Queue"
```

## Test Maintenance

- Update tests when behavior changes
- Add tests for new features
- Keep load test scenarios current with supported languages
- Remove obsolete test cases
