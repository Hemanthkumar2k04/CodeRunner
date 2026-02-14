-- Simple SELECT Query - Complexity: 1/6
-- Tests basic SELECT statement

-- Create a simple table
CREATE TABLE IF NOT EXISTS products (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    price DECIMAL(10,2)
);

-- Insert sample data
INSERT INTO products (id, name, price) VALUES 
(1, 'Laptop', 999.99),
(2, 'Mouse', 25.50),
(3, 'Keyboard', 75.00),
(4, 'Monitor', 299.99),
(5, 'Webcam', 89.99);

-- Simple SELECT
SELECT * FROM products;

-- SELECT with WHERE
SELECT name, price FROM products WHERE price < 100;

-- Clean up
DROP TABLE products;
