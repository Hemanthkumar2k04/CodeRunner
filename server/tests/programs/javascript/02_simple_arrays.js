// Simple Arrays and Loops - Complexity: 2/6
// Tests array operations and iteration

// For loop
console.log("=== For Loop ===");
for (let i = 0; i < 5; i++) {
    console.log(`Count: ${i}`);
}

// ForEach with arrays
console.log("\n=== Array ForEach ===");
const fruits = ["apple", "banana", "orange", "grape"];
fruits.forEach((fruit, index) => {
    console.log(`${index + 1}. ${fruit}`);
});

// Map and Filter
console.log("\n=== Array Map and Filter ===");
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const doubled = numbers.map(n => n * 2);
const evens = numbers.filter(n => n % 2 === 0);

console.log("Original:", numbers);
console.log("Doubled:", doubled);
console.log("Evens only:", evens);

// Reduce
const sum = numbers.reduce((acc, n) => acc + n, 0);
console.log(`Sum of all numbers: ${sum}`);
