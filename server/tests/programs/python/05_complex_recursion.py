# Complex Recursion and Algorithms - Complexity: 5/6
# Tests recursive algorithms, sorting, and algorithm complexity


def quicksort(arr):
    """Quicksort algorithm implementation"""
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)


def merge_sort(arr):
    """Merge sort algorithm implementation"""
    if len(arr) <= 1:
        return arr

    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])

    return merge(left, right)


def merge(left, right):
    """Merge two sorted arrays"""
    result = []
    i = j = 0

    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1

    result.extend(left[i:])
    result.extend(right[j:])
    return result


def factorial(n):
    """Calculate factorial recursively"""
    if n <= 1:
        return 1
    return n * factorial(n - 1)


def gcd(a, b):
    """Greatest common divisor using Euclidean algorithm"""
    if b == 0:
        return a
    return gcd(b, a % b)


def tower_of_hanoi(n, source, destination, auxiliary):
    """Solve Tower of Hanoi problem"""
    if n == 1:
        return [(source, destination)]

    moves = []
    moves.extend(tower_of_hanoi(n - 1, source, auxiliary, destination))
    moves.append((source, destination))
    moves.extend(tower_of_hanoi(n - 1, auxiliary, destination, source))
    return moves


# Test sorting algorithms
unsorted = [64, 34, 25, 12, 22, 11, 90, 88, 45, 50, 33, 17]
print("Original array:", unsorted)
print("Quicksort result:", quicksort(unsorted.copy()))
print("Merge sort result:", merge_sort(unsorted.copy()))

# Test factorial
print("\nFactorial calculations:")
for i in range(1, 8):
    print(f"  {i}! = {factorial(i)}")

# Test GCD
print("\nGCD calculations:")
pairs = [(48, 18), (100, 75), (17, 19)]
for a, b in pairs:
    print(f"  GCD({a}, {b}) = {gcd(a, b)}")

# Test Tower of Hanoi
n_disks = 3
print(f"\nTower of Hanoi with {n_disks} disks:")
moves = tower_of_hanoi(n_disks, "A", "C", "B")
for i, (src, dest) in enumerate(moves, 1):
    print(f"  Move {i}: {src} -> {dest}")
print(f"Total moves: {len(moves)}")
