// Complex Classes and OOP - Complexity: 5/6
// Tests ES6 classes, inheritance, and object-oriented patterns

// Base class
class Animal {
    constructor(name, age) {
        this.name = name;
        this.age = age;
    }
    
    speak() {
        console.log(`${this.name} makes a sound`);
    }
    
    getInfo() {
        return `${this.name} is ${this.age} years old`;
    }
}

// Inheritance
class Dog extends Animal {
    constructor(name, age, breed) {
        super(name, age);
        this.breed = breed;
    }
    
    speak() {
        console.log(`${this.name} barks: Woof!`);
    }
    
    fetch() {
        console.log(`${this.name} fetches the ball`);
    }
}

class Cat extends Animal {
    constructor(name, age, indoor) {
        super(name, age);
        this.indoor = indoor;
    }
    
    speak() {
        console.log(`${this.name} meows: Meow!`);
    }
    
    climb() {
        console.log(`${this.name} climbs a tree`);
    }
}

// Static methods and properties
class MathUtils {
    static PI = 3.14159;
    
    static circleArea(radius) {
        return this.PI * radius * radius;
    }
    
    static factorial(n) {
        if (n <= 1) return 1;
        return n * this.factorial(n - 1);
    }
}

// Getters and setters
class Rectangle {
    constructor(width, height) {
        this._width = width;
        this._height = height;
    }
    
    get area() {
        return this._width * this._height;
    }
    
    get perimeter() {
        return 2 * (this._width + this._height);
    }
    
    set width(value) {
        if (value > 0) this._width = value;
    }
    
    set height(value) {
        if (value > 0) this._height = value;
    }
}

// Test animals
console.log("=== Animal Classes ===");
const dog = new Dog("Buddy", 5, "Golden Retriever");
const cat = new Cat("Whiskers", 3, true);

console.log(dog.getInfo());
dog.speak();
dog.fetch();

console.log("\n" + cat.getInfo());
cat.speak();
cat.climb();

// Test static methods
console.log("\n=== Static Methods ===");
console.log(`Circle area (radius 5): ${MathUtils.circleArea(5).toFixed(2)}`);
console.log(`Factorial of 6: ${MathUtils.factorial(6)}`);

// Test getters/setters
console.log("\n=== Rectangle with Getters/Setters ===");
const rect = new Rectangle(10, 5);
console.log(`Dimensions: ${rect._width} x ${rect._height}`);
console.log(`Area: ${rect.area}`);
console.log(`Perimeter: ${rect.perimeter}`);

rect.width = 15;
console.log(`\nAfter width change to 15:`);
console.log(`New area: ${rect.area}`);
console.log(`New perimeter: ${rect.perimeter}`);

// Factory pattern
class ShapeFactory {
    static createShape(type, ...dimensions) {
        if (type === 'rectangle') {
            return new Rectangle(...dimensions);
        }
        return null;
    }
}

console.log("\n=== Factory Pattern ===");
const shape = ShapeFactory.createShape('rectangle', 7, 3);
console.log(`Created rectangle: Area = ${shape.area}`);

// Composition
class Engine {
    start() {
        return "Engine started";
    }
}

class Car {
    constructor(brand) {
        this.brand = brand;
        this.engine = new Engine();
    }
    
    start() {
        console.log(`${this.brand}: ${this.engine.start()}`);
    }
}

console.log("\n=== Composition Pattern ===");
const car = new Car("Tesla");
car.start();
