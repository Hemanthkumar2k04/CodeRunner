import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudentLoginModal } from '../StudentLoginModal';

// Mock Sonner toast
vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn()
    }
}));

// Mock UI Components to bypass Vite SSR export bugs on shadcn
vi.mock('@/components/ui/button', () => ({
    Button: (props: any) => <button {...props}>{props.children}</button>
}));
vi.mock('@/components/ui/input', () => ({
    Input: (props: any) => <input {...props} />
}));
vi.mock('lucide-react', () => ({
    AlertCircle: () => <svg />,
    CheckCircle2: () => <svg />
}));

describe('StudentLoginModal', () => {
    const mockOnVerified = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn();
    });

    it('should render the login form initially', () => {
        render(<StudentLoginModal onVerified={mockOnVerified} />);
        expect(screen.getByText('CodeRunner Lab Access')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Register Number (e.g. 310620104000)')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Verify Identity' })).toBeInTheDocument();
    });

    it('should not call fetch if register number is empty', async () => {
        render(<StudentLoginModal onVerified={mockOnVerified} />);

        const verifyButton = screen.getByRole('button', { name: 'Verify Identity' });
        fireEvent.click(verifyButton);

        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should show toast error on failed verification', async () => {
        // Mock a failed fetch response
        (global.fetch as any).mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: 'Invalid Register Number' })
        });

        render(<StudentLoginModal onVerified={mockOnVerified} />);

        const input = screen.getByPlaceholderText('Register Number (e.g. 310620104000)');
        fireEvent.change(input, { target: { value: '000000' } });

        const verifyButton = screen.getByRole('button', { name: 'Verify Identity' });
        fireEvent.click(verifyButton);

        await waitFor(() => {
            const { toast } = require('sonner');
            expect(toast.error).toHaveBeenCalledWith('Verification Failed', expect.objectContaining({
                description: 'Invalid Register Number'
            }));
        });

        // Ensure confirmation screen NOT shown
        expect(screen.queryByText('Identity Confirmed')).not.toBeInTheDocument();
    });

    it('should show confirmation screen on successful verification', async () => {
        const student = { regNo: '123', name: 'John Doe', department: 'CSE', year: 'III' };

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => student
        });

        render(<StudentLoginModal onVerified={mockOnVerified} />);

        const input = screen.getByPlaceholderText('Register Number (e.g. 310620104000)');
        fireEvent.change(input, { target: { value: '123' } });

        const verifyButton = screen.getByRole('button', { name: 'Verify Identity' });
        fireEvent.click(verifyButton);

        await waitFor(() => {
            expect(screen.getByText('Identity Confirmed')).toBeInTheDocument();
            expect(screen.getByText('John Doe')).toBeInTheDocument();
            expect(screen.getByText('CSE • Year III')).toBeInTheDocument();
        });
    });

    it('should trigger onVerified when confirmation button is clicked', async () => {
        const student = { regNo: '123', name: 'John Doe', department: 'CSE', year: 'III' };

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => student
        });

        render(<StudentLoginModal onVerified={mockOnVerified} />);

        const input = screen.getByPlaceholderText('Register Number (e.g. 310620104000)');
        fireEvent.change(input, { target: { value: '123' } });

        fireEvent.click(screen.getByRole('button', { name: 'Verify Identity' }));

        // Wait for Confirmation Screen
        await waitFor(() => {
            expect(screen.getByText('Identity Confirmed')).toBeInTheDocument();
        });

        // Click Proceed
        const proceedButton = screen.getByRole('button', { name: 'Proceed to Lab' });
        fireEvent.click(proceedButton);

        expect(mockOnVerified).toHaveBeenCalledWith(student);
    });

    it('should allow user to go back to search if wrong student', async () => {
        const student = { regNo: '123', name: 'John Doe', department: 'CSE', year: 'III' };

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => student
        });

        render(<StudentLoginModal onVerified={mockOnVerified} />);

        const input = screen.getByPlaceholderText('Register Number (e.g. 310620104000)');
        fireEvent.change(input, { target: { value: '123' } });

        fireEvent.click(screen.getByRole('button', { name: 'Verify Identity' }));

        await waitFor(() => {
            expect(screen.getByText('Identity Confirmed')).toBeInTheDocument();
        });

        // Click "Not you?"
        const backButton = screen.getByRole('button', { name: 'Not you? Search again' });
        fireEvent.click(backButton);

        // Should return to login form
        expect(screen.queryByText('Identity Confirmed')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Verify Identity' })).toBeInTheDocument();
    });
});
