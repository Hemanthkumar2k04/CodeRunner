-- Complex Multiple JOINs - Complexity: 5/6
-- Tests complex JOIN scenarios with multiple tables

-- Create tables
CREATE TABLE IF NOT EXISTS students (
    student_id INT PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS courses (
    course_id INT PRIMARY KEY,
    course_name VARCHAR(100),
    credits INT
);

CREATE TABLE IF NOT EXISTS enrollments (
    enrollment_id INT PRIMARY KEY,
    student_id INT,
    course_id INT,
    grade VARCHAR(2),
    semester VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS instructors (
    instructor_id INT PRIMARY KEY,
    name VARCHAR(100),
    course_id INT
);

-- Insert data
INSERT INTO students (student_id, name, email) VALUES
(1, 'Alice Smith', 'alice@university.edu'),
(2, 'Bob Johnson', 'bob@university.edu'),
(3, 'Charlie Brown', 'charlie@university.edu'),
(4, 'Diana Prince', 'diana@university.edu');

INSERT INTO courses (course_id, course_name, credits) VALUES
(101, 'Database Systems', 3),
(102, 'Algorithms', 4),
(103, 'Web Development', 3),
(104, 'Machine Learning', 4);

INSERT INTO enrollments (enrollment_id, student_id, course_id, grade, semester) VALUES
(1, 1, 101, 'A', 'Spring 2026'),
(2, 1, 102, 'B+', 'Spring 2026'),
(3, 2, 101, 'B', 'Spring 2026'),
(4, 2, 103, 'A-', 'Spring 2026'),
(5, 3, 102, 'A', 'Spring 2026'),
(6, 3, 104, 'B+', 'Spring 2026'),
(7, 4, 103, 'A', 'Spring 2026');

INSERT INTO instructors (instructor_id, name, course_id) VALUES
(1, 'Dr. Wilson', 101),
(2, 'Prof. Anderson', 102),
(3, 'Dr. Martinez', 103),
(4, 'Prof. Taylor', 104);

-- Three-way JOIN
SELECT 
    s.name as student_name,
    c.course_name,
    e.grade,
    i.name as instructor_name
FROM students s
INNER JOIN enrollments e ON s.student_id = e.student_id
INNER JOIN courses c ON e.course_id = c.course_id
INNER JOIN instructors i ON c.course_id = i.course_id
ORDER BY s.name, c.course_name;

-- Student course count with LEFT JOIN
SELECT 
    s.name,
    s.email,
    COUNT(e.enrollment_id) as courses_enrolled,
    SUM(c.credits) as total_credits
FROM students s
LEFT JOIN enrollments e ON s.student_id = e.student_id
LEFT JOIN courses c ON e.course_id = c.course_id
GROUP BY s.student_id, s.name, s.email;

-- Courses with enrollment count
SELECT 
    c.course_name,
    c.credits,
    i.name as instructor,
    COUNT(e.enrollment_id) as num_students
FROM courses c
LEFT JOIN enrollments e ON c.course_id = e.course_id
LEFT JOIN instructors i ON c.course_id = i.course_id
GROUP BY c.course_id, c.course_name, c.credits, i.name;

-- Students with all their courses
SELECT 
    s.name as student,
    GROUP_CONCAT(c.course_name SEPARATOR ', ') as enrolled_courses,
    COUNT(e.enrollment_id) as course_count
FROM students s
LEFT JOIN enrollments e ON s.student_id = e.student_id
LEFT JOIN courses c ON e.course_id = c.course_id
GROUP BY s.student_id, s.name
HAVING course_count > 0;

-- Clean up
DROP TABLE instructors;
DROP TABLE enrollments;
DROP TABLE courses;
DROP TABLE students;
