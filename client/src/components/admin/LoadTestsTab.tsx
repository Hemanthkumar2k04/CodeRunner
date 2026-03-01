/**
 * Admin Dashboard – Load Tests Tab
 * Browse past load test reports, view details with charts, delete reports
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Trash2, ChevronDown, ChevronUp, RefreshCw, FileBarChart, Clock, Zap, Activity } from 'lucide-react';

interface ReportSummary {
  id: string;
  timestamp: string;
  intensity: string;
  languages: string[];
  duration: number;
  summary?: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    avgResponseTime: number;
    avgRequestsPerSecond: number;
    totalErrors: number;
    totalTimeouts: number;
    latency: { mean: number; p50: number; p95: number; p99: number };
    totalThroughputMB: number;
    testCount: number;
    languageCount: number;
    perLanguage: Record<string, any>;
  };
}

interface LoadTestsTabProps {
  adminKey: string;
}

const LANG_COLORS: Record<string, string> = {
  python: '#3b82f6', javascript: '#eab308', java: '#ef4444', cpp: '#a855f7',
};

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'hsl(var(--card))',
    borderRadius: '8px',
    border: '1px solid hsl(var(--border))',
    fontSize: '12px',
  },
};

export function LoadTestsTab({ adminKey }: LoadTestsTabProps) {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<any>(null);

  const fetchReports = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const res = await fetch('/admin/load-test-reports', { headers: { 'X-Admin-Key': adminKey } });
      if (res.ok) {
        const data = await res.json();
        setReports(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [adminKey]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(id);
    try {
      const res = await fetch(`/admin/load-test-reports/${id}`, { headers: { 'X-Admin-Key': adminKey } });
      if (res.ok) {
        setExpandedDetail(await res.json());
      }
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this load test report?')) return;
    try {
      const res = await fetch(`/admin/load-test-reports/${id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Key': adminKey },
      });
      if (res.ok) {
        setReports(prev => prev.filter(r => r.id !== id));
        if (expandedId === id) {
          setExpandedId(null);
          setExpandedDetail(null);
        }
      }
    } catch { /* ignore */ }
  };

  const buildLatencyChart = (perLanguage: Record<string, any>) => {
    return Object.entries(perLanguage).flatMap(([lang, data]: [string, any]) => {
      const items: any[] = [];
      if (data.simple?.latency) {
        items.push({
          name: `${lang.charAt(0).toUpperCase() + lang.slice(1)} (S)`,
          p50: data.simple.latency.p50,
          p95: data.simple.latency.p95,
          p99: data.simple.latency.p99,
          fill: LANG_COLORS[lang] || '#666',
        });
      }
      if (data.complex?.latency) {
        items.push({
          name: `${lang.charAt(0).toUpperCase() + lang.slice(1)} (C)`,
          p50: data.complex.latency.p50,
          p95: data.complex.latency.p95,
          p99: data.complex.latency.p99,
          fill: LANG_COLORS[lang] || '#666',
        });
      }
      return items;
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Load Test Reports</h3>
          <p className="text-sm text-muted-foreground">Browse and analyze past load test results</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchReports} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {reports.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-16 text-center">
            <FileBarChart className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No load test reports found. Run a load test to generate one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map(report => {
            const isExpanded = expandedId === report.id;
            const ts = new Date(report.timestamp);
            return (
              <Card key={report.id} className="shadow-sm overflow-hidden">
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => handleExpand(report.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {ts.toLocaleDateString()} {ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {report.intensity || 'unknown'}
                      </Badge>
                      {report.languages?.map(l => (
                        <Badge key={l} variant="outline" className="text-[10px] capitalize">{l}</Badge>
                      ))}
                    </div>
                    {report.summary && (
                      <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                        <span>{report.summary.totalRequests?.toLocaleString()} reqs</span>
                        <span>{report.summary.successRate?.toFixed(1)}% success</span>
                        <span>{report.summary.avgResponseTime}ms avg</span>
                        <span>{report.summary.avgRequestsPerSecond?.toFixed(1)} req/s</span>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={e => { e.stopPropagation(); handleDelete(report.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>

                {/* Expanded Detail */}
                {isExpanded && expandedDetail?.summary && (
                  <div className="border-t px-5 py-4 space-y-4 bg-muted/10">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-4 gap-3">
                      <div className="rounded-lg border p-3 bg-background text-center">
                        <Activity className="h-3.5 w-3.5 mx-auto mb-1 text-blue-500" />
                        <div className="text-[10px] text-muted-foreground">Success Rate</div>
                        <div className="text-lg font-bold">{expandedDetail.summary.successRate?.toFixed(1)}%</div>
                      </div>
                      <div className="rounded-lg border p-3 bg-background text-center">
                        <Zap className="h-3.5 w-3.5 mx-auto mb-1 text-yellow-500" />
                        <div className="text-[10px] text-muted-foreground">Avg Req/s</div>
                        <div className="text-lg font-bold">{expandedDetail.summary.avgRequestsPerSecond?.toFixed(1)}</div>
                      </div>
                      <div className="rounded-lg border p-3 bg-background text-center">
                        <Clock className="h-3.5 w-3.5 mx-auto mb-1 text-purple-500" />
                        <div className="text-[10px] text-muted-foreground">Avg Latency</div>
                        <div className="text-lg font-bold">{expandedDetail.summary.avgResponseTime}ms</div>
                      </div>
                      <div className="rounded-lg border p-3 bg-background text-center">
                        <FileBarChart className="h-3.5 w-3.5 mx-auto mb-1 text-emerald-500" />
                        <div className="text-[10px] text-muted-foreground">Total Reqs</div>
                        <div className="text-lg font-bold">{expandedDetail.summary.totalRequests?.toLocaleString()}</div>
                      </div>
                    </div>

                    {/* Latency Chart */}
                    {expandedDetail.summary.perLanguage && (
                      <div className="rounded-lg border p-4 bg-background">
                        <div className="text-xs font-medium mb-3">Latency by Test (ms)</div>
                        <ResponsiveContainer width="100%" height={140}>
                          <BarChart data={buildLatencyChart(expandedDetail.summary.perLanguage)} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/20" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} width={40} />
                            <Tooltip {...TOOLTIP_STYLE} formatter={(v?: number) => v !== undefined ? [`${v}ms`, 'Latency'] : ['N/A', 'Latency']} />
                            <Bar dataKey="p50" name="P50" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={12} />
                            <Bar dataKey="p95" name="P95" fill="#8b5cf6" radius={[2, 2, 0, 0]} barSize={12} />
                            <Bar dataKey="p99" name="P99" fill="#ec4899" radius={[2, 2, 0, 0]} barSize={12} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Error Info */}
                    {(expandedDetail.summary.totalErrors > 0 || expandedDetail.summary.totalTimeouts > 0) && (
                      <div className="rounded-lg border border-destructive/30 p-3 bg-destructive/5 text-sm">
                        <span className="text-muted-foreground">Errors: </span><span className="font-medium text-red-600">{expandedDetail.summary.totalErrors}</span>
                        <span className="text-muted-foreground ml-4">Timeouts: </span><span className="font-medium text-orange-600">{expandedDetail.summary.totalTimeouts}</span>
                      </div>
                    )}

                    <div className="text-[10px] text-muted-foreground">ID: {report.id}</div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
