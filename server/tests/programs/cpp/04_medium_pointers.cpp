// Medium-Complex Pointers and Functions - Complexity: 4/6
// Tests pointers, dynamic memory, and function operations

#include <iostream>
#include <cstring>
using namespace std;

// Function declarations
void swap(int* a, int* b);
int* createArray(int size);
int factorial(int n);
void printArray(int* arr, int size);

int main() {
    // Basic pointers
    cout << "=== Basic Pointers ===" << endl;
    int x = 10;
    int* ptr = &x;
    
    cout << "Value of x: " << x << endl;
    cout << "Address of x: " << &x << endl;
    cout << "Value via pointer: " << *ptr << endl;
    
    // Pointer arithmetic
    int arr[] = {10, 20, 30, 40, 50};
    int* p = arr;
    
    cout << "\n=== Pointer Arithmetic ===" << endl;
    for (int i = 0; i < 5; i++) {
        cout << "arr[" << i << "] = " << *(p + i) << endl;
    }
    
    // Swap using pointers
    cout << "\n=== Swap Function ===" << endl;
    int a = 5, b = 10;
    cout << "Before swap: a = " << a << ", b = " << b << endl;
    swap(&a, &b);
    cout << "After swap: a = " << a << ", b = " << b << endl;
    
    // Dynamic memory allocation
    cout << "\n=== Dynamic Memory ===" << endl;
    int size = 5;
    int* dynArr = createArray(size);
    
    cout << "Dynamic array: ";
    printArray(dynArr, size);
    
    delete[] dynArr;  // Free memory
    
    // Recursion
    cout << "\n=== Factorial (Recursion) ===" << endl;
    for (int i = 1; i <= 7; i++) {
        cout << i << "! = " << factorial(i) << endl;
    }
    
    // Strings with pointers
    cout << "\n=== String Operations ===" << endl;
    char str1[20] = "Hello";
    char str2[20] = "World";
    
    cout << "str1: " << str1 << endl;
    cout << "str2: " << str2 << endl;
    cout << "Length of str1: " << strlen(str1) << endl;
    
    strcat(str1, " ");
    strcat(str1, str2);
    cout << "Concatenated: " << str1 << endl;
    
    return 0;
}

void swap(int* a, int* b) {
    int temp = *a;
    *a = *b;
    *b = temp;
}

int* createArray(int size) {
    int* arr = new int[size];
    for (int i = 0; i < size; i++) {
        arr[i] = (i + 1) * 10;
    }
    return arr;
}

int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

void printArray(int* arr, int size) {
    for (int i = 0; i < size; i++) {
        cout << arr[i] << " ";
    }
    cout << endl;
}
