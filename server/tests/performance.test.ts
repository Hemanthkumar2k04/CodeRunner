import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const SERVER_URL = 'http://localhost:3000'; // Make sure the server is running on this port
const RUN_ENDPOINT = `${SERVER_URL}/api/run`;

interface TestCases {
    [language: string]: {
        simple: string;
        complex: string;
    };
}

const testCases: TestCases = {
    python: {
        simple: `print("Simple Python Test")`,
        complex: `
def fibonacci(n):
    if n <= 1:
        return n
    else:
        return fibonacci(n-1) + fibonacci(n-2)

print("Fibonacci 30:", fibonacci(30))
`,
    },
    javascript: {
        simple: `console.log("Simple JS Test");`,
        complex: `
function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log("Fibonacci 35:", fibonacci(35));
`,
    },
    cpp: {
        simple: `
#include <iostream>

int main() {
    std::cout << "Simple C++ Test" << std::endl;
    return 0;
}
`,
        complex: `
#include <iostream>

long long fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
    std::cout << "Fibonacci 40: " << fibonacci(40) << std::endl;
    return 0;
}
`,
    },
    java: {
        simple: `
public class Main {
    public static void main(String[] args) {
        System.out.println("Simple Java Test");
    }
}
`,
        complex: `
public class Main {
    public static long fibonacci(int n) {
        if (n <= 1) return n;
        return fibonacci(n - 1) + fibonacci(n - 2);
    }

    public static void main(String[] args) {
        System.out.println("Fibonacci 40: " + fibonacci(40));
    }
}
`,
    },
    sql: {
        simple: `SELECT 'Simple SQL Test' AS output;`,
        complex: `
CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(50), department VARCHAR(50));
CREATE TABLE salaries (user_id INT, amount DECIMAL(10, 2));

INSERT INTO users (id, name, department) VALUES (1, 'Alice', 'Engineering'), (2, 'Bob', 'Sales'), (3, 'Charlie', 'Engineering'), (4, 'Dave', 'HR'), (5, 'Eve', 'Sales');
INSERT INTO salaries (user_id, amount) VALUES (1, 80000), (2, 60000), (3, 85000), (4, 50000), (5, 62000);

SELECT u.department, AVG(s.amount) AS avg_salary
FROM users u
JOIN salaries s ON u.id = s.user_id
GROUP BY u.department
ORDER BY avg_salary DESC;
`,
    },
};

const getFileName = (lang: string): string => {
    switch (lang) {
        case 'python': return 'main.py';
        case 'javascript': return 'main.js';
        case 'cpp': return 'main.cpp';
        case 'java': return 'Main.java';
        case 'sql': return 'script.sql';
        default: return 'main.txt';
    }
};

const runTest = async (language: string, type: 'simple' | 'complex', code: string): Promise<number> => {
    const fileName = getFileName(language);
    const startTime = Date.now();

    try {
        const response = await fetch(RUN_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                language,
                files: [
                    {
                        name: fileName,
                        path: fileName,
                        content: code,
                        toBeExec: true,
                    },
                ],
            }),
        });

        if (!response.ok) {
            console.error(`Request failed with status ${response.status}`);
            console.error(await response.text());
            return -1;
        }

        const data = await response.json() as any;
        const apiExecutionTime = data?.executionTime;

        return apiExecutionTime !== undefined ? apiExecutionTime : (Date.now() - startTime);
    } catch (error) {
        console.error(`Error running ${language} ${type} test:`, error);
        return -1;
    }
};

const gatherHardwareInfo = (): string => {
    try {
        const os = require('os');
        const cpus = os.cpus();
        const cpuModel = cpus[0].model;
        const cpuCores = cpus.length;

        const totalMemGb = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1);
        const freeMemGb = (os.freemem() / (1024 * 1024 * 1024)).toFixed(1);

        return `
Hardware - 1:
CPU - ${cpuCores} cores (${cpuModel})
RAM - ${freeMemGb} GB usable / ${totalMemGb} GB total
`;
    } catch (e) {
        console.error("Failed to gather hardware info via os module, trying bash...");
        try {
            const lscpu = execSync("lscpu | grep 'Model name\\|^CPU(s):'").toString().trim();
            const free = execSync("free -h | awk '/^Mem:/ {print $7 \" usable / \" $2 \" total\"}'").toString().trim();
            return `
Hardware - 1:
${lscpu}
RAM - ${free}
`;
        } catch (e2) {
            return "Hardware information unavailable.";
        }
    }
}

const generateDocs = async () => {
    console.log("Gathering hardware specs...");
    const hardwareInfo = gatherHardwareInfo();
    console.log(hardwareInfo);

    console.log("Running performance tests...");

    const results: { [lang: string]: { simple: number, complex: number } } = {};

    for (const [language, tests] of Object.entries(testCases)) {
        console.log(`Testing ${language}...`);

        // Warmup Request (optional, to avoid first-time start delays Docker might have)
        await runTest(language, 'simple', tests.simple);
        console.log(`  Warmup done.`);

        const simpleTime = await runTest(language, 'simple', tests.simple);
        console.log(`  Simple ${language}: ${simpleTime}ms`);

        const complexTime = await runTest(language, 'complex', tests.complex);
        console.log(`  Complex ${language}: ${complexTime}ms`);

        results[language] = { simple: simpleTime, complex: complexTime };
    }

    console.log("Generating markdown...");

    let markdown = `# Performance Metrics\n\n`;
    markdown += `## Hardware Specifications\n${hardwareInfo.trim()}\n\n`;
    markdown += `## Execution Times\n\n`;
    markdown += `| Language | Simple Execution | Complex Execution |\n`;
    markdown += `| :--- | :--- | :--- |\n`;

    for (const [lang, times] of Object.entries(results)) {
        markdown += `| ${lang} | ${times.simple} ms | ${times.complex} ms |\n`;
    }

    const docsDir = path.resolve(__dirname, '../../docs');
    if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
    }

    const docPath = path.join(docsDir, 'performance.md');
    fs.writeFileSync(docPath, markdown);

    console.log(`\nPerformance metrics written to ${docPath}`);
};

generateDocs().catch(console.error);
