// Medium Functions and Objects - Complexity: 3/6
// Tests function definitions, objects, and ES6 features

// Arrow functions
const add = (a, b) => a + b;
const multiply = (a, b) => a * b;

console.log("=== Basic Math Operations ===");
console.log(`5 + 3 = ${add(5, 3)}`);
console.log(`5 * 3 = ${multiply(5, 3)}`);

// Object manipulation
const students = [
    { name: "Alice", grade: 95, age: 20 },
    { name: "Bob", grade: 87, age: 22 },
    { name: "Charlie", grade: 92, age: 21 },
    { name: "Diana", grade: 88, age: 20 }
];

console.log("\n=== Student Records ===");
students.forEach(student => {
    console.log(`${student.name}: Grade ${student.grade}, Age ${student.age}`);
});

// Destructuring and spread operator
const { name, grade } = students[0];
console.log(`\nTop student: ${name} with grade ${grade}`);

const moreStudents = [...students, { name: "Eve", grade: 90, age: 22 }];
console.log(`Total students: ${moreStudents.length}`);

// Higher-order functions
function calculate(operation, a, b) {
    return operation(a, b);
}

console.log("\n=== Higher-Order Functions ===");
console.log(`Calculate(add, 10, 5): ${calculate(add, 10, 5)}`);
console.log(`Calculate(multiply, 10, 5): ${calculate(multiply, 10, 5)}`);

// Template literals and string methods
const formatStudent = (student) => {
    return `${student.name.toUpperCase()} scored ${student.grade}%`;
};

console.log("\n=== Formatted Output ===");
students.slice(0, 2).forEach(s => console.log(formatStudent(s)));

// Object methods
const calculator = {
    value: 0,
    add(n) {
        this.value += n;
        return this;
    },
    multiply(n) {
        this.value *= n;
        return this;
    },
    getResult() {
        return this.value;
    }
};

console.log("\n=== Method Chaining ===");
const result = calculator.add(5).multiply(3).add(2).getResult();
console.log(`Result: ${result}`);
