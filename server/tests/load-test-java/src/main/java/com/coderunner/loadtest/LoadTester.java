package com.coderunner.loadtest;

import java.text.SimpleDateFormat;
import java.util.Date;

/**
 * Main load tester application
 * Multi-threaded load testing tool for CodeRunner API
 */
public class LoadTester {

    public static void main(String[] args) {
        try {
            // Parse command line arguments
            Config config = parseArgs(args);

            if (config == null) {
                printUsage();
                System.exit(1);
            }

            System.out.println("\n╔════════════════════════════════════════╗");
            System.out.println("║   CodeRunner Load Testing Tool        ║");
            System.out.println("╚════════════════════════════════════════╝\n");

            // Initialize API client
            ApiClient apiClient = new ApiClient(config.endpoint);

            // Pre-flight check
            System.out.println("Performing pre-flight health check...");
            if (!apiClient.checkHealth()) {
                System.err.println("ERROR: Server health check failed!");
                System.err.println("Please ensure the server is running at: " + config.endpoint);
                System.exit(1);
            }
            System.out.println("✓ Server is healthy\n");

            // Create executor
            RampExecutor executor = new RampExecutor(
                    apiClient,
                    config.users,
                    config.rampTime * 1000L,
                    config.duration * 1000L,
                    config.concurrent);

            // Execute test
            LoadTestReport report = executor.execute();

            // Print summary
            report.printSummary();

            // Generate timestamp for report files
            String timestamp = new SimpleDateFormat("yyyyMMdd-HHmmss").format(new Date());
            String reportDir = config.reportDir != null ? config.reportDir : ".";

            // Save reports
            String jsonFile = reportDir + "/loadtest-" + timestamp + ".json";
            String htmlFile = reportDir + "/loadtest-" + timestamp + ".html";

            report.saveToJson(jsonFile);
            report.saveToHtml(htmlFile);

            // Shutdown client
            apiClient.shutdown();

            // Exit with appropriate code
            if (report.isPassed()) {
                System.out.println("\n✓ Load test PASSED");
                System.exit(0);
            } else {
                System.err.println("\n✗ Load test FAILED");
                System.exit(1);
            }

        } catch (Exception e) {
            System.err.println("\nERROR: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }

    /**
     * Parse command line arguments
     */
    private static Config parseArgs(String[] args) {
        Config config = new Config();

        // Defaults
        config.endpoint = "http://localhost:3000";
        config.users = 60;
        config.rampTime = 30;
        config.duration = 60;
        config.concurrent = 30;
        config.reportDir = null;

        for (int i = 0; i < args.length; i++) {
            String arg = args[i];

            if (arg.equals("--help") || arg.equals("-h")) {
                return null;
            }

            if (i + 1 < args.length) {
                String value = args[i + 1];

                switch (arg) {
                    case "--endpoint":
                    case "-e":
                        config.endpoint = value;
                        i++;
                        break;
                    case "--users":
                    case "-u":
                        config.users = Integer.parseInt(value);
                        i++;
                        break;
                    case "--ramp-time":
                    case "-r":
                        config.rampTime = Integer.parseInt(value);
                        i++;
                        break;
                    case "--duration":
                    case "-d":
                        config.duration = Integer.parseInt(value);
                        i++;
                        break;
                    case "--concurrent":
                    case "-c":
                        config.concurrent = Integer.parseInt(value);
                        i++;
                        break;
                    case "--report-dir":
                        config.reportDir = value;
                        i++;
                        break;
                }
            }
        }

        // Validation
        if (config.users < 1 || config.users > 1000) {
            System.err.println("ERROR: users must be between 1 and 1000");
            return null;
        }

        if (config.concurrent < 1 || config.concurrent > config.users) {
            System.err.println("ERROR: concurrent must be between 1 and users count");
            return null;
        }

        if (config.rampTime < 1) {
            System.err.println("ERROR: ramp-time must be at least 1 second");
            return null;
        }

        if (config.duration < config.rampTime) {
            System.err.println("WARNING: duration is less than ramp-time, setting duration = ramp-time");
            config.duration = config.rampTime;
        }

        return config;
    }

    /**
     * Print usage information
     */
    private static void printUsage() {
        System.out.println("\nUsage: java -jar load-tester.jar [OPTIONS]");
        System.out.println("\nOptions:");
        System.out.println("  --endpoint, -e <URL>      Server endpoint (default: http://localhost:3000)");
        System.out.println("  --users, -u <N>           Target number of users (default: 60)");
        System.out.println("  --ramp-time, -r <SEC>     Ramp-up time in seconds (default: 30)");
        System.out.println("  --duration, -d <SEC>      Test duration in seconds (default: 60)");
        System.out.println("  --concurrent, -c <N>      Max concurrent threads (default: 30)");
        System.out.println("  --report-dir <DIR>        Directory for reports (default: current dir)");
        System.out.println("  --help, -h                Show this help message");
        System.out.println("\nExamples:");
        System.out.println("  # Basic test with defaults");
        System.out.println("  java -jar load-tester.jar");
        System.out.println("\n  # Custom configuration");
        System.out.println("  java -jar load-tester.jar --users 100 --ramp-time 60 --concurrent 50");
        System.out.println("\n  # Test remote server");
        System.out.println("  java -jar load-tester.jar --endpoint http://example.com:3000");
        System.out.println("\nTest Scenarios:");
        System.out.println("  - Python hello world & loops (40% of requests)");
        System.out.println("  - JavaScript console.log & loops (40% of requests)");
        System.out.println("  - Java programs with JVM startup (20% of requests)");
        System.out.println("\nPass Criteria:");
        System.out.println("  - Success rate: ≥95%");
        System.out.println("  - P95 latency: <10 seconds");
        System.out.println();
    }

    /**
     * Configuration class
     */
    private static class Config {
        String endpoint;
        int users;
        int rampTime;
        int duration;
        int concurrent;
        String reportDir;
    }
}
