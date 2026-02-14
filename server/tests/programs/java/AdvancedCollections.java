// Complex Collections and Algorithms - Complexity: 6/6
// Tests advanced collections, sorting algorithms, and data structures

import java.util.*;

public class AdvancedCollections {
    public static void main(String[] args) {
        // TreeMap - sorted map
        System.out.println("=== TreeMap (Sorted Map) ===");
        TreeMap<String, Integer> scores = new TreeMap<>();
        scores.put("Charlie", 92);
        scores.put("Alice", 95);
        scores.put("Diana", 88);
        scores.put("Bob", 87);

        System.out.println("Sorted by key: " + scores);
        System.out.println("First entry: " + scores.firstEntry());
        System.out.println("Last entry: " + scores.lastEntry());

        // PriorityQueue
        System.out.println("\n=== PriorityQueue ===");
        PriorityQueue<Task> taskQueue = new PriorityQueue<>();
        taskQueue.offer(new Task("Write report", 2));
        taskQueue.offer(new Task("Fix bug", 1));
        taskQueue.offer(new Task("Review code", 3));
        taskQueue.offer(new Task("Deploy app", 1));

        System.out.println("Processing tasks by priority:");
        while (!taskQueue.isEmpty()) {
            System.out.println("  " + taskQueue.poll());
        }

        // LinkedHashMap - maintains insertion order
        System.out.println("\n=== LinkedHashMap ===");
        LinkedHashMap<String, String> cache = new LinkedHashMap<>(5, 0.75f, true);
        cache.put("page1", "Home");
        cache.put("page2", "About");
        cache.put("page3", "Contact");

        // Access page2
        cache.get("page2");
        System.out.println("Cache order (page2 accessed): " + cache.keySet());

        // HashSet vs TreeSet
        System.out.println("\n=== HashSet vs TreeSet ===");
        Set<Integer> hashSet = new HashSet<>(Arrays.asList(5, 2, 8, 1, 9));
        Set<Integer> treeSet = new TreeSet<>(Arrays.asList(5, 2, 8, 1, 9));

        System.out.println("HashSet (unordered): " + hashSet);
        System.out.println("TreeSet (sorted): " + treeSet);

        // Custom sorting with Comparator
        System.out.println("\n=== Custom Sorting ===");
        List<Student> students = Arrays.asList(
                new Student("Alice", 95, 20),
                new Student("Bob", 87, 22),
                new Student("Charlie", 92, 21),
                new Student("Diana", 92, 20));

        System.out.println("Original order:");
        students.forEach(System.out::println);

        // Sort by grade (descending), then by age (ascending)
        Collections.sort(students, Comparator
                .comparingInt(Student::getGrade).reversed()
                .thenComparingInt(Student::getAge));

        System.out.println("\nSorted by grade (desc) then age (asc):");
        students.forEach(System.out::println);

        // Binary Search Tree implementation
        System.out.println("\n=== Binary Search Tree ===");
        BinarySearchTree bst = new BinarySearchTree();
        int[] values = { 50, 30, 70, 20, 40, 60, 80 };

        for (int val : values) {
            bst.insert(val);
        }

        System.out.print("Inorder traversal: ");
        bst.inorderTraversal();
        System.out.println("\nSearch for 40: " + (bst.search(40) ? "Found" : "Not found"));
        System.out.println("Search for 55: " + (bst.search(55) ? "Found" : "Not found"));

        // Graph with adjacency list
        System.out.println("\n=== Graph Implementation ===");
        Graph graph = new Graph(6);
        graph.addEdge(0, 1);
        graph.addEdge(0, 2);
        graph.addEdge(1, 3);
        graph.addEdge(2, 3);
        graph.addEdge(3, 4);
        graph.addEdge(4, 5);

        System.out.print("BFS from vertex 0: ");
        graph.bfs(0);
        System.out.print("\nDFS from vertex 0: ");
        graph.dfs(0);
        System.out.println();
    }
}

// Task class for priority queue
class Task implements Comparable<Task> {
    private String name;
    private int priority;

    public Task(String name, int priority) {
        this.name = name;
        this.priority = priority;
    }

    @Override
    public int compareTo(Task other) {
        return Integer.compare(this.priority, other.priority);
    }

    @Override
    public String toString() {
        return name + " (priority: " + priority + ")";
    }
}

// Student class for custom sorting
class Student {
    private String name;
    private int grade;
    private int age;

    public Student(String name, int grade, int age) {
        this.name = name;
        this.grade = grade;
        this.age = age;
    }

    public String getName() {
        return name;
    }

    public int getGrade() {
        return grade;
    }

    public int getAge() {
        return age;
    }

    @Override
    public String toString() {
        return name + " (grade: " + grade + ", age: " + age + ")";
    }
}

// Binary Search Tree Node
class TreeNode {
    int data;
    TreeNode left, right;

    public TreeNode(int data) {
        this.data = data;
        this.left = this.right = null;
    }
}

// Binary Search Tree
class BinarySearchTree {
    private TreeNode root;

    public void insert(int data) {
        root = insertRec(root, data);
    }

    private TreeNode insertRec(TreeNode root, int data) {
        if (root == null) {
            return new TreeNode(data);
        }

        if (data < root.data) {
            root.left = insertRec(root.left, data);
        } else {
            root.right = insertRec(root.right, data);
        }

        return root;
    }

    public boolean search(int data) {
        return searchRec(root, data);
    }

    private boolean searchRec(TreeNode root, int data) {
        if (root == null)
            return false;
        if (root.data == data)
            return true;

        if (data < root.data) {
            return searchRec(root.left, data);
        } else {
            return searchRec(root.right, data);
        }
    }

    public void inorderTraversal() {
        inorderRec(root);
    }

    private void inorderRec(TreeNode root) {
        if (root != null) {
            inorderRec(root.left);
            System.out.print(root.data + " ");
            inorderRec(root.right);
        }
    }
}

// Graph class
class Graph {
    private int vertices;
    private LinkedList<Integer>[] adjacencyList;

    @SuppressWarnings("unchecked")
    public Graph(int vertices) {
        this.vertices = vertices;
        adjacencyList = new LinkedList[vertices];

        for (int i = 0; i < vertices; i++) {
            adjacencyList[i] = new LinkedList<>();
        }
    }

    public void addEdge(int source, int dest) {
        adjacencyList[source].add(dest);
        adjacencyList[dest].add(source);
    }

    public void bfs(int start) {
        boolean[] visited = new boolean[vertices];
        Queue<Integer> queue = new LinkedList<>();

        visited[start] = true;
        queue.add(start);

        while (!queue.isEmpty()) {
            int vertex = queue.poll();
            System.out.print(vertex + " ");

            for (int neighbor : adjacencyList[vertex]) {
                if (!visited[neighbor]) {
                    visited[neighbor] = true;
                    queue.add(neighbor);
                }
            }
        }
    }

    public void dfs(int start) {
        boolean[] visited = new boolean[vertices];
        dfsUtil(start, visited);
    }

    private void dfsUtil(int vertex, boolean[] visited) {
        visited[vertex] = true;
        System.out.print(vertex + " ");

        for (int neighbor : adjacencyList[vertex]) {
            if (!visited[neighbor]) {
                dfsUtil(neighbor, visited);
            }
        }
    }
}
