import { useEffect, useState } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';

interface Network {
  name: string;
  containerCount: number;
  ageSeconds: number;
}

interface NetworkStats {
  total: number;
  withContainers: number;
  empty: number;
  networks: Network[];
}

interface NetworkStatsResponse {
  status: string;
  networks: NetworkStats;
  timestamp: string;
}

export default function NetworkMonitor() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/network-stats');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data: NetworkStatsResponse = await response.json();
      setStats(data.networks);
      setLastUpdate(new Date(data.timestamp).toLocaleTimeString());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch network stats');
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchStats, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const formatAge = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  const getNetworkStatus = (network: Network): 'active' | 'idle' | 'stale' => {
    if (network.containerCount > 0) return 'active';
    if (network.ageSeconds < 300) return 'idle'; // Less than 5 minutes
    return 'stale';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'idle': return 'bg-yellow-500';
      case 'stale': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Docker Network Monitor</h1>
          <p className="text-muted-foreground">Real-time CodeRunner network statistics</p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Auto-refresh: ON' : 'Auto-refresh: OFF'}
          </Button>
          <Button onClick={fetchStats} variant="outline">
            Refresh Now
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-4 border-red-500">
          <p className="text-red-600">Error: {error}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Make sure the server is running on http://localhost:3001
          </p>
        </Card>
      )}

      {stats && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Networks</p>
                  <p className="text-3xl font-bold">{stats.total}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-300 text-xl">🌐</span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active (With Containers)</p>
                  <p className="text-3xl font-bold text-green-600">{stats.withContainers}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <span className="text-green-600 dark:text-green-300 text-xl">✓</span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Empty Networks</p>
                  <p className="text-3xl font-bold text-yellow-600">{stats.empty}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                  <span className="text-yellow-600 dark:text-yellow-300 text-xl">⚠</span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Capacity</p>
                  <p className="text-3xl font-bold">{((stats.total / 4352) * 100).toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">{stats.total} / 4,352</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                  <span className="text-purple-600 dark:text-purple-300 text-xl">📊</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Network List */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Active Networks</h2>
              <Badge variant="outline">Last updated: {lastUpdate}</Badge>
            </div>
            <Separator className="mb-4" />

            {stats.networks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-4xl mb-4">🎉</p>
                <p className="text-lg">No CodeRunner networks active</p>
                <p className="text-sm">All sessions have been cleaned up</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {stats.networks.map((network, index) => {
                    const status = getNetworkStatus(network);
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className={`h-3 w-3 rounded-full ${getStatusColor(status)}`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-sm truncate">{network.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Age: {formatAge(network.ageSeconds)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-sm font-semibold">{network.containerCount}</p>
                            <p className="text-xs text-muted-foreground">containers</p>
                          </div>
                          <Badge variant={status === 'active' ? 'default' : status === 'idle' ? 'secondary' : 'destructive'}>
                            {status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </Card>

          {/* Status Legend */}
          <Card className="p-4">
            <div className="flex items-center justify-center gap-8 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span>Active (has containers)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <span>Idle (&lt;5min, no containers)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span>Stale (&gt;5min, should be cleaned)</span>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
