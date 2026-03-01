import express from 'express';
import request from 'supertest';
import { logger } from '../logger';

const MOCK_ADMIN_KEY = 'test-admin-key';
process.env.ADMIN_KEY = MOCK_ADMIN_KEY;

// Must require adminRoutes AFTER setting the env variable!
import adminRoutes from '../adminRoutes';



// Mock the DB methods used inside adminRoutes
const mockDb = {
    getAllStudents: jest.fn(),
    addStudent: jest.fn(),
    addStudentsBulk: jest.fn(),
    updateStudent: jest.fn(),
    deleteStudent: jest.fn()
};

jest.mock('../db', () => mockDb);

jest.mock('../logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const app = express();
app.use(express.json());
app.use('/admin', adminRoutes);

describe('Admin Student Routes (/admin/students)', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const authHeader = { 'x-admin-key': MOCK_ADMIN_KEY };

    describe('GET /admin/students', () => {
        it('should return 401 without admin key', async () => {
            const res = await request(app).get('/admin/students');
            expect(res.status).toBe(401);
        });

        it('should return all students', async () => {
            const students = [{ regNo: '123', name: 'A', department: 'CS', year: 'I' }];
            mockDb.getAllStudents.mockResolvedValue(students);

            const res = await request(app).get('/admin/students').set(authHeader);
            expect(res.status).toBe(200);
            expect(res.body).toEqual(students);
        });
    });

    describe('POST /admin/students', () => {
        it('should require all fields', async () => {
            const res = await request(app)
                .post('/admin/students')
                .set(authHeader)
                .send({ regNo: '123' }); // missing name, dept, year

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/Missing required/i);
        });

        it('should return 409 if register number exists', async () => {
            mockDb.addStudent.mockRejectedValue({ code: '23505' });

            const res = await request(app)
                .post('/admin/students')
                .set(authHeader)
                .send({ regNo: '123', name: 'A', department: 'CS', year: 'I' });

            expect(res.status).toBe(409);
        });

        it('should add a student successfully', async () => {
            const student = { regNo: '123', name: 'A', department: 'CS', year: 'I' };
            mockDb.addStudent.mockResolvedValue(student);

            const res = await request(app)
                .post('/admin/students')
                .set(authHeader)
                .send(student);

            expect(res.status).toBe(201);
            expect(res.body).toEqual(student);
        });
    });

    describe('POST /admin/students/bulk', () => {
        it('should reject invalid or missing array', async () => {
            const res = await request(app)
                .post('/admin/students/bulk')
                .set(authHeader)
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/Missing or empty/i);
        });

        it('should reject if any student is missing fields', async () => {
            const res = await request(app)
                .post('/admin/students/bulk')
                .set(authHeader)
                .send({
                    students: [
                        { regNo: '123', name: 'A', department: 'CS', year: 'I' },
                        { regNo: '456' } // missing fields
                    ]
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/missing required fields/i);
        });

        it('should upsert students successfully', async () => {
            const students = [
                { regNo: '123', name: 'A', department: 'CS', year: 'I' },
                { regNo: '456', name: 'B', department: 'IT', year: 'II' }
            ];
            mockDb.addStudentsBulk.mockResolvedValue(students);

            const res = await request(app)
                .post('/admin/students/bulk')
                .set(authHeader)
                .send({ students });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.count).toBe(2);
        });
    });
});
