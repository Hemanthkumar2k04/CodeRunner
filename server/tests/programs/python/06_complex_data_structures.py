# Complex Data Structures and Classes - Complexity: 6/6
# Tests object-oriented programming, complex data structures, and algorithms


class Node:
    """Node for linked list and tree structures"""

    def __init__(self, data):
        self.data = data
        self.next = None
        self.left = None
        self.right = None


class LinkedList:
    """Singly linked list implementation"""

    def __init__(self):
        self.head = None

    def append(self, data):
        new_node = Node(data)
        if not self.head:
            self.head = new_node
            return
        current = self.head
        while current.next:
            current = current.next
        current.next = new_node

    def to_list(self):
        result = []
        current = self.head
        while current:
            result.append(current.data)
            current = current.next
        return result

    def reverse(self):
        prev = None
        current = self.head
        while current:
            next_node = current.next
            current.next = prev
            prev = current
            current = next_node
        self.head = prev


class BinarySearchTree:
    """Binary search tree implementation"""

    def __init__(self):
        self.root = None

    def insert(self, data):
        if not self.root:
            self.root = Node(data)
        else:
            self._insert_recursive(self.root, data)

    def _insert_recursive(self, node, data):
        if data < node.data:
            if node.left is None:
                node.left = Node(data)
            else:
                self._insert_recursive(node.left, data)
        else:
            if node.right is None:
                node.right = Node(data)
            else:
                self._insert_recursive(node.right, data)

    def inorder_traversal(self):
        result = []
        self._inorder_recursive(self.root, result)
        return result

    def _inorder_recursive(self, node, result):
        if node:
            self._inorder_recursive(node.left, result)
            result.append(node.data)
            self._inorder_recursive(node.right, result)


class Graph:
    """Graph implementation using adjacency list"""

    def __init__(self):
        self.graph = {}

    def add_edge(self, u, v):
        if u not in self.graph:
            self.graph[u] = []
        if v not in self.graph:
            self.graph[v] = []
        self.graph[u].append(v)
        self.graph[v].append(u)

    def bfs(self, start):
        visited = set()
        queue = [start]
        result = []

        while queue:
            vertex = queue.pop(0)
            if vertex not in visited:
                visited.add(vertex)
                result.append(vertex)
                queue.extend(
                    [n for n in self.graph.get(vertex, []) if n not in visited]
                )

        return result

    def dfs(self, start, visited=None):
        if visited is None:
            visited = set()
        visited.add(start)
        result = [start]

        for neighbor in self.graph.get(start, []):
            if neighbor not in visited:
                result.extend(self.dfs(neighbor, visited))

        return result


# Test Linked List
print("=== Linked List Test ===")
ll = LinkedList()
for i in [1, 2, 3, 4, 5]:
    ll.append(i)
print("Original list:", ll.to_list())
ll.reverse()
print("Reversed list:", ll.to_list())

# Test Binary Search Tree
print("\n=== Binary Search Tree Test ===")
bst = BinarySearchTree()
values = [50, 30, 70, 20, 40, 60, 80]
for val in values:
    bst.insert(val)
print("Inserted values:", values)
print("Inorder traversal (sorted):", bst.inorder_traversal())

# Test Graph
print("\n=== Graph Test ===")
g = Graph()
edges = [(0, 1), (0, 2), (1, 3), (1, 4), (2, 5), (2, 6)]
for u, v in edges:
    g.add_edge(u, v)
print("Graph edges:", edges)
print("BFS from node 0:", g.bfs(0))
print("DFS from node 0:", g.dfs(0))

# Complex data processing
print("\n=== Complex Data Processing ===")
data = [
    {"name": "Alice", "age": 30, "score": 95},
    {"name": "Bob", "age": 25, "score": 87},
    {"name": "Charlie", "age": 35, "score": 92},
    {"name": "Diana", "age": 28, "score": 88},
]

# Sort by score (descending)
sorted_data = sorted(data, key=lambda x: x["score"], reverse=True)
print("Top performers:")
for person in sorted_data:
    print(f"  {person['name']}: {person['score']}")

# Group by age ranges
age_groups = {"20-29": [], "30-39": []}
for person in data:
    if 20 <= person["age"] < 30:
        age_groups["20-29"].append(person["name"])
    elif 30 <= person["age"] < 40:
        age_groups["30-39"].append(person["name"])

print("\nAge groups:")
for group, names in age_groups.items():
    print(f"  {group}: {', '.join(names)}")
