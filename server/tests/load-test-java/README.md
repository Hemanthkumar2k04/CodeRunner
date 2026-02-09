# Load Testing Tool

Multi-threaded Java load tester for stress testing the CodeRunner server's concurrent execution capacity.

## Quick Start

```bash
# Run pre-configured load test
./run-load-test.sh

# Or run manually with default settings
java -jar target/load-tester-1.0.0-jar-with-dependencies.jar \
  --users 60 \
  --ramp-time 30 \
  --duration 60 \
  --concurrent 30
```

## Installation

### Prerequisites

- Java 11 or higher
- Maven 3.6+
- Running CodeRunner server (http://localhost:3000)

### Build

```bash
# First time setup
mvn clean package

# This creates: target/load-tester-1.0.0-jar-with-dependencies.jar
```

## Usage

### Command Line Arguments

```bash
java -jar target/load-tester-1.0.0-jar-with-dependencies.jar [OPTIONS]
```

| Option             | Description                   | Default               | Example                                  |
| ------------------ | ----------------------------- | --------------------- | ---------------------------------------- |
| `--users N`        | Total number of virtual users | 10                    | `--users 60`                             |
| `--ramp-time N`    | Ramp-up period in seconds     | 5                     | `--ramp-time 30`                         |
| `--duration N`     | Test duration in seconds      | 30                    | `--duration 60`                          |
| `--concurrent N`   | Max concurrent users          | 5                     | `--concurrent 30`                        |
| `--server-url URL` | Server base URL               | http://localhost:3000 | `--server-url http://192.168.1.100:3000` |
| `--help`           | Show help message             | -                     | `--help`                                 |

### Example Commands

**Light load (testing):**

```bash
java -jar target/load-tester-1.0.0-jar-with-dependencies.jar \
  --users 10 \
  --concurrent 5 \
  --duration 30
```

**Medium load (realistic):**

```bash
java -jar target/load-tester-1.0.0-jar-with-dependencies.jar \
  --users 30 \
  --ramp-time 15 \
  --duration 45 \
  --concurrent 15
```

**Heavy load (stress test):**

```bash
java -jar target/load-tester-1.0.0-jar-with-dependencies.jar \
  --users 60 \
  --ramp-time 30 \
  --duration 60 \
  --concurrent 30
```

**Custom server:**

```bash
java -jar target/load-tester-1.0.0-jar-with-dependencies.jar \
  --users 40 \
  --server-url http://192.168.1.100:3000
```

## Test Scenarios

The load tester includes 6 pre-built test scenarios:

### Python

1. **Hello World** - Simple print statement
2. **Loops** - Nested loops with calculations

### JavaScript

3. **Hello World** - console.log statement
4. **Loops** - Nested for loops

### Java

5. **Hello World** - System.out.println
6. **ArrayList** - ArrayList operations

Each request randomly selects a scenario and executes it via the `/api/run` endpoint.

## How It Works

### Execution Flow

1. **Health Check**: Verifies server is running before starting test
2. **Ramp-up**: Gradually adds users over the ramp-time period
   - Prevents overwhelming the server
   - Simulates realistic user behavior
3. **Sustained Load**: All users execute requests for the duration
4. **Data Collection**: Tracks success/failure and response times
5. **Report Generation**: Calculates statistics and displays results

### Architecture

```
LoadTester (Main)
    ├── ApiClient (HTTP connections)
    │   └── OkHttp ConnectionPool (100 connections, 60s timeout)
    ├── RampExecutor (Thread management)
    │   └── ExecutorService (Fixed thread pool)
    ├── TestScenario (Test data)
    └── LoadTestReport (Statistics)
```

**Key Components:**

- **ApiClient**: HTTP client with connection pooling and retry logic
- **RampExecutor**: Manages gradual user ramp-up with thread synchronization
- **TestScenario**: Provides realistic code execution scenarios
- **LoadTestReport**: Calculates P50/P95/P99 percentiles and pass/fail criteria

### Metrics Collected

- **Total Requests**: Number of API calls made
- **Success Rate**: Percentage of successful executions
- **Response Times**:
  - Average
  - P50 (median)
  - P95 (95th percentile)
  - P99 (99th percentile)
- **Failures**: Count and types of errors

## Interpreting Results

### Example Output

```
========================================
         LOAD TEST REPORT
========================================
Test Configuration:
  Duration: 60.2s
  Total Users: 60
  Ramp Time: 30s
  Max Concurrent: 30

Execution Results:
  Total Requests: 500
  Successful: 498 (99.60%)
  Failed: 2 (0.40%)

Response Time Distribution:
  Average: 435ms
  P50 (Median): 421ms
  P95: 712ms
  P99: 1,203ms

Pass Criteria:
  ✓ Success Rate: 99.60% (required: ≥95%)
  ✓ P95 Response Time: 712ms (required: <10s)

Overall Status: ✓ PASS
All success criteria met!
========================================
```

### Pass Criteria

The test **PASSES** if:

1. ✅ Success rate ≥ 95%
2. ✅ P95 response time < 10 seconds

The test **FAILS** if either criterion is not met.

### Reading Response Times

- **P50 (Median)**: Half of requests are faster than this
- **P95**: 95% of requests are faster than this (typical SLA metric)
- **P99**: 99% of requests are faster than this (detects outliers)

**Good performance:**

- P50 < 500ms
- P95 < 1s
- P99 < 2s

**Acceptable performance:**

- P50 < 1s
- P95 < 5s
- P99 < 10s

**Poor performance (investigate):**

- P50 > 2s
- P95 > 10s
- Success rate < 95%

## Troubleshooting

### Server Not Running

```
Error: Failed to connect to server at http://localhost:3000
Health check failed: Connection refused

Solution: Start the server first:
  cd server && npm run dev
```

### Connection Timeouts

```
Error: Many requests timing out
P95: 30,000ms

Possible causes:
  1. Server overloaded (reduce --users or --concurrent)
  2. Docker containers not being reused (check TTL settings)
  3. Resource exhaustion (check system memory/CPU)

Solutions:
  - Reduce concurrent load
  - Increase server resources
  - Check server logs for errors
```

### Low Success Rate

```
Success Rate: 78.5% (required: ≥95%)

Possible causes:
  1. Queue full errors (increase MAX_QUEUE_SIZE in .env)
  2. Container creation failures
  3. Resource limits exceeded

Solutions:
  - Check server logs: cd server && npm run dev
  - Review queue stats: curl http://localhost:3000/api/queue-stats
  - Adjust MAX_CONCURRENT_SESSIONS in .env
```

### Build Failures

```bash
# Clean Maven cache and rebuild
mvn clean
rm -rf target/
mvn package

# Verify Java version
java -version  # Should be 11+

# Verify Maven version
mvn -version   # Should be 3.6+
```

## Configuration

### Server .env Settings

Optimize server for load testing:

```bash
# Queue configuration
MAX_CONCURRENT_SESSIONS=50    # Increase concurrent execution limit
MAX_QUEUE_SIZE=200            # Increase queue capacity
QUEUE_TIMEOUT=60000           # Queue timeout in ms

# Container configuration
SESSION_TTL=30000             # Container reuse window (30s)
CLEANUP_INTERVAL=30000        # Cleanup frequency

# Resource limits
DOCKER_MEMORY=128m            # Lower for more concurrency
DOCKER_CPUS=0.5              # CPU per container
```

### Load Test Configuration

Edit `pom.xml` to change dependencies or build settings:

```xml
<properties>
    <okhttp.version>4.12.0</okhttp.version>
    <gson.version>2.10.1</gson.version>
    <java.version>11</java.version>
</properties>
```

Modify `ApiClient.java` to adjust connection pooling:

```java
private static final int MAX_CONNECTIONS = 100;
private static final int KEEP_ALIVE_DURATION = 60; // seconds
```

## Performance Benchmarks

Based on testing with default configuration:

| Users | Concurrent | Success Rate | P50   | P95   | P99     |
| ----- | ---------- | ------------ | ----- | ----- | ------- |
| 10    | 5          | 100%         | 280ms | 450ms | 520ms   |
| 30    | 15         | 99.8%        | 380ms | 650ms | 890ms   |
| 60    | 30         | 99.6%        | 420ms | 710ms | 1,200ms |

**Hardware:** 4-core CPU, 8GB RAM, SSD

## Development

### Project Structure

```
src/main/java/com/coderunner/loadtest/
├── LoadTester.java          # Main entry point, CLI parsing
├── ApiClient.java           # HTTP client with connection pooling
├── RampExecutor.java        # Thread management and ramp-up logic
├── TestScenario.java        # Test data scenarios
└── LoadTestReport.java      # Statistics and reporting
```

### Adding New Scenarios

Edit `TestScenario.java`:

```java
public static TestScenario[] getScenarios() {
    return new TestScenario[]{
        // Existing scenarios...
        new TestScenario(
            "python",
            Arrays.asList(
                new FileData("my_script.py", "print('Custom test')")
            ),
            "Custom Python Test"
        )
    };
}
```

### Customizing Reports

Edit `LoadTestReport.java` to add metrics or change formatting:

```java
public void printReport() {
    // Add custom metrics
    System.out.printf("Custom Metric: %d%n", customValue);
}
```

## Advanced Usage

### Programmatic Usage

```java
import com.coderunner.loadtest.*;

public class CustomLoadTest {
    public static void main(String[] args) {
        ApiClient client = new ApiClient("http://localhost:3000");
        RampExecutor executor = new RampExecutor(
            60,    // users
            30,    // rampTime
            60,    // duration
            30,    // maxConcurrent
            client
        );

        LoadTestReport report = executor.execute();
        report.printReport();
    }
}
```

### Integration with CI/CD

```bash
#!/bin/bash
# run-ci-load-test.sh

set -e

# Start server in background
cd server
npm run dev &
SERVER_PID=$!

# Wait for server to be ready
sleep 5

# Run load test
cd ../server/tests/load-test-java
java -jar target/load-tester-1.0.0-jar-with-dependencies.jar \
  --users 30 \
  --duration 30 \
  > load-test-results.txt

# Check if test passed
if grep -q "PASS" load-test-results.txt; then
    echo "Load test PASSED"
    EXIT_CODE=0
else
    echo "Load test FAILED"
    EXIT_CODE=1
fi

# Cleanup
kill $SERVER_PID

exit $EXIT_CODE
```

## Resources

- [OkHttp Documentation](https://square.github.io/okhttp/)
- [Maven Getting Started](https://maven.apache.org/guides/getting-started/)
- [Java Concurrency](https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/util/concurrent/package-summary.html)
