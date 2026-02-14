// Medium STL Vector - Complexity: 3/6
// Tests vector operations and STL basics

#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    // Vector basics
    cout << "=== Vector Basics ===" << endl;
    vector<int> numbers;
    
    // Add elements
    for (int i = 1; i <= 5; i++) {
        numbers.push_back(i * 10);
    }
    
    cout << "Numbers: ";
    for (int num : numbers) {
        cout << num << " ";
    }
    cout << endl;
    
    // Vector operations
    numbers.insert(numbers.begin() + 2, 25);
    cout << "After insert at index 2: ";
    for (int num : numbers) {
        cout << num << " ";
    }
    cout << endl;
    
    // Sorting
    cout << "\n=== Sorting ===" << endl;
    vector<int> unsorted = {64, 34, 25, 12, 22, 11, 90};
    cout << "Before sort: ";
    for (int num : unsorted) {
        cout << num << " ";
    }
    cout << endl;
    
    sort(unsorted.begin(), unsorted.end());
    cout << "After sort: ";
    for (int num : unsorted) {
        cout << num << " ";
    }
    cout << endl;
    
    // Finding elements
    auto it = find(unsorted.begin(), unsorted.end(), 25);
    if (it != unsorted.end()) {
        cout << "Found 25 at index: " << (it - unsorted.begin()) << endl;
    }
    
    // Vector of strings
    cout << "\n=== String Vector ===" << endl;
    vector<string> fruits = {"apple", "banana", "orange", "grape"};
    
    cout << "Fruits:" << endl;
    for (size_t i = 0; i < fruits.size(); i++) {
        cout << "  " << (i + 1) << ". " << fruits[i] << endl;
    }
    
    // Count and sum
    int sum = 0;
    for (int num : numbers) {
        sum += num;
    }
    cout << "\nSum of numbers: " << sum << endl;
    cout << "Count: " << numbers.size() << endl;
    
    return 0;
}
