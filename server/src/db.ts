import { Pool } from 'pg';
import { logger } from './logger';

// Read from env, but default to localhost for local testing
const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'coderunner',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
});

// Test connection and initialize tables
export const initDB = async () => {
    try {
        const client = await pool.connect();
        logger.info('Database', 'Connected to PostgreSQL successfully');

        // Create students table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS students (
                id SERIAL PRIMARY KEY,
                reg_no VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                department VARCHAR(100) NOT NULL,
                year VARCHAR(10) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        logger.info('Database', 'Students table verified');

        // Optional: Insert a test student if table is empty (just for development)
        const res = await client.query('SELECT COUNT(*) FROM students');
        if (parseInt(res.rows[0].count) === 0) {
            await client.query(`
                INSERT INTO students (reg_no, name, department, year)
                VALUES ('TEST001', 'Test Student', 'Computer Science', 'III')
            `);
            logger.info('Database', 'Inserted test student record (TEST001)');
        }

        client.release();
    } catch (err) {
        logger.error('Database', `PostgreSQL connection error: ${err}`);
        // We might not want to crash the whole server if DB is down locally, 
        // but let's log it strongly.
    }
};

export const getStudentByRegNo = async (regNo: string) => {
    try {
        const result = await pool.query(
            'SELECT id, reg_no as "regNo", name, department, year, created_at FROM students WHERE reg_no = $1',
            [regNo]
        );
        return result.rows[0] || null;
    } catch (err) {
        logger.error('Database', `Error fetching student: ${err}`);
        throw err;
    }
};

export const getAllStudents = async () => {
    try {
        const result = await pool.query(
            'SELECT id, reg_no as "regNo", name, department, year, created_at FROM students ORDER BY created_at DESC'
        );
        return result.rows;
    } catch (err) {
        logger.error('Database', `Error fetching all students: ${err}`);
        throw err;
    }
};

export const addStudent = async (regNo: string, name: string, department: string, year: string) => {
    try {
        const result = await pool.query(
            'INSERT INTO students (reg_no, name, department, year) VALUES ($1, $2, $3, $4) RETURNING id, reg_no as "regNo", name, department, year, created_at',
            [regNo, name, department, year]
        );
        return result.rows[0];
    } catch (err) {
        logger.error('Database', `Error adding student: ${err}`);
        throw err;
    }
};

export const updateStudent = async (id: number, regNo: string, name: string, department: string, year: string) => {
    try {
        const result = await pool.query(
            'UPDATE students SET reg_no = $1, name = $2, department = $3, year = $4 WHERE id = $5 RETURNING id, reg_no as "regNo", name, department, year, created_at',
            [regNo, name, department, year, id]
        );
        return result.rows[0];
    } catch (err) {
        logger.error('Database', `Error updating student: ${err}`);
        throw err;
    }
};

export const deleteStudent = async (id: number) => {
    try {
        const result = await pool.query(
            'DELETE FROM students WHERE id = $1 RETURNING id',
            [id]
        );
        return result.rows.length > 0;
    } catch (err) {
        logger.error('Database', `Error deleting student: ${err}`);
        throw err;
    }
};

export const addStudentsBulk = async (students: { regNo: string, name: string, department: string, year: string }[]) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const inserted = [];
        for (const student of students) {
            const result = await client.query(
                `INSERT INTO students (reg_no, name, department, year) 
                 VALUES ($1, $2, $3, $4) 
                 ON CONFLICT (reg_no) DO UPDATE 
                 SET name = EXCLUDED.name, department = EXCLUDED.department, year = EXCLUDED.year 
                 RETURNING id, reg_no as "regNo", name, department, year, created_at`,
                [student.regNo, student.name, student.department, student.year]
            );
            inserted.push(result.rows[0]);
        }
        await client.query('COMMIT');
        return inserted;
    } catch (err) {
        await client.query('ROLLBACK');
        logger.error('Database', `Error in bulk add: ${err}`);
        throw err;
    } finally {
        client.release();
    }
};

export default pool;
