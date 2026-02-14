#!/usr/bin/env node

/**
 * Load Test Orchestrator
 * Main script to run performance load tests
 */

const { selectPrograms } = require('./utils/program-selector');
const { runLoadTest } = require('./utils/autocannon-runner');
const { saveReport } = require('./utils/report-manager');

// Parse command line arguments
const args = process.argv.slice(2);
const intensityArg = args.find(arg => ['light', 'moderate', 'heavy'].includes(arg));
const intensity = intensityArg || 'moderate';

const serverArg = args.find(arg => arg.startsWith('--server='));
const serverUrl = serverArg ? serverArg.split('=')[1] : 'http://localhost:3000';

/**
 * Main execution function
 */
async function main() {
    console.log('='.repeat(60));
    console.log('       CodeRunner Performance Load Test');
    console.log('='.repeat(60));
    console.log(`\nConfiguration:`);
    console.log(`  Intensity: ${intensity}`);
    console.log(`  Server: ${serverUrl}`);
    console.log(`  Strategy: stratified (simple + complex per language)`);
    console.log('\n' + '-'.repeat(60));
    
    // Step 1: Select programs
    console.log('\nStep 1: Selecting test programs...');
    const programs = selectPrograms('stratified');
    
    const languages = Object.keys(programs);
    console.log(`Selected programs for ${languages.length} languages:`);
    languages.forEach(lang => {
        const p = programs[lang];
        console.log(`  ${lang}:`);
        console.log(`    Simple: ${p.simple.name}`);
        console.log(`    Complex: ${p.complex.name}`);
    });
    
    console.log('\n' + '-'.repeat(60));
    
    // Step 2: Run load tests
    console.log('\nStep 2: Running load tests...');
    const startTime = Date.now();
    
    const results = await runLoadTest(programs, intensity, (progress) => {
        if (progress.status === 'running') {
            process.stdout.write(`\r  Progress: ${progress.current}/${progress.total} tests completed`);
        }
    });
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\n\nAll tests completed in ${duration}s`);
    console.log('\n' + '-'.repeat(60));
    
    // Step 3: Save report
    console.log('\nStep 3: Saving report...');
    const reportId = saveReport(results, intensity);
    console.log(`Report saved: ${reportId}`);
    
    // Step 4: Display summary
    console.log('\n' + '='.repeat(60));
    console.log('                    SUMMARY');
    console.log('='.repeat(60));
    
    displaySummary(results);
    
    console.log('\n' + '='.repeat(60));
    console.log(`Report ID: ${reportId}`);
    console.log(`View detailed results: server/tests/reports/${reportId}.json`);
    console.log('='.repeat(60));
    console.log('\n✓ Load test completed successfully!\n');
}

/**
 * Display summary of test results
 * @param {Object} results - Test results
 */
function displaySummary(results) {
    let totalRequests = 0;
    let totalErrors = 0;
    let totalDuration = 0;
    let count = 0;
    
    const latencies = [];
    
    console.log('\nResults by Language:');
    console.log('-'.repeat(60));
    
    Object.entries(results).forEach(([language, langResults]) => {
        console.log(`\n${language.toUpperCase()}:`);
        
        if (langResults.simple) {
            const s = langResults.simple;
            console.log(`  Simple (${s.program?.name || 'N/A'}):`);
            console.log(`    Requests: ${s.requests || 0}`);
            console.log(`    Success Rate: ${s.successRate || 0}%`);
            console.log(`    Avg Latency: ${Math.round(s.latency?.mean || 0)}ms`);
            console.log(`    P95 Latency: ${Math.round(s.latency?.p95 || 0)}ms`);
            console.log(`    Requests/sec: ${s.requestsPerSecond || 0}`);
            
            totalRequests += s.requests || 0;
            totalErrors += s.errors || 0;
            totalDuration += s.duration || 0;
            if (s.latency) latencies.push(s.latency.mean);
            count++;
        }
        
        if (langResults.complex) {
            const c = langResults.complex;
            console.log(`  Complex (${c.program?.name || 'N/A'}):`);
            console.log(`    Requests: ${c.requests || 0}`);
            console.log(`    Success Rate: ${c.successRate || 0}%`);
            console.log(`    Avg Latency: ${Math.round(c.latency?.mean || 0)}ms`);
            console.log(`    P95 Latency: ${Math.round(c.latency?.p95 || 0)}ms`);
            console.log(`    Requests/sec: ${c.requestsPerSecond || 0}`);
            
            totalRequests += c.requests || 0;
            totalErrors += c.errors || 0;
            totalDuration += c.duration || 0;
            if (c.latency) latencies.push(c.latency.mean);
            count++;
        }
    });
    
    const overallSuccessRate = totalRequests > 0
        ? (((totalRequests - totalErrors) / totalRequests) * 100).toFixed(2)
        : '0.00';
    
    const avgLatency = latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0;
    
    console.log('\n' + '-'.repeat(60));
    console.log('OVERALL STATISTICS:');
    console.log(`  Total Requests: ${totalRequests}`);
    console.log(`  Total Errors: ${totalErrors}`);
    console.log(`  Success Rate: ${overallSuccessRate}%`);
    console.log(`  Average Latency: ${avgLatency}ms`);
    console.log(`  Tests Run: ${count}`);
}

// Run the main function
main().catch(error => {
    console.error('\n✗ Error running load test:', error);
    process.exit(1);
});
