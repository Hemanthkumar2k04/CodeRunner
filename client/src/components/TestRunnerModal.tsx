/**
 * Test Runner Modal
 * UI for triggering and monitoring load tests from the admin dashboard
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { PlayCircle, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { connectSocket, waitForConnection, getSocket } from '../lib/socket';
import { cn } from '../lib/utils';

interface TestProgress {
  current: number;
  total: number;
  language?: string;
  type?: string;
  status: 'running' | 'complete' | 'error';
  message?: string;
}

interface TestResult {
  testId: string;
  reportId: string;
  duration: number;
  summary?: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    avgResponseTime: number;
  };
}

interface TestRunnerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AVAILABLE_LANGUAGES = [
  { id: 'python', name: 'Python', color: 'bg-blue-500' },
  { id: 'javascript', name: 'JavaScript', color: 'bg-yellow-500' },
  { id: 'java', name: 'Java', color: 'bg-red-500' },
  { id: 'cpp', name: 'C++', color: 'bg-purple-500' },
] as const;

export function TestRunnerModal({ open, onOpenChange }: TestRunnerModalProps) {
  const [intensity, setIntensity] = useState<string>('light');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<TestProgress | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize socket connection when modal opens
  useEffect(() => {
    if (open) {
      connectSocket();
    }
  }, [open]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('loadtest:started', () => {
      setIsRunning(true);
      setError(null);
      setResult(null);
      setProgress({ current: 0, total: 10, status: 'running', message: 'Initializing...' });
    });

    socket.on('loadtest:progress', (data: TestProgress & { testId: string }) => {
      setProgress(data);
    });

    socket.on('loadtest:complete', (data: TestResult) => {
      setResult(data);
      setIsRunning(false);
      if (data.summary) {
        setProgress({ current: data.summary.totalRequests, total: data.summary.totalRequests, status: 'complete' });
      }
    });

    socket.on('loadtest:error', (data: { testId?: string; error: string }) => {
      setError(data.error);
      setIsRunning(false);
    });

    return () => {
      socket.off('loadtest:started');
      socket.off('loadtest:progress');
      socket.off('loadtest:complete');
      socket.off('loadtest:error');
    };
  }, [open]);

  const handleStart = async () => {
    console.log('[TestRunnerModal] handleStart called, intensity:', intensity, 'languages:', selectedLanguages);
    
    // Validate language selection
    if (selectedLanguages.length === 0) {
      setError('Please select at least one language');
      return;
    }
    
    setError(null);
    
    // Ensure socket is connected
    console.log('[TestRunnerModal] Waiting for connection...');
    const connected = await waitForConnection();
    console.log('[TestRunnerModal] Connection status:', connected);
    
    if (!connected) {
      setError('Failed to connect to server. Please check if the server is running.');
      return;
    }

    const socket = getSocket();
    console.log('[TestRunnerModal] Socket:', socket?.id);
    
    if (!socket) {
      setError('Socket connection not available');
      return;
    }

    console.log('[TestRunnerModal] Emitting loadtest:start event');
    socket.emit('loadtest:start', { intensity, languages: selectedLanguages });
  };

  const handleClose = () => {
    if (!isRunning) {
      onOpenChange(false);
      // Reset state when closing
      setTimeout(() => {
        setProgress(null);
        setResult(null);
        setError(null);
        setSelectedLanguages([]);
      }, 300);
    }
  };

  const toggleLanguage = (langId: string) => {
    if (multiSelectMode) {
      setSelectedLanguages(prev => 
        prev.includes(langId) 
          ? prev.filter(id => id !== langId)
          : [...prev, langId]
      );
    } else {
      setSelectedLanguages([langId]);
    }
  };

  const toggleSelectMode = () => {
    setMultiSelectMode(!multiSelectMode);
    if (!multiSelectMode && selectedLanguages.length > 1) {
      // When switching to single-select, keep only the first selected language
      setSelectedLanguages(selectedLanguages.slice(0, 1));
    }
  };

  const progressPercentage = progress 
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Performance Load Test Runner</DialogTitle>
          <DialogDescription>
            Run comprehensive load tests on selected languages
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Language Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Select Languages</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSelectMode}
                disabled={isRunning}
                className="h-8 text-xs"
              >
                {multiSelectMode ? 'Single Select' : 'Multi Select'}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_LANGUAGES.map(lang => (
                <button
                  key={lang.id}
                  onClick={() => toggleLanguage(lang.id)}
                  disabled={isRunning}
                  className={cn(
                    'flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all',
                    'hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed',
                    selectedLanguages.includes(lang.id)
                      ? 'border-primary bg-primary/10 font-medium'
                      : 'border-border bg-background'
                  )}
                >
                  <div className={cn('w-3 h-3 rounded-full', lang.color)} />
                  <span className="text-sm">{lang.name}</span>
                </button>
              ))}
            </div>
            {selectedLanguages.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Selected: {selectedLanguages.map(id => 
                  AVAILABLE_LANGUAGES.find(l => l.id === id)?.name
                ).join(', ')}
                {' '}({selectedLanguages.length * 2} tests: 1 simple + 1 complex per language)
              </div>
            )}
          </div>

          {/* Intensity Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Test Intensity</label>
            <Select
              value={intensity}
              onValueChange={setIntensity}
              disabled={isRunning}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-500 hover:bg-green-600 text-white">Light</Badge>
                    <span className="text-sm">10 connections, 30s duration</span>
                  </div>
                </SelectItem>
                <SelectItem value="moderate">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">Moderate</Badge>
                    <span className="text-sm">50 connections, 60s duration</span>
                  </div>
                </SelectItem>
                <SelectItem value="heavy">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-500 hover:bg-red-600 text-white">Heavy</Badge>
                    <span className="text-sm">100 connections, 90s duration</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Progress Display */}
          {progress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {progress.language && progress.type 
                    ? `Testing ${progress.language} (${progress.type})`
                    : progress.message || 'Running tests...'}
                </span>
                <span className="text-muted-foreground">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
              <div className="text-xs text-muted-foreground text-right">
                {progressPercentage}% complete
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Results Display */}
          {result && result.summary && (
            <div className="space-y-4 rounded-lg border p-4 bg-muted/50">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold">Test Complete</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Total Requests</div>
                  <div className="text-2xl font-bold">{result.summary.totalRequests}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Success Rate</div>
                  <div className="text-2xl font-bold">{result.summary.successRate.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Successful</div>
                  <div className="text-lg font-semibold text-green-600">
                    {result.summary.successfulRequests}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                  <div className="text-lg font-semibold text-red-600">
                    {result.summary.failedRequests}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Avg Response Time</div>
                  <div className="text-lg font-semibold">{result.summary.avgResponseTime}ms</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Duration</div>
                  <div className="text-lg font-semibold">{(result.duration / 1000).toFixed(1)}s</div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground pt-2 border-t">
                Report ID: {result.reportId}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isRunning}
            >
              {result ? 'Close' : 'Cancel'}
            </Button>
            
            {!result && (
              <Button
                onClick={handleStart}
                disabled={isRunning}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running Test...
                  </>
                ) : (
                  <>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Start Test
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
