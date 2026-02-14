-- Simple JOIN Query - Complexity: 2/6
-- Tests basic JOIN operations

-- Create tables
CREATE TABLE IF NOT EXISTS customers (
    customer_id INT PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS orders (
    order_id INT PRIMARY KEY,
    customer_id INT,
    total DECIMAL(10,2),
    order_date DATE
);

-- Insert data
INSERT INTO customers (customer_id, name, email) VALUES
(1, 'Alice Johnson', 'alice@email.com'),
(2, 'Bob Smith', 'bob@email.com'),
(3, 'Charlie Brown', 'charlie@email.com');

INSERT INTO orders (order_id, customer_id, total, order_date) VALUES
(101, 1, 150.00, '2026-01-15'),
(102, 2, 200.50, '2026-01-16'),
(103, 1, 75.25, '2026-01-17'),
(104, 3, 300.00, '2026-01-18');

-- INNER JOIN
SELECT c.name, o.order_id, o.total, o.order_date
FROM customers c
INNER JOIN orders o ON c.customer_id = o.customer_id;

-- Count orders per customer
SELECT c.name, COUNT(o.order_id) as order_count
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_id, c.name;

-- Clean up
DROP TABLE orders;
DROP TABLE customers;
