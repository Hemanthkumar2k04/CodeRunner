import express from 'express';
import request from 'supertest';
import { getStudentByRegNo } from '../db';
import { logger } from '../logger';

// Mock DB and Logger
jest.mock('../db', () => ({
    getStudentByRegNo: jest.fn()
}));
jest.mock('../logger', () => ({
    logger: { info: jest.fn(), error: jest.fn() }
}));

// Setup Express App for Testing Route
const app = express();
app.use(express.json());

// Import the specific route to test (we manually attach it for isolated testing)
app.post('/api/verify-student', async (req, res) => {
    const { regNo } = req.body;
    try {
        if (!regNo) {
            return res.status(400).json({ error: 'Register Number is required' });
        }

        const student = await getStudentByRegNo(regNo);
        if (student) {
            res.json(student);
        } else {
            res.status(404).json({ error: 'Student not found in database. Please contact your instructor.' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Internal server error while verifying student' });
    }
});

describe('POST /api/verify-student', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return 400 if regNo is missing', async () => {
        const res = await request(app).post('/api/verify-student').send({});
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Register Number is required' });
    });

    it('should return 404 if student does not exist', async () => {
        (getStudentByRegNo as jest.Mock).mockResolvedValue(null);

        const res = await request(app).post('/api/verify-student').send({ regNo: 'INVALID123' });
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Student not found in database. Please contact your instructor.' });
    });

    it('should return 200 and student details on success', async () => {
        const mockStudent = { id: 1, regNo: '310623104055', name: 'Hemanthkumar K', department: 'CSE', year: 'III' };
        (getStudentByRegNo as jest.Mock).mockResolvedValue(mockStudent);

        const res = await request(app).post('/api/verify-student').send({ regNo: '310623104055' });
        expect(res.status).toBe(200);
        expect(res.body).toEqual(mockStudent);
    });

    it('should return 500 if DB throws an error', async () => {
        (getStudentByRegNo as jest.Mock).mockRejectedValue(new Error('Connection timeout'));

        const res = await request(app).post('/api/verify-student').send({ regNo: 'ERROR123' });
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Internal server error while verifying student' });
    });
});
