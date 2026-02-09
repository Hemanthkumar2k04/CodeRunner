package com.coderunner.loadtest;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Executes load tests with ramp-up pattern
 * Gradually increases load from 1 user to target user count over specified
 * duration
 */
public class RampExecutor {
    private final ApiClient apiClient;
    private final int targetUsers;
    private final long rampTimeMs;
    private final long testDurationMs;
    private final int maxConcurrent;
    private final List<ApiClient.ExecutionResult> results;
    private final AtomicInteger activeUsers;
    private final AtomicInteger completedRequests;
    private final AtomicInteger failedRequests;
    private volatile boolean running;

    public RampExecutor(ApiClient apiClient, int targetUsers, long rampTimeMs,
            long testDurationMs, int maxConcurrent) {
        this.apiClient = apiClient;
        this.targetUsers = targetUsers;
        this.rampTimeMs = rampTimeMs;
        this.testDurationMs = testDurationMs;
        this.maxConcurrent = maxConcurrent;
        this.results = new CopyOnWriteArrayList<>();
        this.activeUsers = new AtomicInteger(0);
        this.completedRequests = new AtomicInteger(0);
        this.failedRequests = new AtomicInteger(0);
        this.running = false;
    }

    /**
     * Execute the ramp test
     */
    public LoadTestReport execute() throws Exception {
        running = true;
        long testStartTime = System.currentTimeMillis();

        System.out.println("========================================");
        System.out.println("Starting Ramp Load Test");
        System.out.println("========================================");
        System.out.println("Target Users: " + targetUsers);
        System.out.println("Ramp Time: " + (rampTimeMs / 1000) + " seconds");
        System.out.println("Test Duration: " + (testDurationMs / 1000) + " seconds");
        System.out.println("Max Concurrent: " + maxConcurrent);
        System.out.println("========================================\n");

        // Create thread pool with max concurrent limit
        ExecutorService executor = Executors.newFixedThreadPool(maxConcurrent);
        List<Future<?>> futures = new ArrayList<>();

        // Calculate delay between starting each user
        long delayBetweenUsers = targetUsers > 1 ? rampTimeMs / (targetUsers - 1) : 0;

        // Schedule user tasks
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);

        for (int userId = 1; userId <= targetUsers; userId++) {
            final int userNumber = userId;
            long startDelay = (userId - 1) * delayBetweenUsers;

            scheduler.schedule(() -> {
                if (running) {
                    Future<?> future = executor.submit(() -> executeUserSession(userNumber, testStartTime));
                    futures.add(future);
                }
            }, startDelay, TimeUnit.MILLISECONDS);
        }

        // Monitor progress
        ScheduledExecutorService monitor = Executors.newScheduledThreadPool(1);
        monitor.scheduleAtFixedRate(() -> {
            printProgress();
        }, 2, 2, TimeUnit.SECONDS);

        // Wait for test duration to complete
        long totalTestTime = Math.max(rampTimeMs, testDurationMs);
        Thread.sleep(totalTestTime);

        // Stop accepting new requests
        running = false;

        System.out.println("\nTest duration completed. Waiting for active requests to finish...");

        // Shutdown scheduler
        scheduler.shutdown();
        monitor.shutdown();

        // Wait for all tasks to complete (with timeout)
        executor.shutdown();
        if (!executor.awaitTermination(30, TimeUnit.SECONDS)) {
            System.err.println("Warning: Some tasks did not complete within timeout");
            executor.shutdownNow();
        }

        long testEndTime = System.currentTimeMillis();
        long actualDuration = testEndTime - testStartTime;

        System.out.println("\n========================================");
        System.out.println("Load Test Completed");
        System.out.println("========================================");
        System.out.println("Actual Duration: " + (actualDuration / 1000.0) + " seconds");
        System.out.println("Total Requests: " + results.size());
        System.out.println("Successful: " + completedRequests.get());
        System.out.println("Failed: " + failedRequests.get());
        System.out.println("========================================\n");

        return new LoadTestReport(results, targetUsers, actualDuration, maxConcurrent);
    }

    /**
     * Execute a user session (multiple requests over test duration)
     */
    private void executeUserSession(int userId, long testStartTime) {
        activeUsers.incrementAndGet();
        long userStartTime = System.currentTimeMillis();

        try {
            // Each user makes multiple requests during the test
            int requestCount = 0;

            while (running && (System.currentTimeMillis() - testStartTime) < testDurationMs) {
                try {
                    // Select random test scenario
                    TestScenario scenario = TestScenario.getRandomWeighted();

                    // Execute request
                    ApiClient.ExecutionResult result = apiClient.executeCode(scenario);
                    results.add(result);

                    if (result.isSuccess()) {
                        completedRequests.incrementAndGet();
                    } else {
                        failedRequests.incrementAndGet();
                        System.err.println("[User-" + userId + "] Request failed: " + result.getError());
                    }

                    requestCount++;

                    // Small delay between requests from same user (simulate think time)
                    Thread.sleep(1000 + (long) (Math.random() * 2000)); // 1-3 seconds

                } catch (Exception e) {
                    failedRequests.incrementAndGet();
                    System.err.println("[User-" + userId + "] Error: " + e.getMessage());
                }
            }

            long userDuration = System.currentTimeMillis() - userStartTime;
            System.out.println("[User-" + userId + "] Completed " + requestCount +
                    " requests in " + (userDuration / 1000.0) + "s");

        } finally {
            activeUsers.decrementAndGet();
        }
    }

    /**
     * Print progress update
     */
    private void printProgress() {
        System.out.printf("[Progress] Active Users: %d | Completed: %d | Failed: %d | Total: %d%n",
                activeUsers.get(), completedRequests.get(), failedRequests.get(), results.size());
    }

    /**
     * Get current results
     */
    public List<ApiClient.ExecutionResult> getResults() {
        return new ArrayList<>(results);
    }
}
