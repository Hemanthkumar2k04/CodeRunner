// Simple Loops and Arrays - Complexity: 2/6
// Tests basic loops and array operations

#include <iostream>
using namespace std;

int main() {
    // For loop
    cout << "=== For Loop ===" << endl;
    for (int i = 0; i < 5; i++) {
        cout << "Count: " << i << endl;
    }
    
    // While loop
    cout << "\n=== While Loop ===" << endl;
    int count = 0;
    while (count < 3) {
        cout << "While iteration: " << count << endl;
        count++;
    }
    
    // Arrays
    cout << "\n=== Array Operations ===" << endl;
    int numbers[] = {1, 2, 3, 4, 5};
    int size = sizeof(numbers) / sizeof(numbers[0]);
    
    cout << "Array: ";
    for (int i = 0; i < size; i++) {
        cout << numbers[i] << " ";
    }
    cout << endl;
    
    // Calculate sum and average
    int sum = 0;
    for (int i = 0; i < size; i++) {
        sum += numbers[i];
    }
    cout << "Sum: " << sum << endl;
    cout << "Average: " << (double)sum / size << endl;
    
    return 0;
}
