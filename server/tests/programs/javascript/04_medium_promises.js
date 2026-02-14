// Medium-Complex Promises and Async - Complexity: 4/6
// Tests promises, async/await, and asynchronous patterns

// Simulate async operations
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchData(id) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (id > 0) {
                resolve({ id, data: `Data for ID ${id}`, timestamp: Date.now() });
            } else {
                reject(new Error("Invalid ID"));
            }
        }, 100);
    });
}

// Promise chaining
console.log("=== Promise Chaining ===");
fetchData(1)
    .then(result => {
        console.log("Fetched:", result.data);
        return fetchData(2);
    })
    .then(result => {
        console.log("Fetched:", result.data);
        return fetchData(3);
    })
    .then(result => {
        console.log("Fetched:", result.data);
    })
    .catch(error => {
        console.error("Error:", error.message);
    });

// Async/await
async function processMultipleRequests() {
    console.log("\n=== Async/Await Pattern ===");
    
    try {
        console.log("Starting requests...");
        const result1 = await fetchData(10);
        console.log("Got result 1:", result1.data);
        
        const result2 = await fetchData(20);
        console.log("Got result 2:", result2.data);
        
        const result3 = await fetchData(30);
        console.log("Got result 3:", result3.data);
        
        console.log("All requests completed");
    } catch (error) {
        console.error("Error in async function:", error.message);
    }
}

// Promise.all for parallel execution
async function parallelRequests() {
    console.log("\n=== Parallel Requests with Promise.all ===");
    
    const ids = [100, 101, 102, 103];
    console.log(`Fetching data for IDs: ${ids.join(", ")}`);
    
    try {
        const results = await Promise.all(ids.map(id => fetchData(id)));
        results.forEach(result => {
            console.log(`  ID ${result.id}: ${result.data}`);
        });
        console.log("All parallel requests completed");
    } catch (error) {
        console.error("Error in parallel requests:", error.message);
    }
}

// Error handling with async/await
async function handleErrors() {
    console.log("\n=== Error Handling ===");
    
    try {
        const valid = await fetchData(200);
        console.log("Valid request:", valid.data);
        
        const invalid = await fetchData(-1);
        console.log("This should not print:", invalid.data);
    } catch (error) {
        console.log("Caught error:", error.message);
    }
}

// Execute all async functions
(async () => {
    await delay(200);
    await processMultipleRequests();
    await delay(200);
    await parallelRequests();
    await delay(200);
    await handleErrors();
    
    console.log("\n=== All Async Operations Completed ===");
})();
