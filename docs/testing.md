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
./scripts/run-tests.sh
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
./scripts/run-load-tests.sh
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

### Quick Start

```bash
./scripts/run-load-tests.sh [light|moderate|heavy]
```

This runs the load test using `autocannon`:

- **Light**: 10 concurrent connections, 30s
- **Moderate**: 50 concurrent connections, 60s
- **Heavy**: 100 concurrent connections, 90s

### Manual Execution

You can run the underlying test runner directly:

```bash
node server/tests/run-tests.js [intensity]
```

### Parameters

- `intensity`: one of `light`, `moderate`, `heavy` (default: `moderate`)
- `--languages=...`: comma-separated list of languages to test (e.g. `python,javascript`)

The load tester runs multiple language scenarios including Python, JavaScript, Java, C++, and SQL.

### Interpreting Results

Results are printed directly to the console with:
- Throughput (Requests/sec)
- Latency (P50, P95, P99)
- Error rate
- Detailed tables per endpoint

### Performance Optimization Tips

If load test results are poor:

1. **Increase max concurrent sessions** in config (default: 50)

   ```bash
   # In server/.env
   MAX_CONCURRENT_SESSIONS=100
   ```

2. **Monitor container reuse**
   - Check `GET /api/queue-stats` for reuse rate
   - Aim for >80% reuse rate
   - Increase container TTL if reuse low

3. **Check Docker resources**
   - Ensure sufficient CPU/memory
   - Monitor with `docker stats`
   - Consider removing unused containers

4. **Profile bottleneck**
   - Check `GET /api/admin/metrics`
   - Identify slowest component
   - Optimize or add resources

### Batch Load Testing

Run multiple load tests using the intensity flag:

```bash
./scripts/run-load-tests.sh light
./scripts/run-load-tests.sh moderate
./scripts/run-load-tests.sh heavy
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
./scripts/run-load-tests.sh moderate
```

### Before Release

1. Run full test suite: `./scripts/run-tests.sh`
2. Run stress test (heavy intensity)
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

### Load Test failing

**Issue**: Server not responding

```bash
# Ensure backend is running
# Docker:
./setup.sh --docker
# Local:
cd server && npm run dev
```

**Issue**: Low success rate (<90%)

- Server may be overloaded
- Reduce intensity to `light`
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
