import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Activity,
  Server,
  Users,
  Code,
  Clock,
  TrendingUp,
  Download,
  RefreshCw,
  ArrowLeft,
  AlertCircle,
  Lock,
  LogOut,
  RotateCcw,
} from 'lucide-react';

interface ServerStats {
  timestamp: string;
  server: {
    environment: string;
    port: number;
    uptime: number;
  };
  workers: {
    totalWorkers: number;
    activeWorkers: number;
    idleWorkers: number;
  };
  containers: {
    active: number;
    created: number;
    reused: number;
    deleted: number;
  };
  networks: {
    total: number;
    active: number;
    unused: number;
  };
  executions: {
    queued: number;
    active: number;
    maxConcurrent: number;
  };
  clients: {
    activeClients: number;
    activeExecutions: number;
  };
  metrics: {
    today: DailyMetrics;
    currentState: {
      activeClients: number;
      activeExecutions: number;
    };
  };
}

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

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444'];

export function AdminPage() {
  const navigate = useNavigate();
  
  const [adminKey, setAdminKey] = useState<string>('');
  const [keyInput, setKeyInput] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchStats = useCallback(async () => {
    if (!adminKey) return;

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/admin/stats?key=${adminKey}`, {
        signal: abortControllerRef.current.signal,
        cache: 'no-store', // Prevent caching
      });
      if (!response.ok) {
        if (response.status === 401) {
          // Key is no longer valid, log out
          setIsAuthenticated(false);
          setAdminKey('');
          setKeyInput('');
          setStats(null);
          localStorage.removeItem('adminKey');
          throw new Error('Session expired. Please login again.');
        }
        throw new Error('Failed to fetch stats');
      }
      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [adminKey]);

  // Load saved key from localStorage on mount
  useEffect(() => {2000); // 2 second refresh for more live updates
    return () => {
      clearInterval(interval);
      // Cancel any pending request on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isAuthenticated, adminKey, fetchStats
      setAdminKey(savedKey);
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch stats when authenticated
  useEffect(() => {
    if (!isAuthenticated || !adminKey) return;

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated, adminKey]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) {
      setAuthError('Please enter an admin key');
      return;
    }

    setLoading(true);
    setAuthError(null);

    try {
      const response = await fetch(`/admin/stats?key=${keyInput}`);
      if (!response.ok) {
        throw new Error(response.status === 401 ? 'Invalid admin key' : 'Authentication failed');
      }
      
      // Key is valid, save and authenticate
      setAdminKey(keyInput);
      setIsAuthenticated(true);
      localStorage.setItem('adminKey', keyInput);
      setAuthError(null);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAdminKey('');
    setKeyInput('');
    setStats(null);
    localStorage.removeItem('adminKey');
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset all metrics? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/admin/reset?key=${adminKey}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to reset metrics');
      }
      
      // Refresh stats after reset
      await fetchStats();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDownloadReport = async () => {
    if (!adminKey) return;
    
    const date = new Date().toISOString().split('T')[0];
    window.location.href = `/admin/report/download?key=${adminKey}&date=${date}`;
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md animate-in fade-in duration-500">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">Admin Dashboard</CardTitle>
            <CardDescription className="text-center">
              Enter your admin key to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Enter admin key"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  className="w-full"
                  autoFocus
                />
              </div>
              {authError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {authError}
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => navigate('/')}
                  variant="outline"
                  className="flex-1"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? 'Authenticating...' : 'Login'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-16 w-full" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error}</p>
            <div className="flex gap-2">
              <Button onClick={() => navigate('/')} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Home
              </Button>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const latencyData = [
    { name: 'Avg', value: stats.metrics.today.latency.average },
    { name: 'P95', value: stats.metrics.today.latency.p95 },
    { name: 'P99', value: stats.metrics.today.latency.p99 },
    { name: 'Max', value: stats.metrics.today.latency.highest },
  ];

  const languageData = Object.entries(stats.metrics.today.requestsByLanguage).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  const queueUtilization = stats.executions.maxConcurrent > 0
    ? (stats.executions.active / stats.executions.maxConcurrent) * 100
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => navigate('/')}
                  variant="ghost"
                  size="sm"
                  className="mr-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                <Badge variant="outline" className="ml-2 animate-pulse">
                  <Activity className="h-3 w-3 mr-1" />
                  Live
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Last updated: {new Date(stats.timestamp).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleRefresh}
                variant="outline"
                size="sm"
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={handleReset}
                variant="outline"
                size="sm"
                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Metrics
              </Button>
              <Button onClick={handleDownloadReport} size="sm" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Report
              </Button>
              <Button onClick={handleLogout} size="sm" variant="outline">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6 animate-in fade-in duration-500">
        {/* Real-time Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Workers</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.workers.activeWorkers}</div>
              <p className="text-xs text-muted-foreground">
                {stats.workers.idleWorkers} idle / {stats.workers.totalWorkers} total
              </p>
              <Progress
                value={(stats.workers.activeWorkers / (stats.workers.totalWorkers || 1)) * 100}
                className="mt-2"
              />
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Containers</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.containers.active}</div>
              <p className="text-xs text-muted-foreground">
                {stats.containers.reused} reused / {stats.containers.created} created
              </p>
              <div className="flex gap-1 mt-2">
                {Array.from({ length: Math.min(stats.containers.active, 20) }).map((_, i) => (
                  <div
                    key={i}
                    className="h-2 flex-1 bg-primary rounded-full animate-pulse"
                    style={{ animationDelay: `${i * 100}ms` }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.clients.activeClients}</div>
              <p className="text-xs text-muted-foreground">
                {stats.clients.activeExecutions} executing code
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Queue Status</CardTitle>
              <Code className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.executions.queued}</div>
              <p className="text-xs text-muted-foreground">
                {stats.executions.active} active / {stats.executions.maxConcurrent} max
              </p>
              <Progress value={queueUtilization} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Latency Chart */}
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Latency Distribution
              </CardTitle>
              <CardDescription>Response times in milliseconds</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={latencyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Language Distribution */}
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Requests by Language
              </CardTitle>
              <CardDescription>Distribution of execution requests</CardDescription>
            </CardHeader>
            <CardContent>
              {languageData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={languageData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {languageData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No requests yet today
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Today's Metrics */}
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle>Today's Performance</CardTitle>
            <CardDescription>{stats.metrics.today.date}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{stats.metrics.today.totalRequests}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold text-green-500">{stats.metrics.today.successRate}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Unique Clients</p>
                <p className="text-2xl font-bold">{stats.metrics.today.uniqueClients}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Unique Containers</p>
                <p className="text-2xl font-bold">{stats.metrics.today.uniqueContainers}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Avg Latency</p>
                <p className="text-2xl font-bold">{stats.metrics.today.latency.average}ms</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">P95 Latency</p>
                <p className="text-2xl font-bold">{stats.metrics.today.latency.p95}ms</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Server Info */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle>Server Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Environment</span>
                <Badge variant={stats.server.environment === 'production' ? 'default' : 'secondary'}>
                  {stats.server.environment}
                </Badge>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Port</span>
                <span className="font-mono text-sm">{stats.server.port}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Uptime</span>
                <span className="text-sm font-medium">{formatUptime(stats.server.uptime)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle>Resource Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Networks (Active/Total)</span>
                <span className="text-sm font-medium">
                  {stats.networks.active} / {stats.networks.total}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Containers Deleted</span>
                <span className="text-sm font-medium">{stats.containers.deleted}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Container Reuse Rate</span>
                <span className="text-sm font-medium">
                  {stats.containers.created > 0
                    ? ((stats.containers.reused / stats.containers.created) * 100).toFixed(1)
                    : '0'}%
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
