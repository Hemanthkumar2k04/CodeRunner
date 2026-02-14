// Complex STL Algorithms - Complexity: 6/6
// Tests advanced STL algorithms, data structures, and problem-solving

#include <iostream>
#include <vector>
#include <algorithm>
#include <map>
#include <set>
#include <queue>
#include <stack>
using namespace std;

// Sorting algorithms
void quickSort(vector<int>& arr, int low, int high) {
    if (low < high) {
        int pivot = arr[high];
        int i = low - 1;
        
        for (int j = low; j < high; j++) {
            if (arr[j] < pivot) {
                i++;
                swap(arr[i], arr[j]);
            }
        }
        swap(arr[i + 1], arr[high]);
        int pi = i + 1;
        
        quickSort(arr, low, pi - 1);
        quickSort(arr, pi + 1, high);
    }
}

// Binary search
int binarySearch(vector<int>& arr, int target) {
    int left = 0, right = arr.size() - 1;
    
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (arr[mid] == target) return mid;
        if (arr[mid] < target) left = mid + 1;
        else right = mid - 1;
    }
    
    return -1;
}

int main() {
    // STL Algorithms
    cout << "=== STL Algorithms ===" << endl;
    vector<int> numbers = {64, 34, 25, 12, 22, 11, 90};
    
    cout << "Original: ";
    for (int n : numbers) cout << n << " ";
    cout << endl;
    
    // Sort
    vector<int> sorted = numbers;
    sort(sorted.begin(), sorted.end());
    cout << "Sorted: ";
    for (int n : sorted) cout << n << " ";
    cout << endl;
    
    // Find
    auto it = find(numbers.begin(), numbers.end(), 25);
    if (it != numbers.end()) {
        cout << "Found 25 at index: " << (it - numbers.begin()) << endl;
    }
    
    // Count
    int count22 = count(numbers.begin(), numbers.end(), 22);
    cout << "Count of 22: " << count22 << endl;
    
    // Map (Dictionary)
    cout << "\n=== Map ===" << endl;
    map<string, int> scores;
    scores["Alice"] = 95;
    scores["Bob"] = 87;
    scores["Charlie"] = 92;
    scores["Diana"] = 88;
    
    cout << "Student scores:" << endl;
    for (auto& pair : scores) {
        cout << "  " << pair.first << ": " << pair.second << endl;
    }
    
    // Set (Unique elements)
    cout << "\n=== Set ===" << endl;
    set<int> uniqueNums = {5, 2, 8, 1, 9, 5, 2};  // Duplicates removed
    cout << "Unique numbers (sorted): ";
    for (int n : uniqueNums) cout << n << " ";
    cout << endl;
    
    // Priority Queue (Heap)
    cout << "\n=== Priority Queue ===" << endl;
    priority_queue<int> pq;
    pq.push(30);
    pq.push(10);
    pq.push(50);
    pq.push(20);
    
    cout << "Priority queue (max heap): ";
    while (!pq.empty()) {
        cout << pq.top() << " ";
        pq.pop();
    }
    cout << endl;
    
    // Stack
    cout << "\n=== Stack ===" << endl;
    stack<int> st;
    for (int i = 1; i <= 5; i++) {
        st.push(i * 10);
    }
    
    cout << "Stack pop order: ";
    while (!st.empty()) {
        cout << st.top() << " ";
        st.pop();
    }
    cout << endl;
    
    // Queue
    cout << "\n=== Queue ===" << endl;
    queue<string> q;
    q.push("First");
    q.push("Second");
    q.push("Third");
    
    cout << "Queue processing: ";
    while (!q.empty()) {
        cout << q.front() << " ";
        q.pop();
    }
    cout << endl;
    
    // Custom quicksort
    cout << "\n=== Custom QuickSort ===" << endl;
    vector<int> unsorted = {64, 34, 25, 12, 22, 11, 90, 45};
    cout << "Before: ";
    for (int n : unsorted) cout << n << " ";
    cout << endl;
    
    quickSort(unsorted, 0, unsorted.size() - 1);
    cout << "After: ";
    for (int n : unsorted) cout << n << " ";
    cout << endl;
    
    // Binary search
    cout << "\n=== Binary Search ===" << endl;
    int target = 25;
    int index = binarySearch(unsorted, target);
    cout << "Search for " << target << ": ";
    if (index != -1) {
        cout << "Found at index " << index << endl;
    } else {
        cout << "Not found" << endl;
    }
    
    // Transform algorithm
    cout << "\n=== Transform ===" << endl;
    vector<int> values = {1, 2, 3, 4, 5};
    vector<int> squared(values.size());
    
    transform(values.begin(), values.end(), squared.begin(), 
              [](int x) { return x * x; });
    
    cout << "Original: ";
    for (int n : values) cout << n << " ";
    cout << endl;
    
    cout << "Squared: ";
    for (int n : squared) cout << n << " ";
    cout << endl;
    
    return 0;
}
