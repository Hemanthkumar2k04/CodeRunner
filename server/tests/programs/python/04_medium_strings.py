# Medium-Complex String Processing - Complexity: 4/6
# Tests string operations, regex-like patterns, and text manipulation


def count_words(text):
    """Count word frequency in text"""
    words = text.lower().split()
    word_count = {}
    for word in words:
        # Remove punctuation
        clean_word = "".join(c for c in word if c.isalnum())
        if clean_word:
            word_count[clean_word] = word_count.get(clean_word, 0) + 1
    return word_count


def is_palindrome(text):
    """Check if a string is a palindrome"""
    clean = "".join(c.lower() for c in text if c.isalnum())
    return clean == clean[::-1]


def caesar_cipher(text, shift):
    """Encrypt text using Caesar cipher"""
    result = []
    for char in text:
        if char.isalpha():
            base = ord("A") if char.isupper() else ord("a")
            shifted = (ord(char) - base + shift) % 26 + base
            result.append(chr(shifted))
        else:
            result.append(char)
    return "".join(result)


# Test word counting
sample_text = "The quick brown fox jumps over the lazy dog. The dog was very lazy."
print("Sample text:", sample_text)
word_freq = count_words(sample_text)
print("\nWord frequencies:")
for word, count in sorted(word_freq.items(), key=lambda x: x[1], reverse=True):
    print(f"  {word}: {count}")

# Test palindrome checking
test_strings = ["racecar", "hello", "A man a plan a canal Panama", "python"]
print("\nPalindrome tests:")
for s in test_strings:
    result = "Yes" if is_palindrome(s) else "No"
    print(f"  '{s}': {result}")

# Test Caesar cipher
message = "Hello World"
shift_amount = 3
encrypted = caesar_cipher(message, shift_amount)
decrypted = caesar_cipher(encrypted, -shift_amount)
print(f"\nCaesar Cipher (shift={shift_amount}):")
print(f"  Original: {message}")
print(f"  Encrypted: {encrypted}")
print(f"  Decrypted: {decrypted}")

# List comprehensions
numbers = list(range(1, 21))
squares = [n**2 for n in numbers if n % 2 == 0]
print(f"\nSquares of even numbers (1-20): {squares}")
