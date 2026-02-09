package com.coderunner.loadtest;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import okhttp3.*;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

/**
 * HTTP client for CodeRunner API with connection pooling
 */
public class ApiClient {
    private final OkHttpClient client;
    private final String baseUrl;
    private final Gson gson;

    public ApiClient(String baseUrl) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.gson = new Gson();

        // Configure OkHttp with connection pooling and timeouts
        this.client = new OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .connectionPool(new ConnectionPool(
                        100, // maxIdleConnections
                        5, // keepAliveDuration
                        TimeUnit.MINUTES))
                .retryOnConnectionFailure(true)
                .build();
    }

    /**
     * Execute code via /api/run endpoint
     */
    public ExecutionResult executeCode(TestScenario scenario) throws IOException {
        long startTime = System.currentTimeMillis();

        // Build request body
        JsonObject requestBody = new JsonObject();
        requestBody.addProperty("language", scenario.getLanguage());
        requestBody.add("files", scenario.getFiles());

        RequestBody body = RequestBody.create(
                gson.toJson(requestBody),
                MediaType.get("application/json; charset=utf-8"));

        Request request = new Request.Builder()
                .url(baseUrl + "/api/run")
                .post(body)
                .build();

        try (Response response = client.newCall(request).execute()) {
            long responseTime = System.currentTimeMillis() - startTime;

            String responseBody = response.body() != null ? response.body().string() : "{}";
            JsonObject jsonResponse = gson.fromJson(responseBody, JsonObject.class);

            boolean success = response.isSuccessful();
            int statusCode = response.code();

            String error = null;
            if (!success && jsonResponse.has("error")) {
                error = jsonResponse.get("error").getAsString();
            }

            long executionTime = jsonResponse.has("executionTime")
                    ? jsonResponse.get("executionTime").getAsLong()
                    : 0;

            String stdout = jsonResponse.has("stdout")
                    ? jsonResponse.get("stdout").getAsString()
                    : "";

            String stderr = jsonResponse.has("stderr")
                    ? jsonResponse.get("stderr").getAsString()
                    : "";

            int exitCode = jsonResponse.has("exitCode")
                    ? jsonResponse.get("exitCode").getAsInt()
                    : -1;

            return new ExecutionResult(
                    success,
                    statusCode,
                    responseTime,
                    executionTime,
                    stdout,
                    stderr,
                    exitCode,
                    error,
                    scenario.getLanguage(),
                    scenario.getName());
        }
    }

    /**
     * Check server health
     */
    public boolean checkHealth() {
        Request request = new Request.Builder()
                .url(baseUrl + "/health")
                .get()
                .build();

        try (Response response = client.newCall(request).execute()) {
            return response.isSuccessful();
        } catch (IOException e) {
            return false;
        }
    }

    /**
     * Get queue statistics
     */
    public JsonObject getQueueStats() throws IOException {
        Request request = new Request.Builder()
                .url(baseUrl + "/api/queue-stats")
                .get()
                .build();

        try (Response response = client.newCall(request).execute()) {
            if (response.isSuccessful() && response.body() != null) {
                String responseBody = response.body().string();
                return gson.fromJson(responseBody, JsonObject.class);
            }
            return new JsonObject();
        }
    }

    /**
     * Shutdown the client and release resources
     */
    public void shutdown() {
        client.dispatcher().executorService().shutdown();
        client.connectionPool().evictAll();
    }

    /**
     * Execution result data class
     */
    public static class ExecutionResult {
        private final boolean success;
        private final int statusCode;
        private final long responseTime; // Total HTTP response time
        private final long executionTime; // Server-side execution time
        private final String stdout;
        private final String stderr;
        private final int exitCode;
        private final String error;
        private final String language;
        private final String scenarioName;

        public ExecutionResult(boolean success, int statusCode, long responseTime,
                long executionTime, String stdout, String stderr,
                int exitCode, String error, String language, String scenarioName) {
            this.success = success;
            this.statusCode = statusCode;
            this.responseTime = responseTime;
            this.executionTime = executionTime;
            this.stdout = stdout;
            this.stderr = stderr;
            this.exitCode = exitCode;
            this.error = error;
            this.language = language;
            this.scenarioName = scenarioName;
        }

        public boolean isSuccess() {
            return success;
        }

        public int getStatusCode() {
            return statusCode;
        }

        public long getResponseTime() {
            return responseTime;
        }

        public long getExecutionTime() {
            return executionTime;
        }

        public String getStdout() {
            return stdout;
        }

        public String getStderr() {
            return stderr;
        }

        public int getExitCode() {
            return exitCode;
        }

        public String getError() {
            return error;
        }

        public String getLanguage() {
            return language;
        }

        public String getScenarioName() {
            return scenarioName;
        }

        @Override
        public String toString() {
            return "ExecutionResult{" +
                    "success=" + success +
                    ", statusCode=" + statusCode +
                    ", responseTime=" + responseTime + "ms" +
                    ", executionTime=" + executionTime + "ms" +
                    ", language='" + language + '\'' +
                    ", scenario='" + scenarioName + '\'' +
                    (error != null ? ", error='" + error + '\'' : "") +
                    '}';
        }
    }
}
