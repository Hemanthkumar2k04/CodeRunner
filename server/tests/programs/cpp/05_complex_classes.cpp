// Complex Classes and OOP - Complexity: 5/6
// Tests class hierarchies, inheritance, and polymorphism

#include <iostream>
#include <string>
#include <cmath>
using namespace std;

// Base class
class Shape {
protected:
    string color;
    
public:
    Shape(string c) : color(c) {}
    
    virtual double area() const = 0;  // Pure virtual function
    virtual void display() const {
        cout << "Color: " << color << endl;
    }
    
    virtual ~Shape() {}  // Virtual destructor
};

// Derived class - Circle
class Circle : public Shape {
private:
    double radius;
    
public:
    Circle(string c, double r) : Shape(c), radius(r) {}
    
    double area() const override {
        return 3.14159 * radius * radius;
    }
    
    void display() const override {
        cout << "Circle - ";
        Shape::display();
        cout << "Radius: " << radius << ", Area: " << area() << endl;
    }
};

// Derived class - Rectangle
class Rectangle : public Shape {
private:
    double width, height;
    
public:
    Rectangle(string c, double w, double h) : Shape(c), width(w), height(h) {}
    
    double area() const override {
        return width * height;
    }
    
    void display() const override {
        cout << "Rectangle - ";
        Shape::display();
        cout << "Dimensions: " << width << "x" << height << ", Area: " << area() << endl;
    }
};

// Class with composition
class Engine {
private:
    int horsepower;
    
public:
    Engine(int hp) : horsepower(hp) {}
    
    void start() {
        cout << "Engine started (" << horsepower << " HP)" << endl;
    }
};

class Car {
private:
    string brand;
    Engine engine;
    
public:
    Car(string b, int hp) : brand(b), engine(hp) {}
    
    void start() {
        cout << brand << " car: ";
        engine.start();
    }
};

// Template class
template<typename T>
class Box {
private:
    T value;
    
public:
    Box(T v) : value(v) {}
    
    T getValue() const {
        return value;
    }
    
    void setValue(T v) {
        value = v;
    }
    
    void display() const {
        cout << "Box contains: " << value << endl;
    }
};

// Static members
class Counter {
private:
    static int count;
    int id;
    
public:
    Counter() {
        count++;
        id = count;
    }
    
    static int getCount() {
        return count;
    }
    
    int getId() const {
        return id;
    }
};

int Counter::count = 0;

int main() {
    // Polymorphism
    cout << "=== Polymorphism ===" << endl;
    Shape* shapes[3];
    shapes[0] = new Circle("Red", 5.0);
    shapes[1] = new Rectangle("Blue", 4.0, 6.0);
    shapes[2] = new Circle("Green", 3.0);
    
    for (int i = 0; i < 3; i++) {
        shapes[i]->display();
        cout << endl;
    }
    
    // Cleanup
    for (int i = 0; i < 3; i++) {
        delete shapes[i];
    }
    
    // Composition
    cout << "=== Composition ===" << endl;
    Car car1("Tesla", 450);
    Car car2("BMW", 350);
    
    car1.start();
    car2.start();
    
    // Templates
    cout << "\n=== Templates ===" << endl;
    Box<int> intBox(100);
    Box<string> strBox("Hello");
    Box<double> doubleBox(99.5);
    
    intBox.display();
    strBox.display();
    doubleBox.display();
    
    // Static members
    cout << "\n=== Static Members ===" << endl;
    Counter c1, c2, c3;
    cout << "Counter 1 ID: " << c1.getId() << endl;
    cout << "Counter 2 ID: " << c2.getId() << endl;
    cout << "Counter 3 ID: " << c3.getId() << endl;
    cout << "Total counters created: " << Counter::getCount() << endl;
    
    return 0;
}
