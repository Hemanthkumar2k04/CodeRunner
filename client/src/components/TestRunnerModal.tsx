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
import { PlayCircle, AlertCircle, CheckCircle2, Loader2, Clock, Zap, Activity, BarChart3, XCircle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
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

interface LatencyMetrics {
  mean: number;
  p50: number;
  p95: number;
  p99: number;
}

interface TestSummary {
  requests: number;
  errors: number;
  timeouts: number;
  successRate: number;
  requestsPerSecond: number;
  latency: LatencyMetrics | null;
  throughputMBps: number;
  program: string | null;
  error?: string;
}

interface LanguageResults {
  simple: TestSummary;
  complex: TestSummary;
}

interface TestResult {
  testId: string;
  reportId: string;
  duration: number;
  summary?: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalErrors: number;
    totalTimeouts: number;
    successRate: number;
    avgResponseTime: number;
    latency: LatencyMetrics;
    avgRequestsPerSecond: number;
    totalThroughputMB: number;
    languageCount: number;
    testCount: number;
    perLanguage: Record<string, LanguageResults>;
  };
}

interface TestRunnerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AVAILABLE_LANGUAGES = [
  { id: 'python', name: 'Python', color: 'bg-blue-500', hex: '#3b82f6' },
  { id: 'javascript', name: 'JavaScript', color: 'bg-yellow-500', hex: '#eab308' },
  { id: 'java', name: 'Java', color: 'bg-red-500', hex: '#ef4444' },
  { id: 'cpp', name: 'C++', color: 'bg-purple-500', hex: '#a855f7' },
] as const;

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'hsl(var(--card))',
    borderRadius: '8px',
    border: '1px solid hsl(var(--border))',
    fontSize: '12px',
  },
};

export function TestRunnerModal({ open, onOpenChange }: TestRunnerModalProps) {
  const [intensity, setIntensity] = useState<string>('light');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<TestProgress | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      connectSocket();
    }
  }, [open]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('loadtest:started', (data: { testId: string }) => {
      setActiveTestId(data.testId);
      setIsRunning(true);
      setError(null);
      setResult(null);
      setProgress({ current: 0, total: selectedLanguages.length * 2, status: 'running', message: 'Initializing...' });
    });

    socket.on('loadtest:progress', (data: TestProgress & { testId: string }) => {
      setProgress(prev => ({ ...prev, ...data }));
    });

    socket.on('loadtest:complete', (data: TestResult) => {
      setResult(data);
      setIsRunning(false);
      setActiveTestId(null);
      if (data.summary) {
        setProgress({ current: data.summary.testCount, total: data.summary.testCount, status: 'complete' });
      }
    });

    socket.on('loadtest:error', (data: { testId?: string; error: string }) => {
      setError(data.error);
      setIsRunning(false);
      setActiveTestId(null);
    });

    return () => {
      socket.off('loadtest:started');
      socket.off('loadtest:progress');
      socket.off('loadtest:complete');
      socket.off('loadtest:error');
    };
  }, [open, selectedLanguages.length]);

  const handleStart = async () => {
    if (selectedLanguages.length === 0) {
      setError('Please select at least one language');
      return;
    }

    setError(null);
    const connected = await waitForConnection();

    if (!connected) {
      setError('Failed to connect to server. Please check if the server is running.');
      return;
    }

    const socket = getSocket();
    if (!socket) {
      setError('Socket connection not available');
      return;
    }

    socket.emit('loadtest:start', { intensity, languages: selectedLanguages });
  };

  const handleCancel = () => {
    if (activeTestId) {
      const socket = getSocket();
      socket?.emit('loadtest:stop', { testId: activeTestId });
    }
  };

  const handleClose = () => {
    if (!isRunning) {
      onOpenChange(false);
      setTimeout(() => {
        setProgress(null);
        setResult(null);
        setError(null);
        setSelectedLanguages([]);
        setActiveTestId(null);
      }, 300);
    }
  };

  const toggleLanguage = (langId: string) => {
    setSelectedLanguages(prev =>
      prev.includes(langId)
        ? prev.filter(id => id !== langId)
        : [...prev, langId]
    );
  };

  const progressPercentage = progress
    ? Math.min(Math.round((progress.current / Math.max(progress.total, 1)) * 100), 100)
    : 0;

  // Build chart data from per-language results
  const buildLatencyChartData = () => {
    if (!result?.summary?.perLanguage) return [];
    return Object.entries(result.summary.perLanguage).flatMap(([lang, data]) => {
      const langInfo = AVAILABLE_LANGUAGES.find(l => l.id === lang);
      const items: { name: string; p50: number; p95: number; p99: number; fill: string }[] = [];
      if (data.simple?.latency) {
        items.push({
          name: `${langInfo?.name || lang} (S)`,
          p50: data.simple.latency.p50,
          p95: data.simple.latency.p95,
          p99: data.simple.latency.p99,
          fill: langInfo?.hex || '#666',
        });
      }
      if (data.complex?.latency) {
        items.push({
          name: `${langInfo?.name || lang} (C)`,
          p50: data.complex.latency.p50,
          p95: data.complex.latency.p95,
          p99: data.complex.latency.p99,
          fill: langInfo?.hex || '#666',
        });
      }
      return items;
    });
  };

  const buildReqsChartData = () => {
    if (!result?.summary?.perLanguage) return [];
    return Object.entries(result.summary.perLanguage).flatMap(([lang, data]) => {
      const langInfo = AVAILABLE_LANGUAGES.find(l => l.id === lang);
      const items: { name: string; reqsPerSec: number; fill: string }[] = [];
      if (data.simple && !('error' in data.simple && !data.simple.latency)) {
        items.push({
          name: `${langInfo?.name || lang} (S)`,
          reqsPerSec: data.simple.requestsPerSecond,
          fill: langInfo?.hex || '#666',
        });
      }
      if (data.complex && !('error' in data.complex && !data.complex.latency)) {
        items.push({
          name: `${langInfo?.name || lang} (C)`,
          reqsPerSec: data.complex.requestsPerSecond,
          fill: langInfo?.hex || '#666',
        });
      }
      return items;
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Performance Load Test</DialogTitle>
          <DialogDescription>
            Run load tests against code execution endpoints to benchmark performance
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Language Selection */}
          {!result && (
            <div className="space-y-3">
              <label className="text-sm font-medium">Select Languages</label>
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
                  {selectedLanguages.length * 2} tests: 1 simple + 1 complex per language
                </div>
              )}
            </div>
          )}

          {/* Intensity Selector */}
          {!result && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Test Intensity</label>
              <Select value={intensity} onValueChange={setIntensity} disabled={isRunning}>
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
          )}

          {/* Progress Display */}
          {progress && progress.status !== 'complete' && (
            <div className="space-y-2 rounded-lg border p-4 bg-muted/30">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {progress.language
                    ? `Testing ${progress.language}${progress.type ? ` (${progress.type})` : ''}`
                    : progress.message || 'Running tests...'}
                </span>
                <span className="text-muted-foreground font-mono">
                  {progress.current}/{progress.total}
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
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold">Test Complete</h3>
                <span className="text-xs text-muted-foreground ml-auto">
                  {result.summary.testCount} tests &middot; {result.summary.languageCount} language(s) &middot; {(result.duration / 1000).toFixed(1)}s
                </span>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg border p-3 bg-muted/50 text-center">
                  <Activity className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                  <div className="text-[11px] text-muted-foreground">Success Rate</div>
                  <div className={cn(
                    "text-xl font-bold",
                    result.summary.successRate >= 95 ? "text-green-600" :
                    result.summary.successRate >= 80 ? "text-yellow-600" : "text-red-600"
                  )}>
                    {result.summary.successRate.toFixed(1)}%
                  </div>
                </div>
                <div className="rounded-lg border p-3 bg-muted/50 text-center">
                  <Zap className="h-4 w-4 mx-auto mb-1 text-yellow-500" />
                  <div className="text-[11px] text-muted-foreground">Avg Req/s</div>
                  <div className="text-xl font-bold">{result.summary.avgRequestsPerSecond.toFixed(1)}</div>
                </div>
                <div className="rounded-lg border p-3 bg-muted/50 text-center">
                  <Clock className="h-4 w-4 mx-auto mb-1 text-purple-500" />
                  <div className="text-[11px] text-muted-foreground">Avg Latency</div>
                  <div className="text-xl font-bold">{result.summary.avgResponseTime}ms</div>
                </div>
                <div className="rounded-lg border p-3 bg-muted/50 text-center">
                  <BarChart3 className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
                  <div className="text-[11px] text-muted-foreground">Total Requests</div>
                  <div className="text-xl font-bold">{result.summary.totalRequests.toLocaleString()}</div>
                </div>
              </div>

              {/* Latency Percentiles Chart */}
              {buildLatencyChartData().length > 0 && (
                <div className="rounded-lg border p-4 bg-muted/30">
                  <div className="text-xs font-medium mb-3">Latency by Test (ms)</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={buildLatencyChartData()} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/20" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} width={40} />
                      <Tooltip {...TOOLTIP_STYLE} formatter={(v: number, name: string) => [`${v}ms`, name]} />
                      <Bar dataKey="p50" name="P50" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={14} />
                      <Bar dataKey="p95" name="P95" fill="#8b5cf6" radius={[2, 2, 0, 0]} barSize={14} />
                      <Bar dataKey="p99" name="P99" fill="#ec4899" radius={[2, 2, 0, 0]} barSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Throughput Chart */}
              {buildReqsChartData().length > 0 && (
                <div className="rounded-lg border p-4 bg-muted/30">
                  <div className="text-xs font-medium mb-3">Throughput (Requests/sec)</div>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={buildReqsChartData()} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/20" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} width={40} />
                      <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v.toFixed(2)} req/s`, 'Throughput']} />
                      <Bar dataKey="reqsPerSec" radius={[4, 4, 0, 0]} barSize={24}>
                        {buildReqsChartData().map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Error/Failure Breakdown */}
              {(result.summary.totalErrors > 0 || result.summary.totalTimeouts > 0) && (
                <div className="rounded-lg border border-destructive/30 p-3 bg-destructive/5">
                  <div className="text-xs font-medium mb-2 text-destructive">Failure Breakdown</div>
                  <div className="flex gap-6 text-sm">
                    <div><span className="text-muted-foreground">Errors: </span><span className="font-medium text-red-600">{result.summary.totalErrors}</span></div>
                    <div><span className="text-muted-foreground">Timeouts: </span><span className="font-medium text-orange-600">{result.summary.totalTimeouts}</span></div>
                    <div><span className="text-muted-foreground">Successful: </span><span className="font-medium text-green-600">{result.summary.successfulRequests.toLocaleString()}</span></div>
                  </div>
                </div>
              )}

              {/* Per-Language detail */}
              {result.summary.perLanguage && (
                <div className="space-y-2">
                  <div className="text-xs font-medium">Per-Language Detail</div>
                  {Object.entries(result.summary.perLanguage).map(([language, langResults]) => {
                    const langInfo = AVAILABLE_LANGUAGES.find(l => l.id === language);
                    return (
                      <div key={language} className="rounded-lg border p-3 bg-muted/20 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className={cn('w-2.5 h-2.5 rounded-full', langInfo?.color || 'bg-gray-500')} />
                          <span className="text-sm font-medium">{langInfo?.name || language}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { key: 'simple', label: 'Simple', data: langResults.simple },
                            { key: 'complex', label: 'Complex', data: langResults.complex },
                          ].map(({ key, label, data }) => {
                            if (!data || ('error' in data && !data.latency)) {
                              return data?.error ? (
                                <div key={key} className="text-xs rounded border p-2 bg-background">
                                  <div className="font-medium text-muted-foreground mb-1">{label}</div>
                                  <div className="text-red-600 text-[11px]">{data.error}</div>
                                </div>
                              ) : null;
                            }
                            return (
                              <div key={key} className="text-xs rounded border p-2 bg-background space-y-1">
                                <div className="font-medium text-muted-foreground">
                                  {label} {data.program && <span className="text-[10px] font-normal">({data.program})</span>}
                                </div>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                                  <div><span className="text-muted-foreground">Req/s: </span>{data.requestsPerSecond}</div>
                                  <div><span className="text-muted-foreground">Success: </span>
                                    <span className={data.successRate >= 95 ? 'text-green-600' : 'text-red-600'}>{data.successRate}%</span>
                                  </div>
                                  {data.latency && (
                                    <>
                                      <div><span className="text-muted-foreground">P50: </span>{data.latency.p50}ms</div>
                                      <div><span className="text-muted-foreground">P95: </span>{data.latency.p95}ms</div>
                                    </>
                                  )}
                                  <div><span className="text-muted-foreground">Reqs: </span>{data.requests}</div>
                                  {(data.errors > 0 || data.timeouts > 0) && (
                                    <div><span className="text-muted-foreground">Err/TO: </span><span className="text-red-600">{data.errors}/{data.timeouts}</span></div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="text-xs text-muted-foreground pt-2 border-t">
                Report ID: {result.reportId}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            {isRunning && (
              <Button variant="destructive" size="sm" onClick={handleCancel}>
                <XCircle className="mr-2 h-4 w-4" />
                Cancel Test
              </Button>
            )}
            <Button variant="outline" onClick={handleClose} disabled={isRunning}>
              {result ? 'Close' : 'Cancel'}
            </Button>
            {!result && (
              <Button onClick={handleStart} disabled={isRunning}>
                {isRunning ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Running...</>
                ) : (
                  <><PlayCircle className="mr-2 h-4 w-4" />Start Test</>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
