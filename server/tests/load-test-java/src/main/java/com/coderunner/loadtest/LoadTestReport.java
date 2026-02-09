package com.coderunner.loadtest;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Load test report with statistics and metrics
 */
public class LoadTestReport {
    private final List<ApiClient.ExecutionResult> results;
    private final int targetUsers;
    private final long totalDuration; // milliseconds
    private final int maxConcurrent;
    private final Gson gson;

    public LoadTestReport(List<ApiClient.ExecutionResult> results, int targetUsers,
            long totalDuration, int maxConcurrent) {
        this.results = results;
        this.targetUsers = targetUsers;
        this.totalDuration = totalDuration;
        this.maxConcurrent = maxConcurrent;
        this.gson = new GsonBuilder().setPrettyPrinting().create();
    }

    /**
     * Calculate and print summary statistics
     */
    public void printSummary() {
        System.out.println("\n========================================");
        System.out.println("LOAD TEST SUMMARY");
        System.out.println("========================================");

        int totalRequests = results.size();
        long successCount = results.stream().filter(ApiClient.ExecutionResult::isSuccess).count();
        long failureCount = totalRequests - successCount;
        double successRate = totalRequests > 0 ? (successCount * 100.0 / totalRequests) : 0;

        System.out.printf("Total Requests: %d%n", totalRequests);
        System.out.printf("Successful: %d (%.2f%%)%n", successCount, successRate);
        System.out.printf("Failed: %d (%.2f%%)%n", failureCount, 100 - successRate);
        System.out.printf("Target Users: %d%n", targetUsers);
        System.out.printf("Max Concurrent: %d%n", maxConcurrent);
        System.out.printf("Total Duration: %.2f seconds%n", totalDuration / 1000.0);
        System.out.printf("Throughput: %.2f req/sec%n",
                totalRequests * 1000.0 / totalDuration);

        // Response time statistics
        if (!results.isEmpty()) {
            List<Long> responseTimes = results.stream()
                    .map(ApiClient.ExecutionResult::getResponseTime)
                    .sorted()
                    .collect(Collectors.toList());

            long min = responseTimes.get(0);
            long max = responseTimes.get(responseTimes.size() - 1);
            double avg = responseTimes.stream().mapToLong(Long::longValue).average().orElse(0);
            long p50 = getPercentile(responseTimes, 50);
            long p95 = getPercentile(responseTimes, 95);
            long p99 = getPercentile(responseTimes, 99);

            System.out.println("\n--- Response Time (ms) ---");
            System.out.printf("Min: %d%n", min);
            System.out.printf("Max: %d%n", max);
            System.out.printf("Avg: %.2f%n", avg);
            System.out.printf("P50: %d%n", p50);
            System.out.printf("P95: %d%n", p95);
            System.out.printf("P99: %d%n", p99);
        }

        // Execution time statistics (server-side)
        List<ApiClient.ExecutionResult> successfulResults = results.stream()
                .filter(ApiClient.ExecutionResult::isSuccess)
                .collect(Collectors.toList());

        if (!successfulResults.isEmpty()) {
            List<Long> executionTimes = successfulResults.stream()
                    .map(ApiClient.ExecutionResult::getExecutionTime)
                    .filter(t -> t > 0)
                    .sorted()
                    .collect(Collectors.toList());

            if (!executionTimes.isEmpty()) {
                long min = executionTimes.get(0);
                long max = executionTimes.get(executionTimes.size() - 1);
                double avg = executionTimes.stream().mapToLong(Long::longValue).average().orElse(0);
                long p50 = getPercentile(executionTimes, 50);
                long p95 = getPercentile(executionTimes, 95);

                System.out.println("\n--- Execution Time (ms) ---");
                System.out.printf("Min: %d%n", min);
                System.out.printf("Max: %d%n", max);
                System.out.printf("Avg: %.2f%n", avg);
                System.out.printf("P50: %d%n", p50);
                System.out.printf("P95: %d%n", p95);
            }
        }

        // Statistics by language
        Map<String, List<ApiClient.ExecutionResult>> byLanguage = results.stream()
                .collect(Collectors.groupingBy(ApiClient.ExecutionResult::getLanguage));

        System.out.println("\n--- Results by Language ---");
        for (Map.Entry<String, List<ApiClient.ExecutionResult>> entry : byLanguage.entrySet()) {
            String language = entry.getKey();
            List<ApiClient.ExecutionResult> langResults = entry.getValue();
            long langSuccess = langResults.stream().filter(ApiClient.ExecutionResult::isSuccess).count();

            List<Long> langTimes = langResults.stream()
                    .filter(ApiClient.ExecutionResult::isSuccess)
                    .map(ApiClient.ExecutionResult::getExecutionTime)
                    .filter(t -> t > 0)
                    .sorted()
                    .collect(Collectors.toList());

            double avgTime = langTimes.isEmpty() ? 0
                    : langTimes.stream().mapToLong(Long::longValue).average().orElse(0);

            System.out.printf("%s: %d requests, %d successful (%.1f%%), avg: %.0fms%n",
                    language, langResults.size(), langSuccess,
                    langSuccess * 100.0 / langResults.size(), avgTime);
        }

        System.out.println("========================================\n");
    }

    /**
     * Calculate percentile
     */
    private long getPercentile(List<Long> sortedValues, int percentile) {
        if (sortedValues.isEmpty())
            return 0;
        int index = (int) Math.ceil(percentile / 100.0 * sortedValues.size()) - 1;
        index = Math.max(0, Math.min(index, sortedValues.size() - 1));
        return sortedValues.get(index);
    }

    /**
     * Check if test passed based on criteria
     */
    public boolean isPassed() {
        if (results.isEmpty())
            return false;

        long successCount = results.stream().filter(ApiClient.ExecutionResult::isSuccess).count();
        double successRate = successCount * 100.0 / results.size();

        // Calculate P95 latency
        List<Long> responseTimes = results.stream()
                .filter(ApiClient.ExecutionResult::isSuccess)
                .map(ApiClient.ExecutionResult::getResponseTime)
                .sorted()
                .collect(Collectors.toList());

        long p95 = responseTimes.isEmpty() ? Long.MAX_VALUE : getPercentile(responseTimes, 95);

        // Pass criteria: ≥95% success rate AND P95 latency < 10 seconds
        boolean successRateOk = successRate >= 95.0;
        boolean latencyOk = p95 < 10000; // 10 seconds in milliseconds

        System.out.println("\n--- Test Pass Criteria ---");
        System.out.printf("Success Rate: %.2f%% (required: ≥95%%) - %s%n",
                successRate, successRateOk ? "✓ PASS" : "✗ FAIL");
        System.out.printf("P95 Latency: %dms (required: <10000ms) - %s%n",
                p95, latencyOk ? "✓ PASS" : "✗ FAIL");
        System.out.println();

        return successRateOk && latencyOk;
    }

    /**
     * Save report to JSON file
     */
    public void saveToJson(String filename) throws IOException {
        JsonObject report = new JsonObject();

        // Test configuration
        JsonObject config = new JsonObject();
        config.addProperty("targetUsers", targetUsers);
        config.addProperty("maxConcurrent", maxConcurrent);
        config.addProperty("totalDuration", totalDuration);
        report.add("configuration", config);

        // Summary statistics
        JsonObject summary = createSummaryJson();
        report.add("summary", summary);

        // Individual results
        JsonArray resultsArray = new JsonArray();
        for (ApiClient.ExecutionResult result : results) {
            JsonObject resultObj = new JsonObject();
            resultObj.addProperty("language", result.getLanguage());
            resultObj.addProperty("scenario", result.getScenarioName());
            resultObj.addProperty("success", result.isSuccess());
            resultObj.addProperty("statusCode", result.getStatusCode());
            resultObj.addProperty("responseTime", result.getResponseTime());
            resultObj.addProperty("executionTime", result.getExecutionTime());
            resultObj.addProperty("exitCode", result.getExitCode());
            if (result.getError() != null) {
                resultObj.addProperty("error", result.getError());
            }
            resultsArray.add(resultObj);
        }
        report.add("results", resultsArray);

        // Test metadata
        JsonObject metadata = new JsonObject();
        metadata.addProperty("timestamp", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'").format(new Date()));
        metadata.addProperty("passed", isPassed());
        report.add("metadata", metadata);

        // Write to file
        try (FileWriter writer = new FileWriter(filename)) {
            gson.toJson(report, writer);
        }

        System.out.println("JSON report saved to: " + filename);
    }

    /**
     * Create summary JSON object
     */
    private JsonObject createSummaryJson() {
        JsonObject summary = new JsonObject();

        int totalRequests = results.size();
        long successCount = results.stream().filter(ApiClient.ExecutionResult::isSuccess).count();
        long failureCount = totalRequests - successCount;
        double successRate = totalRequests > 0 ? (successCount * 100.0 / totalRequests) : 0;
        double throughput = totalRequests * 1000.0 / totalDuration;

        summary.addProperty("totalRequests", totalRequests);
        summary.addProperty("successCount", successCount);
        summary.addProperty("failureCount", failureCount);
        summary.addProperty("successRate", successRate);
        summary.addProperty("throughput", throughput);

        // Response time stats
        if (!results.isEmpty()) {
            List<Long> responseTimes = results.stream()
                    .map(ApiClient.ExecutionResult::getResponseTime)
                    .sorted()
                    .collect(Collectors.toList());

            JsonObject responseTimeStats = new JsonObject();
            responseTimeStats.addProperty("min", responseTimes.get(0));
            responseTimeStats.addProperty("max", responseTimes.get(responseTimes.size() - 1));
            responseTimeStats.addProperty("avg", responseTimes.stream().mapToLong(Long::longValue).average().orElse(0));
            responseTimeStats.addProperty("p50", getPercentile(responseTimes, 50));
            responseTimeStats.addProperty("p95", getPercentile(responseTimes, 95));
            responseTimeStats.addProperty("p99", getPercentile(responseTimes, 99));
            summary.add("responseTime", responseTimeStats);
        }

        return summary;
    }

    /**
     * Save simple HTML report
     */
    public void saveToHtml(String filename) throws IOException {
        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html>\n<html>\n<head>\n");
        html.append("<title>Load Test Report</title>\n");
        html.append("<style>\n");
        html.append("body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }\n");
        html.append(
                ".container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }\n");
        html.append("h1 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }\n");
        html.append("h2 { color: #666; margin-top: 30px; }\n");
        html.append(".metric { display: inline-block; margin: 10px 20px 10px 0; }\n");
        html.append(".metric-label { font-weight: bold; color: #666; }\n");
        html.append(".metric-value { font-size: 1.2em; color: #333; }\n");
        html.append(".pass { color: #4CAF50; font-weight: bold; }\n");
        html.append(".fail { color: #f44336; font-weight: bold; }\n");
        html.append("table { width: 100%; border-collapse: collapse; margin-top: 20px; }\n");
        html.append("th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }\n");
        html.append("th { background-color: #4CAF50; color: white; }\n");
        html.append("</style>\n</head>\n<body>\n");
        html.append("<div class='container'>\n");

        html.append("<h1>CodeRunner Load Test Report</h1>\n");
        html.append("<p><strong>Date:</strong> ").append(new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date()))
                .append("</p>\n");

        // Summary metrics
        html.append("<h2>Summary</h2>\n");
        int totalRequests = results.size();
        long successCount = results.stream().filter(ApiClient.ExecutionResult::isSuccess).count();
        double successRate = totalRequests > 0 ? (successCount * 100.0 / totalRequests) : 0;

        html.append("<div class='metric'><span class='metric-label'>Total Requests:</span> <span class='metric-value'>")
                .append(totalRequests).append("</span></div>\n");
        html.append("<div class='metric'><span class='metric-label'>Success Rate:</span> <span class='metric-value'>")
                .append(String.format("%.2f%%", successRate)).append("</span></div>\n");
        html.append("<div class='metric'><span class='metric-label'>Throughput:</span> <span class='metric-value'>")
                .append(String.format("%.2f req/s", totalRequests * 1000.0 / totalDuration)).append("</span></div>\n");
        html.append("<div class='metric'><span class='metric-label'>Test Status:</span> <span class='")
                .append(isPassed() ? "pass'>PASSED" : "fail'>FAILED").append("</span></div>\n");

        // Response time table
        if (!results.isEmpty()) {
            List<Long> responseTimes = results.stream()
                    .map(ApiClient.ExecutionResult::getResponseTime)
                    .sorted()
                    .collect(Collectors.toList());

            html.append("<h2>Response Time (milliseconds)</h2>\n");
            html.append("<table>\n<tr><th>Metric</th><th>Value</th></tr>\n");
            html.append("<tr><td>Min</td><td>").append(responseTimes.get(0)).append("</td></tr>\n");
            html.append("<tr><td>P50</td><td>").append(getPercentile(responseTimes, 50)).append("</td></tr>\n");
            html.append("<tr><td>P95</td><td>").append(getPercentile(responseTimes, 95)).append("</td></tr>\n");
            html.append("<tr><td>P99</td><td>").append(getPercentile(responseTimes, 99)).append("</td></tr>\n");
            html.append("<tr><td>Max</td><td>").append(responseTimes.get(responseTimes.size() - 1))
                    .append("</td></tr>\n");
            html.append("</table>\n");
        }

        html.append("</div>\n</body>\n</html>");

        Files.write(Paths.get(filename), html.toString().getBytes());
        System.out.println("HTML report saved to: " + filename);
    }
}
