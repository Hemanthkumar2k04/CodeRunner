/**
 * Test Runner Service
 * Provides API for triggering and monitoring load tests
 */

import { spawn } from 'child_process';
import path from 'path';
import { EventEmitter } from 'events';
import { logger } from './logger';

const testRunners = new Map<string, TestRunner>();

interface TestProgress {
    language?: string;
    type?: string;
    current: number;
    total: number;
    status: 'running' | 'complete' | 'error';
    message?: string;
}

class TestRunner extends EventEmitter {
    public readonly id: string;
    public readonly intensity: string;
    public readonly languages?: string[];
    public startTime: number;
    public endTime?: number;
    public status: 'running' | 'completed' | 'failed';
    public reportId?: string;
    private process?: any;

    constructor(id: string, intensity: string, languages?: string[]) {
        super();
        this.id = id;
        this.intensity = intensity;
        this.languages = languages;
        this.startTime = Date.now();
        this.status = 'running';
    }

    async run(): Promise<void> {
        const scriptPath = path.join(__dirname, '../tests/run-tests.js');

        const args = [scriptPath, this.intensity];
        if (this.languages && this.languages.length > 0) {
            args.push(`--languages=${this.languages.join(',')}`);
        }

        this.process = spawn('node', args, {
            cwd: path.join(__dirname, '../..'),
            env: process.env
        });

        let output = '';
        let errorOutput = '';

        this.process.stdout.on('data', (data: Buffer) => {
            const text = data.toString();
            output += text;

            // Parse progress from output
            this.parseProgress(text);
        });

        this.process.stderr.on('data', (data: Buffer) => {
            errorOutput += data.toString();
        });

        return new Promise((resolve, reject) => {
            this.process.on('close', (code: number) => {
                this.endTime = Date.now();

                if (code === 0) {
                    this.status = 'completed';

                    // Extract report ID from output
                    const reportMatch = output.match(/Report ID: (loadtest-\d+-\d+)/);
                    if (reportMatch) {
                        this.reportId = reportMatch[1];
                    }

                    this.emit('complete', {
                        reportId: this.reportId,
                        duration: this.endTime - this.startTime
                    });

                    resolve();
                } else {
                    this.status = 'failed';

                    this.emit('error', {
                        code,
                        message: errorOutput || 'Test failed'
                    });

                    reject(new Error(`Test failed with code ${code}`));
                }
            });

            this.process.on('error', (error: Error) => {
                this.endTime = Date.now();
                this.status = 'failed';

                this.emit('error', {
                    message: error.message
                });

                reject(error);
            });
        });
    }

    private parseProgress(text: string) {
        // Parse progress messages from test output
        const progressMatch = text.match(/Progress: (\d+)\/(\d+) tests completed/);
        if (progressMatch) {
            const current = parseInt(progressMatch[1]);
            const total = parseInt(progressMatch[2]);

            this.emit('progress', {
                current,
                total,
                status: 'running'
            });
        }

        // Parse language being tested
        const languageMatch = text.match(/Testing (\w+)\.\.\./);
        if (languageMatch) {
            this.emit('progress', {
                language: languageMatch[1],
                status: 'running'
            });
        }
    }

    stop() {
        if (this.process) {
            this.process.kill();
            this.status = 'failed';
            this.emit('stopped');
        }
    }
}

/**
 * Start a new load test
 */
export async function startLoadTest(
    intensity: string = 'moderate',
    languages?: string[],
    socketId?: string
): Promise<string> {
    // Validate intensity
    if (!['light', 'moderate', 'heavy'].includes(intensity)) {
        throw new Error(`Invalid intensity: ${intensity}`);
    }

    // Validate languages
    const validLanguages = ['python', 'javascript', 'java', 'cpp'];
    if (languages && languages.length > 0) {
        const invalidLangs = languages.filter(lang => !validLanguages.includes(lang));
        if (invalidLangs.length > 0) {
            throw new Error(`Invalid languages: ${invalidLangs.join(', ')}`);
        }
    }

    // Generate test ID
    const testId = `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create test runner
    const runner = new TestRunner(testId, intensity, languages);
    testRunners.set(testId, runner);

    // Start test asynchronously
    runner.run().catch(error => {
        logger.error('TestRunner', `Test ${testId} failed: ${error}`);
    }).finally(() => {
        // Clean up after a while
        setTimeout(() => {
            testRunners.delete(testId);
        }, 300000); // 5 minutes
    });

    return testId;
}

/**
 * Get test runner by ID
 */
export function getTestRunner(testId: string): TestRunner | undefined {
    return testRunners.get(testId);
}

/**
 * Stop a running test
 */
export function stopTest(testId: string): boolean {
    const runner = testRunners.get(testId);
    if (runner && runner.status === 'running') {
        runner.stop();
        return true;
    }
    return false;
}

/**
 * Get all active tests
 */
export function getActiveTests() {
    return Array.from(testRunners.values()).map(runner => ({
        id: runner.id,
        intensity: runner.intensity,
        status: runner.status,
        startTime: runner.startTime,
        duration: runner.endTime
            ? runner.endTime - runner.startTime
            : Date.now() - runner.startTime
    }));
}
