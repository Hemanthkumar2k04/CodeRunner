-- Medium-Complex Subqueries - Complexity: 4/6
-- Tests subqueries, IN, EXISTS, and nested SELECT statements

-- Create tables
CREATE TABLE IF NOT EXISTS employees (
    emp_id INT PRIMARY KEY,
    name VARCHAR(100),
    department VARCHAR(50),
    salary DECIMAL(10,2),
    manager_id INT
);

-- Insert data
INSERT INTO employees (emp_id, name, department, salary, manager_id) VALUES
(1, 'Alice Johnson', 'Engineering', 95000, NULL),
(2, 'Bob Smith', 'Engineering', 85000, 1),
(3, 'Charlie Brown', 'Sales', 75000, NULL),
(4, 'Diana Prince', 'Sales', 80000, 3),
(5, 'Eve Davis', 'Engineering', 90000, 1),
(6, 'Frank Miller', 'HR', 70000, NULL),
(7, 'Grace Lee', 'Engineering', 82000, 1);

-- Subquery in WHERE
SELECT name, salary
FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees);

-- Subquery with IN
SELECT name, department
FROM employees
WHERE department IN (
    SELECT department
    FROM employees
    GROUP BY department
    HAVING COUNT(*) >= 3
);

-- Subquery with EXISTS
SELECT e1.name, e1.department
FROM employees e1
WHERE EXISTS (
    SELECT 1
    FROM employees e2
    WHERE e2.manager_id = e1.emp_id
);

-- Correlated subquery
SELECT 
    e.name,
    e.salary,
    e.department,
    (SELECT AVG(salary) 
     FROM employees 
     WHERE department = e.department) as dept_avg_salary
FROM employees e;

-- Find employees earning more than their department average
SELECT name, department, salary
FROM employees e1
WHERE salary > (
    SELECT AVG(salary)
    FROM employees e2
    WHERE e2.department = e1.department
);

-- Subquery in FROM clause
SELECT dept, avg_sal, max_sal
FROM (
    SELECT 
        department as dept,
        AVG(salary) as avg_sal,
        MAX(salary) as max_sal
    FROM employees
    GROUP BY department
) as dept_stats
WHERE avg_sal > 80000;

-- Clean up
DROP TABLE employees;
