// Complex Generics and Interfaces - Complexity: 5/6
// Tests generic classes, interfaces, and advanced OOP concepts

import java.util.*;

public class GenericsDemo {
    public static void main(String[] args) {
        // Generic Stack
        System.out.println("=== Generic Stack ===");
        Stack<Integer> intStack = new Stack<>();
        intStack.push(10);
        intStack.push(20);
        intStack.push(30);

        System.out.println("Stack size: " + intStack.size());
        System.out.println("Pop: " + intStack.pop());
        System.out.println("Peek: " + intStack.peek());
        System.out.println("Is empty? " + intStack.isEmpty());

        // Generic with different type
        Stack<String> stringStack = new Stack<>();
        stringStack.push("Hello");
        stringStack.push("World");
        System.out.println("\nString stack pop: " + stringStack.pop());

        // Generic Pair class
        System.out.println("\n=== Generic Pair ===");
        Pair<String, Integer> student1 = new Pair<>("Alice", 95);
        Pair<String, Integer> student2 = new Pair<>("Bob", 87);

        System.out.println(student1.getFirst() + ": " + student1.getSecond());
        System.out.println(student2.getFirst() + ": " + student2.getSecond());

        // Generic methods
        System.out.println("\n=== Generic Methods ===");
        Integer[] numbers = { 5, 3, 8, 1, 9, 2 };
        String[] words = { "zebra", "apple", "mango", "banana" };

        System.out.println("Max number: " + findMax(numbers));
        System.out.println("Max word: " + findMax(words));

        // Bounded type parameters
        System.out.println("\n=== Bounded Type Parameters ===");
        Box<Integer> intBox = new Box<>(100);
        Box<Double> doubleBox = new Box<>(99.5);

        System.out.println("Int box value: " + intBox.getValue());
        System.out.println("Double box value: " + doubleBox.getValue());
        System.out.println("Boxes equal? " + intBox.compare(doubleBox));

        // Multiple generic parameters
        System.out.println("\n=== Triple Generic ===");
        Triple<String, Integer, Double> record = new Triple<>("Product", 5, 29.99);
        System.out.println("Name: " + record.getFirst());
        System.out.println("Quantity: " + record.getSecond());
        System.out.println("Price: $" + record.getThird());

        // Interface implementation
        System.out.println("\n=== Interface with Generics ===");
        Repository<Employee> empRepo = new EmployeeRepository();
        empRepo.add(new Employee(1, "Alice"));
        empRepo.add(new Employee(2, "Bob"));
        empRepo.add(new Employee(3, "Charlie"));

        System.out.println("All employees:");
        for (Employee emp : empRepo.getAll()) {
            System.out.println("  " + emp);
        }

        Employee found = empRepo.findById(2);
        System.out.println("Found by ID 2: " + found);
    }

    // Generic method
    public static <T extends Comparable<T>> T findMax(T[] array) {
        T max = array[0];
        for (int i = 1; i < array.length; i++) {
            if (array[i].compareTo(max) > 0) {
                max = array[i];
            }
        }
        return max;
    }
}

// Generic Stack class
class Stack<T> {
    private ArrayList<T> items = new ArrayList<>();

    public void push(T item) {
        items.add(item);
    }

    public T pop() {
        if (isEmpty())
            throw new RuntimeException("Stack is empty");
        return items.remove(items.size() - 1);
    }

    public T peek() {
        if (isEmpty())
            throw new RuntimeException("Stack is empty");
        return items.get(items.size() - 1);
    }

    public boolean isEmpty() {
        return items.isEmpty();
    }

    public int size() {
        return items.size();
    }
}

// Generic Pair class
class Pair<F, S> {
    private F first;
    private S second;

    public Pair(F first, S second) {
        this.first = first;
        this.second = second;
    }

    public F getFirst() {
        return first;
    }

    public S getSecond() {
        return second;
    }
}

// Bounded type parameter
class Box<T extends Number> {
    private T value;

    public Box(T value) {
        this.value = value;
    }

    public T getValue() {
        return value;
    }

    public boolean compare(Box<? extends Number> other) {
        return this.value.doubleValue() > other.getValue().doubleValue();
    }
}

// Triple generic
class Triple<F, S, T> {
    private F first;
    private S second;
    private T third;

    public Triple(F first, S second, T third) {
        this.first = first;
        this.second = second;
        this.third = third;
    }

    public F getFirst() {
        return first;
    }

    public S getSecond() {
        return second;
    }

    public T getThird() {
        return third;
    }
}

// Generic interface
interface Repository<T> {
    void add(T item);

    T findById(int id);

    List<T> getAll();
}

// Employee class
class Employee {
    private int id;
    private String name;

    public Employee(int id, String name) {
        this.id = id;
        this.name = name;
    }

    public int getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    @Override
    public String toString() {
        return "Employee[id=" + id + ", name=" + name + "]";
    }
}

// Repository implementation
class EmployeeRepository implements Repository<Employee> {
    private List<Employee> employees = new ArrayList<>();

    @Override
    public void add(Employee item) {
        employees.add(item);
    }

    @Override
    public Employee findById(int id) {
        for (Employee emp : employees) {
            if (emp.getId() == id) {
                return emp;
            }
        }
        return null;
    }

    @Override
    public List<Employee> getAll() {
        return new ArrayList<>(employees);
    }
}
