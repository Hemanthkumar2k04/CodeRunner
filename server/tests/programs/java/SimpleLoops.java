// Simple Loops and Arrays - Complexity: 2/6
// Tests basic loop constructs and array operations

public class SimpleLoops {
    public static void main(String[] args) {
        // For loop
        System.out.println("=== For Loop ===");
        for (int i = 0; i < 5; i++) {
            System.out.println("Count: " + i);
        }

        // While loop
        System.out.println("\n=== While Loop ===");
        int count = 0;
        while (count < 3) {
            System.out.println("While iteration: " + count);
            count++;
        }

        // Arrays
        System.out.println("\n=== Array Operations ===");
        int[] numbers = { 1, 2, 3, 4, 5 };
        System.out.print("Array: ");
        for (int num : numbers) {
            System.out.print(num + " ");
        }
        System.out.println();

        // Calculate sum
        int sum = 0;
        for (int num : numbers) {
            sum += num;
        }
        System.out.println("Sum: " + sum);
        System.out.println("Average: " + (sum / (double) numbers.length));

        // String array
        System.out.println("\n=== String Array ===");
        String[] fruits = { "apple", "banana", "orange", "grape" };
        for (int i = 0; i < fruits.length; i++) {
            System.out.println((i + 1) + ". " + fruits[i]);
        }
    }
}
