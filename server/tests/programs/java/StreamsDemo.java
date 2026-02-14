// Medium-Complex Streams and Lambda - Complexity: 4/6
// Tests Java 8+ streams, lambda expressions, and functional programming

import java.util.*;
import java.util.stream.*;

public class StreamsDemo {
    public static void main(String[] args) {
        // Basic streams
        System.out.println("=== Basic Streams ===");
        List<Integer> numbers = Arrays.asList(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);

        // Filter and collect
        List<Integer> evens = numbers.stream()
                .filter(n -> n % 2 == 0)
                .collect(Collectors.toList());
        System.out.println("Even numbers: " + evens);

        // Map operation
        List<Integer> squared = numbers.stream()
                .map(n -> n * n)
                .collect(Collectors.toList());
        System.out.println("Squared: " + squared);

        // Reduce
        int sum = numbers.stream()
                .reduce(0, (a, b) -> a + b);
        System.out.println("Sum: " + sum);

        // Stream operations with objects
        System.out.println("\n=== Object Streams ===");
        List<Person> people = Arrays.asList(
                new Person("Alice", 30, 95000),
                new Person("Bob", 25, 75000),
                new Person("Charlie", 35, 85000),
                new Person("Diana", 28, 90000));

        // Filter by age
        System.out.println("People over 27:");
        people.stream()
                .filter(p -> p.getAge() > 27)
                .forEach(p -> System.out.println("  " + p));

        // Sort by salary
        System.out.println("\nSorted by salary (descending):");
        people.stream()
                .sorted((p1, p2) -> Double.compare(p2.getSalary(), p1.getSalary()))
                .forEach(p -> System.out.println("  " + p));

        // Calculate average salary
        double avgSalary = people.stream()
                .mapToDouble(Person::getSalary)
                .average()
                .orElse(0.0);
        System.out.println("\nAverage salary: $" + String.format("%.2f", avgSalary));

        // Group by age range
        System.out.println("\n=== Collectors.groupingBy ===");
        Map<String, List<Person>> ageGroups = people.stream()
                .collect(Collectors.groupingBy(p -> {
                    if (p.getAge() < 30)
                        return "20s";
                    else
                        return "30s";
                }));

        ageGroups.forEach((group, list) -> {
            System.out.println(group + ": " + list.stream()
                    .map(Person::getName)
                    .collect(Collectors.joining(", ")));
        });

        // Parallel streams
        System.out.println("\n=== Parallel Processing ===");
        long start = System.currentTimeMillis();
        long count = IntStream.rangeClosed(1, 1000000)
                .parallel()
                .filter(n -> n % 2 == 0)
                .count();
        long end = System.currentTimeMillis();
        System.out.println("Even numbers from 1-1000000: " + count);
        System.out.println("Time taken: " + (end - start) + "ms");
    }
}

class Person {
    private String name;
    private int age;
    private double salary;

    public Person(String name, int age, double salary) {
        this.name = name;
        this.age = age;
        this.salary = salary;
    }

    public String getName() {
        return name;
    }

    public int getAge() {
        return age;
    }

    public double getSalary() {
        return salary;
    }

    @Override
    public String toString() {
        return name + " (age " + age + ", $" + String.format("%.0f", salary) + ")";
    }
}
