import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface StudentLoginModalProps {
    onVerified: (student: { regNo: string; name: string; department: string; year: string }) => void;
}

export function StudentLoginModal({ onVerified }: StudentLoginModalProps) {
    const [regNo, setRegNo] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [studentData, setStudentData] = useState<{ regNo: string; name: string; department: string; year: string } | null>(null);

    const handleVerify = async () => {
        if (!regNo.trim()) return;
        setIsLoading(true);

        try {
            const response = await fetch('/api/verify-student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ regNo: regNo.trim() }),
            });

            const data = await response.json();

            if (!response.ok) {
                toast.error('Verification Failed', {
                    description: data.error || 'Invalid Register Number',
                });
            } else {
                setStudentData(data);
            }
        } catch (err) {
            toast.error('Error', {
                description: 'Failed to contact the server. Please try again later.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirm = () => {
        if (studentData) {
            onVerified(studentData);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
            <div className="w-full max-w-md p-8 bg-card border shadow-xl rounded-xl">
                <h2 className="text-2xl font-bold mb-6 text-center text-foreground">
                    CodeRunner Lab Access
                </h2>

                {!studentData ? (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground text-center">
                            Please enter your Register Number to access the editor.
                        </p>
                        <Input
                            placeholder="e.g. 310621104000"
                            value={regNo}
                            onChange={(e) => setRegNo(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                            className="w-full text-center text-lg"
                            autoFocus
                        />
                        <Button
                            className="w-full"
                            size="lg"
                            onClick={handleVerify}
                            disabled={isLoading || !regNo.trim()}
                        >
                            {isLoading ? 'Verifying...' : 'Verify Identity'}
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex flex-col items-center justify-center space-y-2 text-center">
                            <CheckCircle2 className="h-12 w-12 text-green-500 mb-2" />
                            <p className="font-semibold text-lg text-foreground">{studentData.name}</p>
                            <p className="text-muted-foreground">{studentData.regNo}</p>
                            <p className="text-sm text-muted-foreground">{studentData.department} • Year {studentData.year}</p>
                        </div>

                        <div className="bg-muted/50 p-4 rounded-lg text-sm flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                            <p className="text-muted-foreground">
                                By confirming, you agree to enter <strong>Fullscreen Mode</strong>. Exiting fullscreen will temporarily lock the editor.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <Button
                                variant="outline"
                                className="w-full sm:w-1/2"
                                onClick={() => setStudentData(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="w-full sm:w-1/2 bg-primary hover:bg-primary/90"
                                onClick={handleConfirm}
                            >
                                Confirm & Start
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
