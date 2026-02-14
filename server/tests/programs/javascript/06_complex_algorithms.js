// Complex Algorithms and Data Structures - Complexity: 6/6
// Tests advanced algorithms, data structures, and problem-solving

// Sorting algorithms
function quickSort(arr) {
    if (arr.length <= 1) return arr;
    
    const pivot = arr[Math.floor(arr.length / 2)];
    const left = arr.filter(x => x < pivot);
    const middle = arr.filter(x => x === pivot);
    const right = arr.filter(x => x > pivot);
    
    return [...quickSort(left), ...middle, ...quickSort(right)];
}

function mergeSort(arr) {
    if (arr.length <= 1) return arr;
    
    const mid = Math.floor(arr.length / 2);
    const left = mergeSort(arr.slice(0, mid));
    const right = mergeSort(arr.slice(mid));
    
    return merge(left, right);
}

function merge(left, right) {
    const result = [];
    let i = 0, j = 0;
    
    while (i < left.length && j < right.length) {
        if (left[i] < right[j]) {
            result.push(left[i++]);
        } else {
            result.push(right[j++]);
        }
    }
    
    return [...result, ...left.slice(i), ...right.slice(j)];
}

// Binary search
function binarySearch(arr, target) {
    let left = 0;
    let right = arr.length - 1;
    
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        
        if (arr[mid] === target) return mid;
        if (arr[mid] < target) left = mid + 1;
        else right = mid - 1;
    }
    
    return -1;
}

// Graph algorithms
class Graph {
    constructor() {
        this.adjacencyList = {};
    }
    
    addVertex(vertex) {
        if (!this.adjacencyList[vertex]) {
            this.adjacencyList[vertex] = [];
        }
    }
    
    addEdge(v1, v2) {
        this.adjacencyList[v1].push(v2);
        this.adjacencyList[v2].push(v1);
    }
    
    bfs(start) {
        const queue = [start];
        const result = [];
        const visited = {};
        visited[start] = true;
        
        while (queue.length) {
            const vertex = queue.shift();
            result.push(vertex);
            
            this.adjacencyList[vertex].forEach(neighbor => {
                if (!visited[neighbor]) {
                    visited[neighbor] = true;
                    queue.push(neighbor);
                }
            });
        }
        
        return result;
    }
    
    dfs(start) {
        const result = [];
        const visited = {};
        
        const dfsHelper = (vertex) => {
            visited[vertex] = true;
            result.push(vertex);
            
            this.adjacencyList[vertex].forEach(neighbor => {
                if (!visited[neighbor]) {
                    dfsHelper(neighbor);
                }
            });
        };
        
        dfsHelper(start);
        return result;
    }
}

// Dynamic programming - Fibonacci with memoization
function fibonacciMemo() {
    const cache = {};
    
    return function fib(n) {
        if (n in cache) return cache[n];
        if (n <= 2) return 1;
        
        cache[n] = fib(n - 1) + fib(n - 2);
        return cache[n];
    };
}

// Test sorting
console.log("=== Sorting Algorithms ===");
const unsorted = [64, 34, 25, 12, 22, 11, 90, 45];
console.log("Original:", unsorted);
console.log("QuickSort:", quickSort([...unsorted]));
console.log("MergeSort:", mergeSort([...unsorted]));

// Test binary search
console.log("\n=== Binary Search ===");
const sorted = [11, 12, 22, 25, 34, 45, 64, 90];
console.log("Sorted array:", sorted);
console.log("Search for 25:", binarySearch(sorted, 25));
console.log("Search for 99:", binarySearch(sorted, 99));

// Test graph
console.log("\n=== Graph Traversal ===");
const graph = new Graph();
["A", "B", "C", "D", "E", "F"].forEach(v => graph.addVertex(v));
graph.addEdge("A", "B");
graph.addEdge("A", "C");
graph.addEdge("B", "D");
graph.addEdge("C", "E");
graph.addEdge("D", "E");
graph.addEdge("D", "F");
graph.addEdge("E", "F");

console.log("BFS from A:", graph.bfs("A").join(" -> "));
console.log("DFS from A:", graph.dfs("A").join(" -> "));

// Test memoized fibonacci
console.log("\n=== Memoized Fibonacci ===");
const fib = fibonacciMemo();
for (let i = 1; i <= 10; i++) {
    console.log(`fib(${i}) = ${fib(i)}`);
}

// Longest common subsequence
function lcs(s1, s2) {
    const m = s1.length;
    const n = s2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (s1[i - 1] === s2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    
    return dp[m][n];
}

console.log("\n=== Longest Common Subsequence ===");
const str1 = "ABCDGH";
const str2 = "AEDFHR";
console.log(`String 1: ${str1}`);
console.log(`String 2: ${str2}`);
console.log(`LCS Length: ${lcs(str1, str2)}`);
