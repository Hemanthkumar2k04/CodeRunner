/**
 * Admin Dashboard – Containers Tab
 * Container pool utilization, reuse stats, network info
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts';
import { Container, Network, Recycle, Trash2 } from 'lucide-react';

interface ContainersTabProps {
  stats: {
    containers: { active: number; created: number; reused: number; deleted: number };
    networks: { total: number; active: number; unused: number };
    executionQueue: { queued: number; active: number; maxConcurrent: number };
  };
}

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'hsl(var(--card))',
    borderRadius: '8px',
    border: '1px solid hsl(var(--border))',
    fontSize: '12px',
  },
};

export function ContainersTab({ stats }: ContainersTabProps) {
  const { containers, networks, executionQueue } = stats;

  const reuseRate = containers.created > 0
    ? Math.round((containers.reused / containers.created) * 100)
    : 0;

  const containerPieData = [
    { name: 'Active', value: containers.active, fill: '#3b82f6' },
    { name: 'Reused', value: containers.reused, fill: '#10b981' },
    { name: 'Deleted', value: containers.deleted, fill: '#ef4444' },
  ].filter(d => d.value > 0);

  const networkBarData = [
    { name: 'Total', value: networks.total, fill: '#6366f1' },
    { name: 'Active', value: networks.active, fill: '#3b82f6' },
    { name: 'Unused', value: networks.unused, fill: '#94a3b8' },
  ];

  const totalContainerOps = containers.created + containers.reused + containers.deleted || 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Container className="h-4 w-4 text-blue-500" />
              Active Containers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{containers.active}</div>
            <Progress value={(containers.active / 20) * 100} className="h-1.5 mt-3" />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Recycle className="h-4 w-4 text-green-500" />
              Reuse Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">{reuseRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {containers.reused} reused of {containers.created} created
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Network className="h-4 w-4 text-indigo-500" />
              Networks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{networks.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {networks.active} active &middot; {networks.unused} unused
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-500" />
              Deleted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">{containers.deleted}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total containers destroyed
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Container Lifecycle Pie */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Container Lifecycle</CardTitle>
            <CardDescription>Distribution of container operations</CardDescription>
          </CardHeader>
          <CardContent>
            {containerPieData.length > 0 ? (
              <>
                <div className="h-[220px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={containerPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={5} dataKey="value">
                        {containerPieData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip {...TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                    <span className="text-xl font-bold">{containers.created}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">Created</span>
                  </div>
                </div>
                <div className="flex gap-4 justify-center mt-2">
                  {containerPieData.map((entry, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                      <span className="text-muted-foreground">{entry.name}</span>
                      <span className="font-bold">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                No container activity yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Network Usage Bar */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Network Usage</CardTitle>
            <CardDescription>Docker network allocation status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={networkBarData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/20" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} width={30} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={36}>
                  {networkBarData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Execution Queue */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Execution Queue</CardTitle>
          <CardDescription>Current queue state and concurrency limits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4 bg-muted/30 text-center">
              <div className="text-2xl font-bold">{executionQueue.active}</div>
              <div className="text-xs text-muted-foreground mt-1">Active</div>
              <Progress value={(executionQueue.active / (executionQueue.maxConcurrent || 10)) * 100} className="h-1.5 mt-2" />
            </div>
            <div className="rounded-lg border p-4 bg-muted/30 text-center">
              <div className="text-2xl font-bold">{executionQueue.queued}</div>
              <div className="text-xs text-muted-foreground mt-1">Queued</div>
            </div>
            <div className="rounded-lg border p-4 bg-muted/30 text-center">
              <div className="text-2xl font-bold">{executionQueue.maxConcurrent || 10}</div>
              <div className="text-xs text-muted-foreground mt-1">Max Concurrent</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
