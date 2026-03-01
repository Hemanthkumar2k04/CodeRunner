/**
 * Admin Dashboard – Overview Tab
 * Key stat cards, latency chart, language pie, resource time series
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';

interface DailyMetrics {
  date: string;
  uniqueContainers: number;
  uniqueClients: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: string;
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

interface OverviewTabProps {
  stats: {
    executionQueue: { queued: number; active: number; maxConcurrent: number };
    containers: { active: number; created: number; reused: number; deleted: number };
    clients: { activeClients: number; activeExecutions: number };
    metrics: { today: DailyMetrics };
    networks: { total: number; active: number; unused: number };
  };
  resourceHistory: { time: string; cpu: number; memory: number }[];
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444'];

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'hsl(var(--card))',
    borderRadius: '8px',
    border: '1px solid hsl(var(--border))',
    fontSize: '12px',
  },
};

export function OverviewTab({ stats, resourceHistory }: OverviewTabProps) {
  const latencyData = [
    { name: 'Median', value: stats.metrics.today.latency.median, fill: '#3b82f6' },
    { name: 'Avg', value: stats.metrics.today.latency.average, fill: '#6366f1' },
    { name: 'P95', value: stats.metrics.today.latency.p95, fill: '#8b5cf6' },
    { name: 'P99', value: stats.metrics.today.latency.p99, fill: '#ec4899' },
    { name: 'Max', value: stats.metrics.today.latency.highest, fill: '#ef4444' },
  ];

  const languageData = Object.entries(stats.metrics.today.requestsByLanguage).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  const totalRequests = stats.metrics.today.totalRequests || 1; // prevent division by zero

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.metrics.today.totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-green-500 font-medium">{stats.metrics.today.successRate}</span> success rate
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concurrent Executions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.executionQueue.active}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.executionQueue.queued} queued / {stats.executionQueue.maxConcurrent || 10} max
            </p>
            <Progress value={(stats.executionQueue.active / (stats.executionQueue.maxConcurrent || 10)) * 100} className="h-1.5 mt-3" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Containers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.containers.active}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.containers.reused} reused / {stats.containers.created} created
            </p>
            <div className="flex gap-0.5 mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="bg-purple-500 h-full transition-all duration-500" style={{ width: `${Math.min((stats.containers.active / 20) * 100, 100)}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.clients.activeClients}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.clients.activeExecutions} executing code
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex -space-x-2">
                {Array.from({ length: Math.min(stats.clients.activeClients, 3) }).map((_, i) => (
                  <div key={i} className="w-6 h-6 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-[10px] font-bold">{i + 1}</div>
                ))}
              </div>
              {stats.clients.activeClients > 3 && <span className="text-xs text-muted-foreground">+{stats.clients.activeClients - 3} more</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Latency Distribution */}
        <Card className="md:col-span-2 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Latency Distribution</CardTitle>
                <CardDescription>Response time percentiles (ms)</CardDescription>
              </div>
              <div className="flex gap-4 text-xs font-mono text-muted-foreground bg-secondary/30 p-2 rounded-md">
                <span>Avg: {stats.metrics.today.latency.average}ms</span>
                <span>P95: {stats.metrics.today.latency.p95}ms</span>
                <span className="text-destructive">Max: {stats.metrics.today.latency.highest}ms</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={latencyData} layout="vertical" margin={{ left: 50, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted/20" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={44} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v?: number) => v !== undefined ? [`${v}ms`, 'Latency'] : ['N/A', 'Latency']} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={28}>
                  {latencyData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Language Pie Chart */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Requests by Language</CardTitle>
            <CardDescription>Execution distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] relative">
              {languageData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={languageData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={5} dataKey="value">
                      {languageData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No requests yet</div>
              )}
              <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                <span className="text-2xl font-bold">{stats.metrics.today.totalRequests}</span>
                <span className="text-[10px] text-muted-foreground uppercase">Requests</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {languageData.map((entry, index) => (
                <div key={index} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-muted-foreground">{entry.name}</span>
                  <span className="font-bold">{((entry.value / totalRequests) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resource Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>CPU Usage</CardTitle>
            <CardDescription>Server processor utilization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={resourceHistory}>
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/20" />
                  <XAxis dataKey="time" hide />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} width={35} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v?: number) => v !== undefined ? [`${v}%`, 'CPU'] : ['N/A', 'CPU']} labelFormatter={(l) => `Time: ${l}`} />
                  <Area type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Memory Usage</CardTitle>
            <CardDescription>Server RAM utilization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={resourceHistory}>
                  <defs>
                    <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/20" />
                  <XAxis dataKey="time" hide />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} width={35} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v?: number) => v !== undefined ? [`${v}%`, 'Memory'] : ['N/A', 'Memory']} labelFormatter={(l) => `Time: ${l}`} />
                  <Area type="monotone" dataKey="memory" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorMem)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
