// Medium ArrayList and Collections - Complexity: 3/6
// Tests ArrayList, methods, and collection operations

import java.util.*;

public class ArrayListDemo {
    public static void main(String[] args) {
        // ArrayList basics
        System.out.println("=== ArrayList Basics ===");
        ArrayList<Integer> numbers = new ArrayList<>();

        // Add elements
        for (int i = 1; i <= 5; i++) {
            numbers.add(i * 10);
        }
        System.out.println("Numbers: " + numbers);

        // ArrayList operations
        numbers.add(2, 25);
        System.out.println("After adding 25 at index 2: " + numbers);

        numbers.remove(Integer.valueOf(40));
        System.out.println("After removing 40: " + numbers);

        // Searching
        System.out.println("Contains 30? " + numbers.contains(30));
        System.out.println("Index of 25: " + numbers.indexOf(25));

        // Sorting
        System.out.println("\n=== Sorting ===");
        ArrayList<Integer> unsorted = new ArrayList<>(Arrays.asList(64, 34, 25, 12, 22, 11, 90));
        System.out.println("Before sort: " + unsorted);
        Collections.sort(unsorted);
        System.out.println("After sort: " + unsorted);

        // String ArrayList
        System.out.println("\n=== String ArrayList ===");
        ArrayList<String> students = new ArrayList<>();
        students.add("Alice");
        students.add("Bob");
        students.add("Charlie");
        students.add("Diana");

        System.out.println("Students:");
        for (int i = 0; i < students.size(); i++) {
            System.out.println("  " + (i + 1) + ". " + students.get(i));
        }

        // HashMap with ArrayList
        System.out.println("\n=== HashMap Integration ===");
        HashMap<String, Integer> scores = new HashMap<>();
        scores.put("Alice", 95);
        scores.put("Bob", 87);
        scores.put("Charlie", 92);
        scores.put("Diana", 88);

        System.out.println("Student Scores:");
        for (String name : scores.keySet()) {
            System.out.println("  " + name + ": " + scores.get(name));
        }

        // Calculate statistics
        int total = 0;
        int max = Integer.MIN_VALUE;
        for (int score : scores.values()) {
            total += score;
            max = Math.max(max, score);
        }
        double average = total / (double) scores.size();
        System.out.println("\nClass average: " + String.format("%.2f", average));
        System.out.println("Highest score: " + max);
    }
}
