/**
 * Admin Dashboard – Metrics Tab
 * Pipeline stage breakdown, per-language performance, detailed latency stats
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts';
import { Timer, Layers, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';

interface StageStats {
  p50: number;
  p95: number;
  p99: number;
  avg: number;
}

interface PipelineData {
  count: number;
  reuseRate: number;
  byStage: Record<string, StageStats>;
  byLanguage: Record<string, { count: number; avgTotal: number }>;
  slowExecutions: {
    totalMs: number;
    language: string;
    queueMs: number;
    networkMs: number;
    containerMs: number;
    fileTransferMs: number;
    executionMs: number;
    cleanupMs: number;
    containerReused: boolean;
  }[];
}

interface DailyMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: string;
  uniqueContainers: number;
  uniqueClients: number;
  latency: {
    average: number;
    lowest: number;
    highest: number;
    median: number;
    p95: number;
    p99: number;
  };
  requestsByLanguage: Record<string, number>;
  requestsByType: Record<string, number>;
}

interface MetricsTabProps {
  adminKey: string;
  dailyMetrics: DailyMetrics;
}

const STAGE_LABELS: Record<string, string> = {
  queueMs: 'Queue',
  networkMs: 'Network',
  containerMs: 'Container',
  fileTransferMs: 'File Transfer',
  executionMs: 'Execution',
  cleanupMs: 'Cleanup',
  totalMs: 'Total',
};

const STAGE_COLORS: Record<string, string> = {
  queueMs: '#f59e0b',
  networkMs: '#6366f1',
  containerMs: '#3b82f6',
  fileTransferMs: '#10b981',
  executionMs: '#ec4899',
  cleanupMs: '#8b5cf6',
  totalMs: '#64748b',
};

const LANG_COLORS: Record<string, string> = {
  python: '#3b82f6',
  javascript: '#eab308',
  java: '#ef4444',
  cpp: '#a855f7',
};

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'hsl(var(--card))',
    borderRadius: '8px',
    border: '1px solid hsl(var(--border))',
    fontSize: '12px',
  },
};

export function MetricsTab({ adminKey, dailyMetrics }: MetricsTabProps) {
  const [pipeline, setPipeline] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPipeline = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const res = await fetch('/admin/pipeline-metrics', { headers: { 'X-Admin-Key': adminKey } });
      if (res.ok) {
        setPipeline(await res.json());
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [adminKey]);

  useEffect(() => {
    fetchPipeline();
    const iv = setInterval(fetchPipeline, 10000);
    return () => clearInterval(iv);
  }, [fetchPipeline]);

  // Build pipeline stacked chart data (exclude totalMs)
  const stageChartData = pipeline?.byStage
    ? Object.entries(pipeline.byStage)
      .filter(([key]) => key !== 'totalMs')
      .map(([key, val]) => ({
        name: STAGE_LABELS[key] || key,
        avg: val.avg,
        p50: val.p50,
        p95: val.p95,
        p99: val.p99,
        fill: STAGE_COLORS[key] || '#666',
      }))
    : [];

  // By-language data
  const languageChartData = pipeline?.byLanguage
    ? Object.entries(pipeline.byLanguage).map(([lang, val]) => ({
      name: lang.charAt(0).toUpperCase() + lang.slice(1),
      count: val.count,
      avgTotal: val.avgTotal,
      fill: LANG_COLORS[lang] || '#666',
    }))
    : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Summary Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Requests</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{dailyMetrics.totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-green-500 font-medium">{dailyMetrics.successfulRequests.toLocaleString()}</span> successful &middot; <span className="text-red-500 font-medium">{dailyMetrics.failedRequests.toLocaleString()}</span> failed
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Success Rate</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">{dailyMetrics.successRate}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pipeline Executions</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pipeline?.count ?? '—'}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Container reuse: <span className="font-medium">{pipeline?.reuseRate ?? 0}%</span>
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Avg Total Latency</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pipeline?.byStage?.totalMs?.avg ?? dailyMetrics.latency.average}ms</div>
            <p className="text-xs text-muted-foreground mt-1">
              P95: {pipeline?.byStage?.totalMs?.p95 ?? dailyMetrics.latency.p95}ms &middot; P99: {pipeline?.byStage?.totalMs?.p99 ?? dailyMetrics.latency.p99}ms
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Stages */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Pipeline Stage Breakdown
              </CardTitle>
              <CardDescription>Per-stage latency percentiles across the execution pipeline</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={fetchPipeline} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {stageChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stageChartData} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/20" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} width={40} tickFormatter={(v) => `${v}ms`} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v?: number) => v !== undefined ? [`${v}ms`, 'ms'] : ['N/A', 'ms']} />
                <Bar dataKey="avg" name="avg" fill="#64748b" radius={[2, 2, 0, 0]} barSize={12} />
                <Bar dataKey="p50" name="p50" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={12} />
                <Bar dataKey="p95" name="p95" fill="#8b5cf6" radius={[2, 2, 0, 0]} barSize={12} />
                <Bar dataKey="p99" name="p99" fill="#ec4899" radius={[2, 2, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Timer className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No pipeline data yet. Execute some code to see metrics.</p>
            </div>
          )}
          {/* Legend */}
          <div className="flex gap-4 justify-center mt-2">
            {[
              { label: 'Avg', color: '#64748b' },
              { label: 'P50', color: '#3b82f6' },
              { label: 'P95', color: '#8b5cf6' },
              { label: 'P99', color: '#ec4899' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: l.color }} />
                <span className="text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Language Performance */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Language Avg Latency Bar */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Performance by Language</CardTitle>
            <CardDescription>Average total pipeline time per language</CardDescription>
          </CardHeader>
          <CardContent>
            {languageChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={languageChartData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/20" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} width={40} tickFormatter={(v) => `${v}ms`} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v?: number) => v !== undefined ? [`${v}ms`, 'Avg Total'] : ['N/A', 'Avg Total']} />
                  <Bar dataKey="avgTotal" radius={[4, 4, 0, 0]} barSize={36}>
                    {languageChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">No data</div>
            )}
          </CardContent>
        </Card>

        {/* Execution Count Pie */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Execution Count by Language</CardTitle>
            <CardDescription>Total pipeline executions tracked</CardDescription>
          </CardHeader>
          <CardContent>
            {languageChartData.length > 0 ? (
              <div className="h-[200px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={languageChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="count">
                      {languageChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                  <span className="text-xl font-bold">{pipeline?.count ?? 0}</span>
                  <span className="text-[10px] text-muted-foreground uppercase">Execs</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">No data</div>
            )}
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {languageChartData.map((entry, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                  <span className="text-muted-foreground">{entry.name}</span>
                  <span className="font-bold">{entry.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Slow Executions Table */}
      {pipeline && pipeline.slowExecutions.length > 0 && (
        <Card className="shadow-sm border-orange-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Slow Executions
            </CardTitle>
            <CardDescription>Executions exceeding 1000ms threshold (last {pipeline.slowExecutions.length})</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-left py-2 px-2">Language</th>
                    <th className="text-right py-2 px-2">Queue</th>
                    <th className="text-right py-2 px-2">Network</th>
                    <th className="text-right py-2 px-2">Container</th>
                    <th className="text-right py-2 px-2">Files</th>
                    <th className="text-right py-2 px-2">Exec</th>
                    <th className="text-right py-2 px-2">Cleanup</th>
                    <th className="text-right py-2 px-2 font-bold">Total</th>
                    <th className="text-center py-2 px-2">Reused</th>
                  </tr>
                </thead>
                <tbody>
                  {pipeline.slowExecutions.slice(-15).reverse().map((exec, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-1.5 px-2 capitalize">{exec.language}</td>
                      <td className="py-1.5 px-2 text-right font-mono">{exec.queueMs}ms</td>
                      <td className="py-1.5 px-2 text-right font-mono">{exec.networkMs}ms</td>
                      <td className="py-1.5 px-2 text-right font-mono">{exec.containerMs}ms</td>
                      <td className="py-1.5 px-2 text-right font-mono">{exec.fileTransferMs}ms</td>
                      <td className="py-1.5 px-2 text-right font-mono">{exec.executionMs}ms</td>
                      <td className="py-1.5 px-2 text-right font-mono">{exec.cleanupMs}ms</td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-orange-500">{exec.totalMs}ms</td>
                      <td className="py-1.5 px-2 text-center">
                        <Badge variant={exec.containerReused ? 'default' : 'secondary'} className="text-[10px]">
                          {exec.containerReused ? 'Yes' : 'No'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
