#!/usr/bin/env python3
"""
CodeRunner Load Test Suite

Simulates 20 concurrent students running various programs across different languages.
Monitors resource usage and generates comprehensive reports.

Usage:
    python load_test.py [--students N] [--server URL] [--output DIR]
"""

import argparse
import asyncio
import json
import os
import subprocess
import sys
import time
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional
from concurrent.futures import ThreadPoolExecutor

try:
    import socketio
except ImportError:
    print("ERROR: python-socketio[asyncio_client] is required.")
    print("Install with: pip install 'python-socketio[asyncio_client]' aiohttp")
    sys.exit(1)


# =============================================================================
# Test Code Samples
# =============================================================================

TEST_PROGRAMS = {
    "python": [
        {
            "name": "hello_world",
            "files": [
                {
                    "name": "main.py",
                    "path": "main.py",
                    "content": "print('Hello, World!')",
                    "toBeExec": True,
                }
            ],
            "expected_output": "Hello, World!",
            "category": "quick",
        },
        {
            "name": "fibonacci",
            "files": [
                {
                    "name": "main.py",
                    "path": "main.py",
                    "content": """
def fib(n):
    if n <= 1:
        return n
    return fib(n-1) + fib(n-2)

for i in range(20):
    print(f"fib({i}) = {fib(i)}")
""".strip(),
                    "toBeExec": True,
                }
            ],
            "category": "cpu_intensive",
        },
        {
            "name": "list_operations",
            "files": [
                {
                    "name": "main.py",
                    "path": "main.py",
                    "content": """
import random
data = [random.randint(1, 1000) for _ in range(10000)]
sorted_data = sorted(data)
print(f"Min: {min(data)}, Max: {max(data)}, Median: {sorted_data[len(data)//2]}")
""".strip(),
                    "toBeExec": True,
                }
            ],
            "category": "memory",
        },
        {
            "name": "loop_counter",
            "files": [
                {
                    "name": "main.py",
                    "path": "main.py",
                    "content": """
total = 0
for i in range(100000):
    total += i
print(f"Sum of 0-99999: {total}")
""".strip(),
                    "toBeExec": True,
                }
            ],
            "category": "cpu_intensive",
        },
    ],
    "javascript": [
        {
            "name": "hello_world",
            "files": [
                {
                    "name": "main.js",
                    "path": "main.js",
                    "content": "console.log('Hello from JavaScript!');",
                    "toBeExec": True,
                }
            ],
            "expected_output": "Hello from JavaScript!",
            "category": "quick",
        },
        {
            "name": "array_operations",
            "files": [
                {
                    "name": "main.js",
                    "path": "main.js",
                    "content": """
const arr = Array.from({length: 10000}, () => Math.floor(Math.random() * 1000));
const sum = arr.reduce((a, b) => a + b, 0);
const avg = sum / arr.length;
console.log(`Sum: ${sum}, Average: ${avg.toFixed(2)}`);
""".strip(),
                    "toBeExec": True,
                }
            ],
            "category": "memory",
        },
        {
            "name": "prime_check",
            "files": [
                {
                    "name": "main.js",
                    "path": "main.js",
                    "content": """
function isPrime(n) {
    if (n < 2) return false;
    for (let i = 2; i <= Math.sqrt(n); i++) {
        if (n % i === 0) return false;
    }
    return true;
}

let count = 0;
for (let i = 2; i < 1000; i++) {
    if (isPrime(i)) count++;
}
console.log(`Found ${count} primes below 1000`);
""".strip(),
                    "toBeExec": True,
                }
            ],
            "category": "cpu_intensive",
        },
    ],
    "java": [
        {
            "name": "hello_world",
            "files": [
                {
                    "name": "Main.java",
                    "path": "Main.java",
                    "content": """
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java!");
    }
}
""".strip(),
                    "toBeExec": True,
                }
            ],
            "expected_output": "Hello from Java!",
            "category": "quick",
        },
        {
            "name": "factorial",
            "files": [
                {
                    "name": "Main.java",
                    "path": "Main.java",
                    "content": """
public class Main {
    public static long factorial(int n) {
        if (n <= 1) return 1;
        return n * factorial(n - 1);
    }
    
    public static void main(String[] args) {
        for (int i = 0; i <= 15; i++) {
            System.out.println(i + "! = " + factorial(i));
        }
    }
}
""".strip(),
                    "toBeExec": True,
                }
            ],
            "category": "cpu_intensive",
        },
        {
            "name": "arraylist_sort",
            "files": [
                {
                    "name": "Main.java",
                    "path": "Main.java",
                    "content": """
import java.util.*;

public class Main {
    public static void main(String[] args) {
        ArrayList<Integer> list = new ArrayList<>();
        Random rand = new Random();
        for (int i = 0; i < 5000; i++) {
            list.add(rand.nextInt(10000));
        }
        Collections.sort(list);
        System.out.println("Sorted " + list.size() + " elements");
        System.out.println("Min: " + list.get(0) + ", Max: " + list.get(list.size()-1));
    }
}
""".strip(),
                    "toBeExec": True,
                }
            ],
            "category": "memory",
        },
    ],
    "cpp": [
        {
            "name": "hello_world",
            "files": [
                {
                    "name": "main.cpp",
                    "path": "main.cpp",
                    "content": """
#include <iostream>
using namespace std;

int main() {
    cout << "Hello from C++!" << endl;
    return 0;
}
""".strip(),
                    "toBeExec": True,
                }
            ],
            "expected_output": "Hello from C++!",
            "category": "quick",
        },
        {
            "name": "vector_sort",
            "files": [
                {
                    "name": "main.cpp",
                    "path": "main.cpp",
                    "content": """
#include <iostream>
#include <vector>
#include <algorithm>
#include <cstdlib>
using namespace std;

int main() {
    vector<int> v;
    for (int i = 0; i < 10000; i++) {
        v.push_back(rand() % 10000);
    }
    sort(v.begin(), v.end());
    cout << "Sorted " << v.size() << " elements" << endl;
    cout << "Min: " << v.front() << ", Max: " << v.back() << endl;
    return 0;
}
""".strip(),
                    "toBeExec": True,
                }
            ],
            "category": "memory",
        },
        {
            "name": "prime_sieve",
            "files": [
                {
                    "name": "main.cpp",
                    "path": "main.cpp",
                    "content": """
#include <iostream>
#include <vector>
using namespace std;

int main() {
    int n = 10000;
    vector<bool> sieve(n, true);
    sieve[0] = sieve[1] = false;
    
    for (int i = 2; i * i < n; i++) {
        if (sieve[i]) {
            for (int j = i * i; j < n; j += i) {
                sieve[j] = false;
            }
        }
    }
    
    int count = 0;
    for (int i = 0; i < n; i++) {
        if (sieve[i]) count++;
    }
    cout << "Found " << count << " primes below " << n << endl;
    return 0;
}
""".strip(),
                    "toBeExec": True,
                }
            ],
            "category": "cpu_intensive",
        },
    ],
}


# =============================================================================
# Data Classes
# =============================================================================


@dataclass
class ExecutionResult:
    """Result of a single code execution"""

    student_id: str
    session_id: str
    language: str
    program_name: str
    category: str
    success: bool
    start_time: float
    end_time: float
    execution_time_ms: float
    exit_code: Optional[int] = None
    stdout: str = ""
    stderr: str = ""
    error: Optional[str] = None


@dataclass
class StudentSession:
    """Represents a student session"""

    student_id: str
    session_id: str
    language: str
    program: dict
    results: list = field(default_factory=list)


@dataclass
class ResourceSnapshot:
    """Docker container resource usage snapshot"""

    timestamp: float
    container_count: int
    total_memory_mb: float = 0.0
    total_cpu_percent: float = 0.0
    containers: list = field(default_factory=list)


@dataclass
class LoadTestReport:
    """Complete load test report"""

    test_id: str
    start_time: str
    end_time: str
    duration_seconds: float
    server_url: str
    num_students: int
    mode: str
    ramp_interval: Optional[int] = None
    ramp_batch_size: Optional[int] = None
    total_executions: int = 0
    successful_executions: int = 0
    failed_executions: int = 0
    avg_execution_time_ms: float = 0.0
    min_execution_time_ms: float = 0.0
    max_execution_time_ms: float = 0.0
    executions_by_language: dict = field(default_factory=dict)
    executions_by_category: dict = field(default_factory=dict)
    resource_snapshots: list = field(default_factory=list)
    peak_containers: int = 0
    peak_memory_mb: float = 0.0
    execution_results: list = field(default_factory=list)


# =============================================================================
# Resource Monitor
# =============================================================================


class ResourceMonitor:
    """Monitor Docker container resources"""

    def __init__(self, interval: float = 2.0):
        self.interval = interval
        self.snapshots: list[ResourceSnapshot] = []
        self._running = False
        self._task: Optional[asyncio.Task] = None

    async def start(self):
        """Start monitoring"""
        self._running = True
        self._task = asyncio.create_task(self._monitor_loop())

    async def stop(self):
        """Stop monitoring"""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _monitor_loop(self):
        """Main monitoring loop"""
        while self._running:
            try:
                snapshot = await self._capture_snapshot()
                self.snapshots.append(snapshot)
            except Exception as e:
                print(f"  [Monitor] Error capturing snapshot: {e}")
            await asyncio.sleep(self.interval)

    async def _capture_snapshot(self) -> ResourceSnapshot:
        """Capture current resource state"""
        loop = asyncio.get_event_loop()

        # Run docker stats in executor to avoid blocking
        def get_docker_stats():
            try:
                result = subprocess.run(
                    [
                        "docker",
                        "stats",
                        "--no-stream",
                        "--format",
                        "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}",
                    ],
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                return result.stdout
            except Exception:
                return ""

        stdout = await loop.run_in_executor(None, get_docker_stats)

        containers = []
        total_memory = 0.0
        total_cpu = 0.0

        for line in stdout.strip().split("\n"):
            if not line or "coderunner" not in line.lower():
                continue
            try:
                parts = line.split("|")
                if len(parts) >= 3:
                    name = parts[0]
                    cpu = float(parts[1].replace("%", ""))
                    mem_str = parts[2].split("/")[0].strip()

                    # Parse memory (e.g., "50.5MiB" or "1.2GiB")
                    if "GiB" in mem_str:
                        mem = float(mem_str.replace("GiB", "")) * 1024
                    elif "MiB" in mem_str:
                        mem = float(mem_str.replace("MiB", ""))
                    elif "KiB" in mem_str:
                        mem = float(mem_str.replace("KiB", "")) / 1024
                    else:
                        mem = 0.0

                    containers.append({"name": name, "cpu": cpu, "memory_mb": mem})
                    total_memory += mem
                    total_cpu += cpu
            except (ValueError, IndexError):
                continue

        return ResourceSnapshot(
            timestamp=time.time(),
            container_count=len(containers),
            total_memory_mb=total_memory,
            total_cpu_percent=total_cpu,
            containers=containers,
        )


# =============================================================================
# Student Simulator
# =============================================================================


class StudentSimulator:
    """Simulates a single student running code"""

    def __init__(self, student_id: str, server_url: str):
        self.student_id = student_id
        self.server_url = server_url
        self.session_id = f"loadtest-{student_id}-{uuid.uuid4().hex[:8]}"
        self.sio: Optional[socketio.AsyncClient] = None
        self.results: list[ExecutionResult] = []
        self._output_buffer = ""
        self._execution_complete = asyncio.Event()
        self._current_result: Optional[ExecutionResult] = None

    async def connect(self) -> bool:
        """Connect to the CodeRunner server"""
        try:
            self.sio = socketio.AsyncClient()

            @self.sio.on("output")
            async def on_output(data):
                if self._current_result:
                    self._output_buffer += data.get("data", "")

            @self.sio.on("exit")
            async def on_exit(data):
                if self._current_result:
                    self._current_result.end_time = time.time()
                    self._current_result.execution_time_ms = data.get(
                        "executionTime", 0
                    )
                    self._current_result.exit_code = data.get("code", -1)
                    self._current_result.stdout = self._output_buffer
                    self._current_result.success = data.get("code", -1) == 0
                self._execution_complete.set()

            @self.sio.on("execution-complete")
            async def on_complete(data):
                if self._current_result:
                    self._current_result.end_time = time.time()
                    self._current_result.execution_time_ms = data.get(
                        "executionTime", 0
                    )
                    self._current_result.exit_code = data.get("exitCode", -1)
                    self._current_result.stdout = self._output_buffer
                    self._current_result.success = data.get("exitCode", -1) == 0
                self._execution_complete.set()

            @self.sio.on("error")
            async def on_error(data):
                if self._current_result:
                    self._current_result.error = str(data)
                    self._current_result.success = False
                self._execution_complete.set()

            await self.sio.connect(self.server_url)
            return True
        except Exception as e:
            print(f"  [{self.student_id}] Connection failed: {e}")
            return False

    async def disconnect(self):
        """Disconnect from server"""
        if self.sio and self.sio.connected:
            await self.sio.disconnect()

    async def run_program(
        self, language: str, program: dict, timeout: float = 30.0
    ) -> ExecutionResult:
        """Run a single program"""
        self._output_buffer = ""
        self._execution_complete.clear()

        result = ExecutionResult(
            student_id=self.student_id,
            session_id=self.session_id,
            language=language,
            program_name=program["name"],
            category=program.get("category", "unknown"),
            success=False,
            start_time=time.time(),
            end_time=0,
            execution_time_ms=0,
        )
        self._current_result = result

        try:
            # Emit run event
            await self.sio.emit(
                "run",
                {
                    "sessionId": self.session_id,
                    "language": language,
                    "files": program["files"],
                },
            )

            # Wait for completion or timeout
            try:
                await asyncio.wait_for(self._execution_complete.wait(), timeout=timeout)
            except asyncio.TimeoutError:
                result.error = "Execution timeout"
                result.end_time = time.time()
                result.execution_time_ms = (result.end_time - result.start_time) * 1000

        except Exception as e:
            result.error = str(e)
            result.end_time = time.time()
            result.execution_time_ms = (result.end_time - result.start_time) * 1000

        self.results.append(result)
        return result


# =============================================================================
# Load Test Runner
# =============================================================================


class LoadTestRunner:
    """Main load test orchestrator"""

    def __init__(
        self,
        server_url: str,
        num_students: int = 20,
        output_dir: str = "./reports",
        mode: str = "burst",
        ramp_interval: int = 5,
        ramp_batch_size: int = 2,
    ):
        self.server_url = server_url
        self.num_students = num_students
        self.output_dir = output_dir
        self.mode = mode
        self.ramp_interval = ramp_interval
        self.ramp_batch_size = ramp_batch_size
        self.test_id = f"loadtest-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        self.resource_monitor = ResourceMonitor(interval=2.0)
        self.students: list[StudentSimulator] = []
        self.all_results: list[ExecutionResult] = []

    def _assign_programs(self) -> list[tuple[str, dict]]:
        """Assign programs to students (round-robin across languages)"""
        assignments = []
        languages = list(TEST_PROGRAMS.keys())

        for i in range(self.num_students):
            lang = languages[i % len(languages)]
            programs = TEST_PROGRAMS[lang]
            program = programs[i % len(programs)]
            assignments.append((lang, program))

        return assignments

    async def run_test(self) -> LoadTestReport:
        """Run the complete load test"""
        print(f"\n{'='*60}")
        print(f"  CodeRunner Load Test")
        print(f"  Test ID: {self.test_id}")
        print(f"  Server: {self.server_url}")
        print(f"  Students: {self.num_students}")
        print(f"  Mode: {self.mode.upper()}")
        if self.mode == "ramp":
            print(f"  Ramp: {self.ramp_batch_size} users every {self.ramp_interval}s")
        print(f"{'='*60}\n")

        start_time = time.time()
        start_time_str = datetime.now().isoformat()

        # Assign programs to students
        assignments = self._assign_programs()

        # Start resource monitoring
        print("[1/4] Starting resource monitor...")
        await self.resource_monitor.start()

        # Choose execution mode
        if self.mode == "ramp":
            await self._run_ramp_mode(assignments)
        else:
            await self._run_burst_mode(assignments)

        # Collect all results
        for student in self.students:
            self.all_results.extend(student.results)

        # Stop monitoring
        print("[4/4] Stopping monitors and collecting results...")
        await self.resource_monitor.stop()

        # Disconnect all students
        disconnect_tasks = [s.disconnect() for s in self.students]
        await asyncio.gather(*disconnect_tasks, return_exceptions=True)

        end_time = time.time()
        end_time_str = datetime.now().isoformat()

        # Generate report
        report = self._generate_report(
            start_time_str, end_time_str, end_time - start_time
        )

        # Save reports
        self._save_reports(report)

        return report

    async def _run_student_program(
        self, student: StudentSimulator, language: str, program: dict
    ):
        """Run a single student's program"""
        try:
            result = await student.run_program(language, program)
            status = "✓" if result.success else "✗"
            print(
                f"  [{student.student_id}] {status} {language}/{program['name']} - {result.execution_time_ms:.0f}ms"
            )
        except Exception as e:
            print(f"  [{student.student_id}] ✗ Error: {e}")

    async def _run_burst_mode(self, assignments: list[tuple[str, dict]]):
        """Run all students at once (original mode)"""
        # Create and connect students
        print(f"[2/4] Connecting {self.num_students} students...")
        connect_tasks = []
        for i in range(self.num_students):
            student = StudentSimulator(f"student-{i+1:02d}", self.server_url)
            self.students.append(student)
            connect_tasks.append(student.connect())

        connect_results = await asyncio.gather(*connect_tasks, return_exceptions=True)
        connected_count = sum(1 for r in connect_results if r is True)
        print(f"       Connected: {connected_count}/{self.num_students}")

        # Run programs concurrently
        print("[3/4] Running programs...")
        run_tasks = []
        for i, student in enumerate(self.students):
            if student.sio and student.sio.connected:
                lang, program = assignments[i]
                run_tasks.append(self._run_student_program(student, lang, program))

        await asyncio.gather(*run_tasks, return_exceptions=True)

    async def _run_ramp_mode(self, assignments: list[tuple[str, dict]]):
        """Gradually add users over time"""
        print(f"[2/4] Starting ramp-up mode...")
        print(f"       Adding {self.ramp_batch_size} users every {self.ramp_interval}s")

        total_batches = (
            self.num_students + self.ramp_batch_size - 1
        ) // self.ramp_batch_size
        active_tasks = []

        for batch_num in range(total_batches):
            start_idx = batch_num * self.ramp_batch_size
            end_idx = min(start_idx + self.ramp_batch_size, self.num_students)
            batch_size = end_idx - start_idx

            print(
                f"\n[3/4] Batch {batch_num + 1}/{total_batches}: Adding {batch_size} users..."
            )

            # Connect new batch of students
            batch_students = []
            for i in range(start_idx, end_idx):
                student = StudentSimulator(f"student-{i+1:02d}", self.server_url)
                self.students.append(student)
                batch_students.append(student)

            # Connect students in this batch
            connect_tasks = [s.connect() for s in batch_students]
            connect_results = await asyncio.gather(
                *connect_tasks, return_exceptions=True
            )
            connected = sum(1 for r in connect_results if r is True)
            print(f"       Connected: {connected}/{batch_size}")

            # Start running programs for connected students in this batch
            for i, student in enumerate(batch_students):
                if student.sio and student.sio.connected:
                    student_idx = start_idx + i
                    lang, program = assignments[student_idx]
                    task = asyncio.create_task(
                        self._run_student_program(student, lang, program)
                    )
                    active_tasks.append(task)

            # Wait for the interval before adding next batch (unless it's the last batch)
            if batch_num < total_batches - 1:
                await asyncio.sleep(self.ramp_interval)

        # Wait for all remaining tasks to complete
        if active_tasks:
            print(
                f"\n       Waiting for all {len(active_tasks)} executions to complete..."
            )
            await asyncio.gather(*active_tasks, return_exceptions=True)

    def _generate_report(
        self, start_time: str, end_time: str, duration: float
    ) -> LoadTestReport:
        """Generate comprehensive report"""
        successful = [r for r in self.all_results if r.success]
        failed = [r for r in self.all_results if not r.success]

        exec_times = [
            r.execution_time_ms for r in self.all_results if r.execution_time_ms > 0
        ]

        # Group by language
        by_language = {}
        for r in self.all_results:
            if r.language not in by_language:
                by_language[r.language] = {"total": 0, "success": 0, "failed": 0}
            by_language[r.language]["total"] += 1
            if r.success:
                by_language[r.language]["success"] += 1
            else:
                by_language[r.language]["failed"] += 1

        # Group by category
        by_category = {}
        for r in self.all_results:
            if r.category not in by_category:
                by_category[r.category] = {"total": 0, "success": 0, "failed": 0}
            by_category[r.category]["total"] += 1
            if r.success:
                by_category[r.category]["success"] += 1
            else:
                by_category[r.category]["failed"] += 1

        # Resource peaks
        peak_containers = max(
            (s.container_count for s in self.resource_monitor.snapshots), default=0
        )
        peak_memory = max(
            (s.total_memory_mb for s in self.resource_monitor.snapshots), default=0.0
        )

        return LoadTestReport(
            test_id=self.test_id,
            start_time=start_time,
            end_time=end_time,
            duration_seconds=duration,
            server_url=self.server_url,
            num_students=self.num_students,
            mode=self.mode,
            ramp_interval=self.ramp_interval if self.mode == "ramp" else None,
            ramp_batch_size=self.ramp_batch_size if self.mode == "ramp" else None,
            total_executions=len(self.all_results),
            successful_executions=len(successful),
            failed_executions=len(failed),
            avg_execution_time_ms=(
                sum(exec_times) / len(exec_times) if exec_times else 0
            ),
            min_execution_time_ms=min(exec_times) if exec_times else 0,
            max_execution_time_ms=max(exec_times) if exec_times else 0,
            executions_by_language=by_language,
            executions_by_category=by_category,
            resource_snapshots=[asdict(s) for s in self.resource_monitor.snapshots],
            peak_containers=peak_containers,
            peak_memory_mb=peak_memory,
            execution_results=[asdict(r) for r in self.all_results],
        )

    def _save_reports(self, report: LoadTestReport):
        """Save JSON and HTML reports"""
        os.makedirs(self.output_dir, exist_ok=True)

        # Save JSON report
        json_path = os.path.join(self.output_dir, f"{self.test_id}.json")
        with open(json_path, "w") as f:
            json.dump(asdict(report), f, indent=2)
        print(f"\n  JSON Report: {json_path}")

        # Save HTML report
        html_path = os.path.join(self.output_dir, f"{self.test_id}.html")
        self._generate_html_report(report, html_path)
        print(f"  HTML Report: {html_path}")

    def _generate_html_report(self, report: LoadTestReport, path: str):
        """Generate HTML report with charts"""
        success_rate = (
            (report.successful_executions / report.total_executions * 100)
            if report.total_executions > 0
            else 0
        )

        mode_info = f"Mode: {report.mode.upper()}"
        if report.mode == "ramp" and report.ramp_interval and report.ramp_batch_size:
            mode_info += (
                f" ({report.ramp_batch_size} users every {report.ramp_interval}s)"
            )

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Load Test Report - {report.test_id}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a2e; color: #eee; padding: 20px; }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        h1 {{ color: #00d4ff; margin-bottom: 10px; }}
        h2 {{ color: #00d4ff; margin: 20px 0 10px; border-bottom: 1px solid #333; padding-bottom: 5px; }}
        .header {{ margin-bottom: 30px; }}
        .meta {{ color: #888; font-size: 14px; }}
        .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }}
        .card {{ background: #16213e; padding: 20px; border-radius: 8px; }}
        .card-title {{ color: #888; font-size: 12px; text-transform: uppercase; margin-bottom: 5px; }}
        .card-value {{ font-size: 28px; font-weight: bold; }}
        .card-value.success {{ color: #00ff88; }}
        .card-value.warning {{ color: #ffaa00; }}
        .card-value.error {{ color: #ff4444; }}
        .chart-container {{ background: #16213e; padding: 20px; border-radius: 8px; margin: 20px 0; }}
        table {{ width: 100%; border-collapse: collapse; margin: 10px 0; }}
        th, td {{ padding: 10px; text-align: left; border-bottom: 1px solid #333; }}
        th {{ color: #00d4ff; }}
        .badge {{ display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }}
        .badge-success {{ background: #00ff8833; color: #00ff88; }}
        .badge-error {{ background: #ff444433; color: #ff4444; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 CodeRunner Load Test Report</h1>
            <p class="meta">Test ID: {report.test_id} | Duration: {report.duration_seconds:.1f}s | Server: {report.server_url}</p>
            <p class="meta">{mode_info}</p>
        </div>
        
        <div class="grid">
            <div class="card">
                <div class="card-title">Total Executions</div>
                <div class="card-value">{report.total_executions}</div>
            </div>
            <div class="card">
                <div class="card-title">Success Rate</div>
                <div class="card-value {'success' if success_rate >= 90 else 'warning' if success_rate >= 70 else 'error'}">{success_rate:.1f}%</div>
            </div>
            <div class="card">
                <div class="card-title">Avg Execution Time</div>
                <div class="card-value">{report.avg_execution_time_ms:.0f}ms</div>
            </div>
            <div class="card">
                <div class="card-title">Peak Containers</div>
                <div class="card-value">{report.peak_containers}</div>
            </div>
            <div class="card">
                <div class="card-title">Peak Memory</div>
                <div class="card-value">{report.peak_memory_mb:.1f}MB</div>
            </div>
            <div class="card">
                <div class="card-title">Students Simulated</div>
                <div class="card-value">{report.num_students}</div>
            </div>
        </div>
        
        <h2>Results by Language</h2>
        <table>
            <thead><tr><th>Language</th><th>Total</th><th>Success</th><th>Failed</th><th>Rate</th></tr></thead>
            <tbody>
"""
        for lang, stats in report.executions_by_language.items():
            rate = (
                (stats["success"] / stats["total"] * 100) if stats["total"] > 0 else 0
            )
            html += f"""                <tr>
                    <td>{lang}</td>
                    <td>{stats['total']}</td>
                    <td>{stats['success']}</td>
                    <td>{stats['failed']}</td>
                    <td><span class="badge {'badge-success' if rate >= 90 else 'badge-error'}">{rate:.0f}%</span></td>
                </tr>
"""

        html += """            </tbody>
        </table>
        
        <h2>Results by Category</h2>
        <table>
            <thead><tr><th>Category</th><th>Total</th><th>Success</th><th>Failed</th><th>Rate</th></tr></thead>
            <tbody>
"""
        for cat, stats in report.executions_by_category.items():
            rate = (
                (stats["success"] / stats["total"] * 100) if stats["total"] > 0 else 0
            )
            html += f"""                <tr>
                    <td>{cat}</td>
                    <td>{stats['total']}</td>
                    <td>{stats['success']}</td>
                    <td>{stats['failed']}</td>
                    <td><span class="badge {'badge-success' if rate >= 90 else 'badge-error'}">{rate:.0f}%</span></td>
                </tr>
"""

        html += f"""            </tbody>
        </table>
        
        <h2>Resource Usage Over Time</h2>
        <div class="chart-container">
            <canvas id="resourceChart"></canvas>
        </div>
        
        <h2>Execution Details</h2>
        <table>
            <thead><tr><th>Student</th><th>Language</th><th>Program</th><th>Status</th><th>Time</th></tr></thead>
            <tbody>
"""
        for r in report.execution_results:
            status_badge = "badge-success" if r["success"] else "badge-error"
            status_text = "✓ Success" if r["success"] else "✗ Failed"
            html += f"""                <tr>
                    <td>{r['student_id']}</td>
                    <td>{r['language']}</td>
                    <td>{r['program_name']}</td>
                    <td><span class="badge {status_badge}">{status_text}</span></td>
                    <td>{r['execution_time_ms']:.0f}ms</td>
                </tr>
"""

        # Prepare chart data
        timestamps = [
            (
                s["timestamp"] - report.resource_snapshots[0]["timestamp"]
                if report.resource_snapshots
                else 0
            )
            for s in report.resource_snapshots
        ]
        containers = [s["container_count"] for s in report.resource_snapshots]
        memory = [s["total_memory_mb"] for s in report.resource_snapshots]

        html += f"""            </tbody>
        </table>
    </div>
    
    <script>
        const ctx = document.getElementById('resourceChart').getContext('2d');
        new Chart(ctx, {{
            type: 'line',
            data: {{
                labels: {json.dumps([f"{t:.1f}s" for t in timestamps])},
                datasets: [
                    {{
                        label: 'Containers',
                        data: {json.dumps(containers)},
                        borderColor: '#00d4ff',
                        backgroundColor: '#00d4ff33',
                        yAxisID: 'y',
                        tension: 0.3
                    }},
                    {{
                        label: 'Memory (MB)',
                        data: {json.dumps(memory)},
                        borderColor: '#ff8800',
                        backgroundColor: '#ff880033',
                        yAxisID: 'y1',
                        tension: 0.3
                    }}
                ]
            }},
            options: {{
                responsive: true,
                interaction: {{ mode: 'index', intersect: false }},
                scales: {{
                    y: {{ type: 'linear', position: 'left', title: {{ display: true, text: 'Containers', color: '#00d4ff' }} }},
                    y1: {{ type: 'linear', position: 'right', title: {{ display: true, text: 'Memory (MB)', color: '#ff8800' }}, grid: {{ drawOnChartArea: false }} }}
                }}
            }}
        }});
    </script>
</body>
</html>
"""
        with open(path, "w") as f:
            f.write(html)


# =============================================================================
# Main Entry Point
# =============================================================================


async def main():
    parser = argparse.ArgumentParser(description="CodeRunner Load Test Suite")
    parser.add_argument(
        "--students",
        "-n",
        type=int,
        default=20,
        help="Number of students to simulate (default: 20)",
    )
    parser.add_argument(
        "--server",
        "-s",
        type=str,
        default="http://localhost:3000",
        help="Server URL (default: http://localhost:3000)",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default="./reports",
        help="Output directory for reports (default: ./reports)",
    )
    parser.add_argument(
        "--mode",
        "-m",
        type=str,
        choices=["burst", "ramp"],
        default="burst",
        help="Test mode: 'burst' (all at once) or 'ramp' (gradual) (default: burst)",
    )
    parser.add_argument(
        "--ramp-interval",
        type=int,
        default=5,
        help="Seconds between adding user batches in ramp mode (default: 5)",
    )
    parser.add_argument(
        "--ramp-batch-size",
        type=int,
        default=2,
        help="Number of users to add per interval in ramp mode (default: 2)",
    )

    args = parser.parse_args()

    runner = LoadTestRunner(
        server_url=args.server,
        num_students=args.students,
        output_dir=args.output,
        mode=args.mode,
        ramp_interval=args.ramp_interval,
        ramp_batch_size=args.ramp_batch_size,
    )

    try:
        report = await runner.run_test()

        print(f"\n{'='*60}")
        print(f"  Test Complete!")
        print(
            f"  Success Rate: {report.successful_executions}/{report.total_executions} ({report.successful_executions/report.total_executions*100:.1f}%)"
            if report.total_executions > 0
            else "  No executions"
        )
        print(f"  Avg Execution Time: {report.avg_execution_time_ms:.0f}ms")
        print(f"  Peak Containers: {report.peak_containers}")
        print(f"  Peak Memory: {report.peak_memory_mb:.1f}MB")
        print(f"{'='*60}\n")

    except KeyboardInterrupt:
        print("\n\nTest interrupted by user.")
    except Exception as e:
        print(f"\nTest failed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
