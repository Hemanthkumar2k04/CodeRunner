/**
 * Report Manager Utility
 * Manages test report storage and retrieval
 */

const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '../reports');
const MANIFEST_FILE = path.join(REPORTS_DIR, 'manifest.json');

/**
 * Ensure reports directory exists
 */
function ensureReportsDir() {
    if (!fs.existsSync(REPORTS_DIR)) {
        fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }
}

/**
 * Read the manifest file
 * @returns {Array} Array of report metadata
 */
function readManifest() {
    ensureReportsDir();
    
    if (!fs.existsSync(MANIFEST_FILE)) {
        return [];
    }
    
    try {
        const content = fs.readFileSync(MANIFEST_FILE, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error('Error reading manifest:', error);
        return [];
    }
}

/**
 * Write the manifest file
 * @param {Array} manifest - Array of report metadata
 */
function writeManifest(manifest) {
    ensureReportsDir();
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
}

/**
 * Generate a report ID based on timestamp
 * @returns {string} Report ID in format "loadtest-YYYYMMDD-HHMMSS"
 */
function generateReportId() {
    const now = new Date();
    const dateStr = now.toISOString().replace(/[-:]/g, '').replace('T', '-').split('.')[0];
    return `loadtest-${dateStr}`;
}

/**
 * Save a test report
 * @param {Object} results - Test results object
 * @param {string} intensity - Test intensity level
 * @returns {string} Report ID
 */
function saveReport(results, intensity = 'moderate') {
    ensureReportsDir();
    
    const reportId = generateReportId();
    const reportFile = path.join(REPORTS_DIR, `${reportId}.json`);
    
    // Calculate summary metrics
    const summary = calculateSummary(results);
    
    // Save full report
    const report = {
        id: reportId,
        timestamp: Date.now(),
        intensity,
        results,
        summary
    };
    
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    // Update manifest
    const manifest = readManifest();
    manifest.push({
        id: reportId,
        timestamp: report.timestamp,
        date: new Date(report.timestamp).toISOString(),
        intensity,
        status: 'completed',
        metrics: summary
    });
    
    // Keep only last 50 reports in manifest
    if (manifest.length > 50) {
        const removed = manifest.shift();
        // Optionally delete old report file
        const oldFile = path.join(REPORTS_DIR, `${removed.id}.json`);
        if (fs.existsSync(oldFile)) {
            fs.unlinkSync(oldFile);
        }
    }
    
    writeManifest(manifest);
    
    return reportId;
}

/**
 * Summarize a single test result (simple or complex)
 * @param {Object} test - Single test result
 * @returns {Object} Condensed test summary
 */
function summarizeTest(test) {
    if (!test || test.error) {
        return { error: test?.error || 'Unknown error' };
    }
    return {
        requests: test.requests || 0,
        errors: test.errors || 0,
        timeouts: test.timeouts || 0,
        successRate: parseFloat(test.successRate || '0'),
        requestsPerSecond: parseFloat(test.requestsPerSecond || '0'),
        latency: test.latency ? {
            mean: Math.round(test.latency.mean || 0),
            p50: Math.round(test.latency.p50 || 0),
            p90: Math.round(test.latency.p90 || 0),
            p95: Math.round(test.latency.p95 || 0),
            p99: Math.round(test.latency.p99 || 0),
        } : null,
        throughputMBps: test.throughput ? parseFloat((test.throughput.mean / 1024 / 1024).toFixed(3)) : 0,
        program: test.program?.name || null,
    };
}

/**
 * Calculate summary metrics from results
 * @param {Object} results - Test results
 * @returns {Object} Summary metrics
 */
function calculateSummary(results) {
    const latencyMeans = [];
    const latencyP50s = [];
    const latencyP95s = [];
    const latencyP99s = [];
    const reqsPerSec = [];
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    let totalErrors = 0;
    let totalTimeouts = 0;
    let totalThroughput = 0;
    
    const perLanguage = {};

    // Aggregate across all languages
    Object.entries(results).forEach(([language, langResults]) => {
        perLanguage[language] = {
            simple: summarizeTest(langResults.simple),
            complex: summarizeTest(langResults.complex),
        };

        [langResults.simple, langResults.complex].forEach(test => {
            if (!test || test.error) return;
            
            const testTotal = (test.requests || 0) + (test.errors || 0) + (test.timeouts || 0);
            totalRequests += testTotal;
            successfulRequests += test.requests || 0;
            totalErrors += test.errors || 0;
            totalTimeouts += test.timeouts || 0;
            failedRequests += (test.errors || 0) + (test.timeouts || 0);
            
            if (test.latency) {
                latencyMeans.push(test.latency.mean || 0);
                latencyP50s.push(test.latency.p50 || 0);
                latencyP95s.push(test.latency.p95 || 0);
                latencyP99s.push(test.latency.p99 || 0);
            }
            
            if (test.requestsPerSecond) {
                reqsPerSec.push(parseFloat(test.requestsPerSecond));
            }
            
            if (test.throughput) {
                totalThroughput += test.throughput.total || 0;
            }
        });
    });
    
    const avg = (arr) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    
    const successRate = totalRequests > 0
        ? ((successfulRequests / totalRequests) * 100).toFixed(2)
        : '0.00';
    
    return {
        totalRequests,
        successfulRequests,
        failedRequests,
        totalErrors,
        totalTimeouts,
        successRate: parseFloat(successRate),
        avgResponseTime: avg(latencyMeans),
        latency: {
            mean: avg(latencyMeans),
            p50: avg(latencyP50s),
            p95: avg(latencyP95s),
            p99: avg(latencyP99s),
        },
        avgRequestsPerSecond: reqsPerSec.length > 0
            ? parseFloat((reqsPerSec.reduce((a, b) => a + b, 0) / reqsPerSec.length).toFixed(2))
            : 0,
        totalThroughputMB: parseFloat((totalThroughput / 1024 / 1024).toFixed(2)),
        languageCount: Object.keys(results).length,
        testCount: latencyMeans.length,
        perLanguage,
    };
}

/**
 * Get all reports metadata
 * @returns {Array} Array of report metadata
 */
function getReports() {
    return readManifest();
}

/**
 * Get a specific report by ID
 * @param {string} reportId - Report ID
 * @returns {Object|null} Report object or null if not found
 */
function getReport(reportId) {
    const reportFile = path.join(REPORTS_DIR, `${reportId}.json`);
    
    if (!fs.existsSync(reportFile)) {
        return null;
    }
    
    try {
        const content = fs.readFileSync(reportFile, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error('Error reading report:', error);
        return null;
    }
}

/**
 * Delete a report
 * @param {string} reportId - Report ID
 * @returns {boolean} True if deleted successfully
 */
function deleteReport(reportId) {
    const reportFile = path.join(REPORTS_DIR, `${reportId}.json`);
    
    // Remove from manifest
    const manifest = readManifest();
    const index = manifest.findIndex(r => r.id === reportId);
    
    if (index !== -1) {
        manifest.splice(index, 1);
        writeManifest(manifest);
    }
    
    // Delete file
    if (fs.existsSync(reportFile)) {
        fs.unlinkSync(reportFile);
        return true;
    }
    
    return false;
}

module.exports = {
    saveReport,
    getReports,
    getReport,
    deleteReport,
    generateReportId
};
