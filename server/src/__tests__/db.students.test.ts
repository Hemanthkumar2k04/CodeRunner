import pool, { addStudentsBulk, getStudentByRegNo, getAllStudents, addStudent, updateStudent, deleteStudent } from '../db';
import { logger } from '../logger';

jest.mock('../logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
    }
}));

describe('Database Student Operations', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        // Mock the pool's connect method explicitly to return our custom client
        pool.connect = jest.fn() as any;
    });

    it('addStudentsBulk should execute BEGIN, INSERTs, and COMMIT on success', async () => {
        const mockClient = {
            query: jest.fn()
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockResolvedValueOnce({ rows: [{ id: 1, regNo: '123' }] }) // INSERT 1
                .mockResolvedValueOnce({ rows: [{ id: 2, regNo: '456' }] }) // INSERT 2
                .mockResolvedValueOnce({ rows: [] }), // COMMIT
            release: jest.fn()
        };
        (pool.connect as jest.Mock).mockResolvedValue(mockClient);

        const students = [
            { regNo: '123', name: 'John Doe', department: 'CSE', year: 'III' },
            { regNo: '456', name: 'Jane Doe', department: 'IT', year: 'IV' },
        ];

        const result = await addStudentsBulk(students);

        expect(pool.connect).toHaveBeenCalledTimes(1);
        expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
        expect(mockClient.query).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO students'), ['123', 'John Doe', 'CSE', 'III']);
        expect(mockClient.query).toHaveBeenNthCalledWith(3, expect.stringContaining('INSERT INTO students'), ['456', 'Jane Doe', 'IT', 'IV']);
        expect(mockClient.query).toHaveBeenNthCalledWith(4, 'COMMIT');
        expect(mockClient.release).toHaveBeenCalledTimes(1);
        expect(result).toHaveLength(2);
    });

    it('addStudentsBulk should execute ROLLBACK on error', async () => {
        const mockClient = {
            query: jest.fn()
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockRejectedValueOnce(new Error('DB Error')), // INSERT fails
            release: jest.fn()
        };
        (pool.connect as jest.Mock).mockResolvedValue(mockClient);

        const students = [{ regNo: '123', name: 'John Doe', department: 'CSE', year: 'III' }];

        await expect(addStudentsBulk(students)).rejects.toThrow('DB Error');

        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
        expect(logger.error).toHaveBeenCalled();
        expect(mockClient.release).toHaveBeenCalledTimes(1);
    });
});
