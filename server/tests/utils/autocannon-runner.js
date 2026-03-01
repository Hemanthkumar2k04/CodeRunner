/**
 * Autocannon Runner
 * Executes HTTP load tests using autocannon
 */

const autocannon = require('autocannon');

const INTENSITY_PRESETS = {
    light: {
        connections: 10,
        duration: 30,
        pipelining: 1
    },
    moderate: {
        connections: 50,
        duration: 60,
        pipelining: 1
    },
    heavy: {
        connections: 100,
        duration: 90,
        pipelining: 1
    }
};

/**
 * Language-specific timeout configurations (in seconds)
 * Accounts for compilation time, container startup, and execution
 */
const LANGUAGE_TIMEOUTS = {
    python: 30000,      // Fast: interpreted, quick container startup (30s)
    javascript: 30000,  // Fast: interpreted, quick container startup (30s)
    java: 45000,        // Medium: JVM startup overhead (45s)
    cpp: 60000,         // Slow: compilation required (g++ takes time) (60s)
    sql: 60000          // Slow: PostgreSQL container initialization + query execution (60s)
};

/**
 * Build request body for code execution
 * @param {Object} program - Program object with content and metadata
 * @returns {Object} Request body for /api/run endpoint
 */
function buildRequestBody(program) {
    const { language, content, name } = program;
    
    return {
        language,
        files: [
            {
                name: name,
                path: name,
                content: content,
                toBeExec: true
            }
        ]
    };
}

/**
 * Run autocannon test for a single program
 * @param {Object} program - Program to test
 * @param {Object} intensity - Intensity configuration
 * @param {string} serverUrl - Server URL
 * @returns {Promise<Object>} Test results
 */
async function runSingleTest(program, intensity, serverUrl = 'http://localhost:3000') {
    const body = buildRequestBody(program);
    
    // Use language-specific timeout (in ms), fallback to 30s if not defined
    const timeout = LANGUAGE_TIMEOUTS[program.language] || 30000;
    
    return new Promise((resolve, reject) => {
        const instance = autocannon({
            url: `${serverUrl}/api/run`,
            connections: intensity.connections,
            duration: intensity.duration,
            pipelining: intensity.pipelining,
            timeout: timeout,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Load-Test': 'true'
            },
            body: JSON.stringify(body)
        }, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(processResults(result, program));
            }
        });
        
        // Optional: Track progress
        instance.on('response', (client, statusCode) => {
            // Could emit progress events here
        });
    });
}

/**
 * Process autocannon results into our format
 * @param {Object} result - Autocannon result object
 * @param {Object} program - Program that was tested
 * @returns {Object} Processed results
 */
function processResults(result, program) {
    const latency = result.latency;
    const requests = result.requests;
    const throughput = result.throughput;
    
    // non2xx includes rate-limited (429), server errors, etc.
    const non2xx = result.non2xx || 0;
    const successful2xx = Math.max(0, requests.total - non2xx);
    const totalAttempts = requests.total + result.errors + result.timeouts;
    
    return {
        program: {
            name: program.name,
            complexity: program.complexity,
            category: program.category
        },
        duration: result.duration,
        requests: requests.total,
        errors: result.errors + non2xx,
        timeouts: result.timeouts,
        non2xx,
        successRate: totalAttempts > 0
            ? ((successful2xx / totalAttempts) * 100).toFixed(2)
            : '0.00',
        latency: {
            mean: latency.mean,
            min: latency.min,
            max: latency.max,
            p50: latency.p50,
            p75: latency.p75,
            p90: latency.p90,
            p95: latency.p95,
            p99: latency.p99
        },
        throughput: {
            mean: throughput.mean,
            total: throughput.total
        },
        requestsPerSecond: (requests.total / result.duration).toFixed(2)
    };
}

/**
 * Run load test for all selected programs
 * @param {Object} programs - Selected programs (from program-selector)
 * @param {string} intensityLevel - 'light', 'moderate', or 'heavy'
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Complete test results
 */
async function runLoadTest(programs, intensityLevel = 'moderate', onProgress = null) {
    const intensity = INTENSITY_PRESETS[intensityLevel];
    
    if (!intensity) {
        throw new Error(`Unknown intensity level: ${intensityLevel}`);
    }
    
    const results = {};
    const languages = Object.keys(programs);
    let completed = 0;
    const total = languages.length * 2; // Simple + complex for each language
    
    for (const language of languages) {
        console.log(`\nTesting ${language}...`);
        results[language] = {};
        
        const langPrograms = programs[language];
        
        // Test simple program
        if (langPrograms.simple) {
            if (onProgress) {
                onProgress({
                    language,
                    type: 'simple',
                    current: completed + 1,
                    total,
                    status: 'running'
                });
            }
            
            console.log(`  Running simple test: ${langPrograms.simple.name}`);
            try {
                results[language].simple = await runSingleTest(
                    langPrograms.simple,
                    intensity
                );
                console.log(`  ✓ Simple test completed`);
            } catch (error) {
                console.error(`  ✗ Simple test failed:`, error.message);
                results[language].simple = { error: error.message };
            }
            
            completed++;
        }
        
        // Test complex program
        if (langPrograms.complex) {
            if (onProgress) {
                onProgress({
                    language,
                    type: 'complex',
                    current: completed + 1,
                    total,
                    status: 'running'
                });
            }
            
            console.log(`  Running complex test: ${langPrograms.complex.name}`);
            try {
                results[language].complex = await runSingleTest(
                    langPrograms.complex,
                    intensity
                );
                console.log(`  ✓ Complex test completed`);
            } catch (error) {
                console.error(`  ✗ Complex test failed:`, error.message);
                results[language].complex = { error: error.message };
            }
            
            completed++;
        }
    }
    
    if (onProgress) {
        onProgress({
            current: total,
            total,
            status: 'complete'
        });
    }
    
    return results;
}

module.exports = {
    runLoadTest,
    runSingleTest,
    INTENSITY_PRESETS
};
