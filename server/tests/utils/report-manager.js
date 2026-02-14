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
 * Calculate summary metrics from results
 * @param {Object} results - Test results
 * @returns {Object} Summary metrics
 */
function calculateSummary(results) {
    const allRequests = [];
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    
    // Aggregate across all languages
    Object.values(results).forEach(langResults => {
        if (langResults.simple) {
            const simpleTotal = (langResults.simple.requests || 0) + (langResults.simple.errors || 0) + (langResults.simple.timeouts || 0);
            totalRequests += simpleTotal;
            successfulRequests += langResults.simple.requests || 0;
            failedRequests += (langResults.simple.errors || 0) + (langResults.simple.timeouts || 0);
            
            if (langResults.simple.latency) {
                allRequests.push(langResults.simple.latency.mean || 0);
            }
        }
        
        if (langResults.complex) {
            const complexTotal = (langResults.complex.requests || 0) + (langResults.complex.errors || 0) + (langResults.complex.timeouts || 0);
            totalRequests += complexTotal;
            successfulRequests += langResults.complex.requests || 0;
            failedRequests += (langResults.complex.errors || 0) + (langResults.complex.timeouts || 0);
            
            if (langResults.complex.latency) {
                allRequests.push(langResults.complex.latency.mean || 0);
            }
        }
    });
    
    const avgResponseTime = allRequests.length > 0
        ? Math.round(allRequests.reduce((a, b) => a + b, 0) / allRequests.length)
        : 0;
    
    const successRate = totalRequests > 0
        ? ((successfulRequests / totalRequests) * 100).toFixed(2)
        : '0.00';
    
    return {
        totalRequests,
        successfulRequests,
        failedRequests,
        successRate: parseFloat(successRate),
        avgResponseTime
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
