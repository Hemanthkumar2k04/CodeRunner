-- Medium Aggregate Functions - Complexity: 3/6
-- Tests GROUP BY, HAVING, and aggregate functions

-- Create table
CREATE TABLE IF NOT EXISTS sales (
    sale_id INT PRIMARY KEY,
    product VARCHAR(100),
    category VARCHAR(50),
    quantity INT,
    price DECIMAL(10,2),
    sale_date DATE
);

-- Insert data
INSERT INTO sales (sale_id, product, category, quantity, price, sale_date) VALUES
(1, 'Laptop', 'Electronics', 2, 999.99, '2026-01-15'),
(2, 'Mouse', 'Electronics', 5, 25.50, '2026-01-15'),
(3, 'Desk', 'Furniture', 1, 450.00, '2026-01-16'),
(4, 'Chair', 'Furniture', 3, 200.00, '2026-01-16'),
(5, 'Monitor', 'Electronics', 2, 299.99, '2026-01-17'),
(6, 'Keyboard', 'Electronics', 4, 75.00, '2026-01-17'),
(7, 'Table', 'Furniture', 1, 350.00, '2026-01-18');

-- Aggregate functions
SELECT 
    COUNT(*) as total_sales,
    SUM(quantity) as total_items,
    AVG(price) as avg_price,
    MAX(price) as max_price,
    MIN(price) as min_price
FROM sales;

-- GROUP BY category
SELECT 
    category,
    COUNT(*) as num_sales,
    SUM(quantity * price) as total_revenue,
    AVG(price) as avg_price
FROM sales
GROUP BY category;

-- HAVING clause
SELECT 
    category,
    SUM(quantity * price) as total_revenue
FROM sales
GROUP BY category
HAVING SUM(quantity * price) > 500
ORDER BY total_revenue DESC;

-- Sales by date
SELECT 
    sale_date,
    COUNT(*) as transactions,
    SUM(quantity * price) as daily_revenue
FROM sales
GROUP BY sale_date
ORDER BY sale_date;

-- Clean up
DROP TABLE sales;
