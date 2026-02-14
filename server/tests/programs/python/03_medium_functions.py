# Medium Functions and Data Structures - Complexity: 3/6
# Tests function definitions, list operations, and dictionaries


def fibonacci(n):
    """Generate fibonacci sequence up to n terms"""
    if n <= 0:
        return []
    elif n == 1:
        return [0]

    fib = [0, 1]
    for i in range(2, n):
        fib.append(fib[i - 1] + fib[i - 2])
    return fib


def process_data(items):
    """Process a list of numbers"""
    total = sum(items)
    average = total / len(items) if items else 0
    maximum = max(items) if items else 0
    minimum = min(items) if items else 0

    return {
        "total": total,
        "average": average,
        "max": maximum,
        "min": minimum,
        "count": len(items),
    }


# Test fibonacci
print("Fibonacci sequence (10 terms):")
fib_sequence = fibonacci(10)
print(fib_sequence)

# Test data processing
numbers = [15, 23, 8, 42, 16, 31, 4]
print("\nProcessing numbers:", numbers)
result = process_data(numbers)
for key, value in result.items():
    print(f"{key}: {value}")

# Dictionary operations
students = {"Alice": 95, "Bob": 87, "Charlie": 92, "Diana": 88}

print("\nStudent grades:")
for name, grade in students.items():
    print(f"{name}: {grade}")

print(f"\nAverage grade: {sum(students.values()) / len(students):.2f}")
