-- Complex Window Functions and Advanced Queries - Complexity: 6/6
-- Tests window functions, CTEs, and advanced SQL features

-- Create table
CREATE TABLE IF NOT EXISTS transactions (
    transaction_id INT PRIMARY KEY,
    customer_id INT,
    amount DECIMAL(10,2),
    transaction_date DATE,
    category VARCHAR(50)
);

-- Insert data
INSERT INTO transactions VALUES
(1, 101, 150.00, '2026-01-01', 'Electronics'),
(2, 102, 200.50, '2026-01-02', 'Clothing'),
(3, 101, 75.25, '2026-01-03', 'Food'),
(4, 103, 300.00, '2026-01-04', 'Electronics'),
(5, 102, 50.00, '2026-01-05', 'Food'),
(6, 101, 120.00, '2026-01-06', 'Clothing'),
(7, 103, 180.00, '2026-01-07', 'Electronics'),
(8, 104, 90.00, '2026-01-08', 'Food'),
(9, 102, 220.00, '2026-01-09', 'Electronics'),
(10, 101, 65.00, '2026-01-10', 'Food');

-- Running total per customer
SELECT 
    transaction_id,
    customer_id,
    amount,
    transaction_date,
    SUM(amount) OVER (PARTITION BY customer_id ORDER BY transaction_date) as running_total
FROM transactions
ORDER BY customer_id, transaction_date;

-- Rank transactions by amount
SELECT 
    transaction_id,
    customer_id,
    amount,
    category,
    RANK() OVER (ORDER BY amount DESC) as amount_rank,
    DENSE_RANK() OVER (PARTITION BY category ORDER BY amount DESC) as category_rank
FROM transactions;

-- Moving average
SELECT 
    transaction_id,
    customer_id,
    amount,
    transaction_date,
    AVG(amount) OVER (
        PARTITION BY customer_id 
        ORDER BY transaction_date 
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) as moving_avg_3
FROM transactions
ORDER BY customer_id, transaction_date;

-- Lead and lag functions
SELECT 
    transaction_id,
    customer_id,
    amount,
    LAG(amount) OVER (PARTITION BY customer_id ORDER BY transaction_date) as prev_amount,
    LEAD(amount) OVER (PARTITION BY customer_id ORDER BY transaction_date) as next_amount,
    amount - LAG(amount) OVER (PARTITION BY customer_id ORDER BY transaction_date) as diff_from_prev
FROM transactions;

-- Category statistics with window functions
SELECT DISTINCT
    category,
    COUNT(*) OVER (PARTITION BY category) as transaction_count,
    SUM(amount) OVER (PARTITION BY category) as category_total,
    AVG(amount) OVER (PARTITION BY category) as category_avg,
    MAX(amount) OVER (PARTITION BY category) as category_max
FROM transactions
ORDER BY category;

-- Customer spending analysis
SELECT 
    customer_id,
    COUNT(*) as transaction_count,
    SUM(amount) as total_spent,
    AVG(amount) as avg_transaction,
    MAX(amount) as largest_transaction,
    MIN(amount) as smallest_transaction
FROM transactions
GROUP BY customer_id
ORDER BY total_spent DESC;

-- Find top spending customer per category
SELECT 
    category,
    customer_id,
    total_amount
FROM (
    SELECT 
        category,
        customer_id,
        SUM(amount) as total_amount,
        RANK() OVER (PARTITION BY category ORDER BY SUM(amount) DESC) as rnk
    FROM transactions
    GROUP BY category, customer_id
) ranked
WHERE rnk = 1;

-- Clean up
DROP TABLE transactions;
