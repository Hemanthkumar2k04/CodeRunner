/**
 * Admin Dashboard – Main Page Shell
 * Authentication, sidebar navigation, header, delegates to tab components
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';
import { TestRunnerModal } from './TestRunnerModal';
import { OverviewTab } from './admin/OverviewTab';
import { MetricsTab } from './admin/MetricsTab';
import { ContainersTab } from './admin/ContainersTab';
import { LoadTestsTab } from './admin/LoadTestsTab';
import { LogsTab } from './admin/LogsTab';
import {
  Activity,
  Download,
  RefreshCw,
  Lock,
  LogOut,
  RotateCcw,
  Zap,
  LayoutDashboard,
  Container,
  FileText,
  FileBarChart,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';

interface SystemMetrics {
  cpu: number;
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercentage: number;
    process: { rss: number; heapTotal: number; heapUsed: number };
  };
  uptime: number;
  load: number[];
}

interface ServerStats {
  timestamp: string;
  server: {
    environment: string;
    port: number;
    uptime: number;
    resources?: SystemMetrics;
  };
  executionQueue: { queued: number; active: number; maxConcurrent: number };
  containers: { active: number; created: number; reused: number; deleted: number };
  networks: { total: number; active: number; unused: number };
  executions: { queued: number; active: number; maxConcurrent: number };
  clients: { activeClients: number; activeExecutions: number };
  metrics: {
    today: {
      date: string;
      uniqueContainers: number;
      uniqueClients: number;
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      successRate: string;
      latency: { average: number; lowest: number; highest: number; median: number; p95: number; p99: number };
      requestsByLanguage: Record<string, number>;
      requestsByType: Record<string, number>;
    };
    currentState: { activeClients: number; activeExecutions: number };
  };
}

type TabId = 'overview' | 'metrics' | 'containers' | 'logs' | 'loadtests';

const NAV_ITEMS: { id: TabId; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'metrics', label: 'Metrics', icon: Activity },
  { id: 'containers', label: 'Containers', icon: Container },
  { id: 'logs', label: 'Logs', icon: FileText },
  { id: 'loadtests', label: 'Load Tests', icon: FileBarChart },
];

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
  const [showTestModal, setShowTestModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [resourceHistory, setResourceHistory] = useState<{ time: string; cpu: number; memory: number }[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const isFetchingRef = useRef(false);

  /* ---------- Data fetching ---------- */

  const fetchStats = useCallback(async () => {
    if (!adminKey || isFetchingRef.current) return;
    if (!hasLoadedOnceRef.current) setLoading(true);
    isFetchingRef.current = true;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/admin/stats', {
        signal: abortControllerRef.current.signal,
        cache: 'no-store',
        headers: { 'X-Admin-Key': adminKey },
      });
      if (!response.ok) {
        if (response.status === 401) {
          setIsAuthenticated(false);
          setAdminKey('');
          setKeyInput('');
          setStats(null);
          sessionStorage.removeItem('adminKey');
          throw new Error('Session expired. Please login again.');
        }
        throw new Error('Failed to fetch stats');
      }
      const data = await response.json();
      setStats(data);

      if (data.server.resources) {
        setResourceHistory(prev => {
          const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' });
          const next = [...prev, { time, cpu: data.server.resources.cpu, memory: data.server.resources.memory.usagePercentage }];
          return next.length > 20 ? next.slice(next.length - 20) : next;
        });
      }
      setError(null);
      hasLoadedOnceRef.current = true;
    } catch (err: any) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetchingRef.current = false;
    }
  }, [adminKey]);

  // Load saved key
  useEffect(() => {
    const savedKey = sessionStorage.getItem('adminKey');
    if (savedKey) {
      setAdminKey(savedKey);
      setIsAuthenticated(true);
      setLoading(true);
    }
  }, []);

  // Auto-refresh stats
  useEffect(() => {
    if (!isAuthenticated || !adminKey) return;
    fetchStats();
    const iv = setInterval(fetchStats, 5000);
    return () => clearInterval(iv);
  }, [isAuthenticated, adminKey]);

  /* ---------- Handlers ---------- */

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) { setAuthError('Please enter an admin key'); return; }
    setLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/admin/stats', { headers: { 'X-Admin-Key': keyInput } });
      if (!res.ok) throw new Error(res.status === 401 ? 'Invalid admin key' : 'Authentication failed');
      setAdminKey(keyInput);
      setIsAuthenticated(true);
      sessionStorage.setItem('adminKey', keyInput);
    } catch (err: any) { setAuthError(err.message); }
    finally { setLoading(false); }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAdminKey('');
    setKeyInput('');
    setStats(null);
    sessionStorage.removeItem('adminKey');
    hasLoadedOnceRef.current = false;
    isFetchingRef.current = false;
  };

  const handleRefresh = () => { setRefreshing(true); fetchStats(); };

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset all metrics? This action cannot be undone.')) return;
    try {
      const res = await fetch('/admin/reset', { method: 'POST', headers: { 'X-Admin-Key': adminKey } });
      if (!res.ok) throw new Error('Failed to reset metrics');
      await fetchStats();
    } catch (err: any) { setError(err.message); }
  };

  const handleDownloadReport = async () => {
    if (!adminKey) return;
    const date = new Date().toISOString().split('T')[0];
    try {
      const res = await fetch(`/admin/report/download?date=${date}`, { headers: { 'X-Admin-Key': adminKey } });
      if (!res.ok) throw new Error('Failed to download report');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) { setError(err.message); }
  };

  /* ---------- Login Screen ---------- */

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
            <CardDescription className="text-center">Enter your admin key to access the dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input type="password" placeholder="Enter admin key" value={keyInput} onChange={e => setKeyInput(e.target.value)} autoFocus />
              {authError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />{authError}
                </div>
              )}
              <div className="flex gap-2">
                <Button type="button" onClick={() => navigate('/')} variant="outline" className="flex-1">
                  <ArrowLeft className="h-4 w-4 mr-2" />Back
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

  /* ---------- Loading / Error ---------- */

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-16 w-full" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" />
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
              <AlertCircle className="h-5 w-5" />Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error || 'Unable to load dashboard data'}</p>
            <div className="flex gap-2">
              <Button onClick={() => navigate('/')} variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Go Home</Button>
              <Button onClick={() => window.location.reload()}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ---------- Main Dashboard ---------- */

  const uptime = stats.server.uptime;
  const uptimeStr = uptime >= 86400
    ? `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h`
    : uptime >= 3600
      ? `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`
      : `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card/50 hidden md:flex flex-col">
        <div className="p-6">
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">CR</div>
            CodeRunner
          </h2>
          <p className="text-[11px] text-muted-foreground mt-1">Up {uptimeStr} &middot; {stats.server.environment}</p>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {NAV_ITEMS.map(item => (
            <Button
              key={item.id}
              variant={activeTab === item.id ? 'secondary' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActiveTab(item.id)}
            >
              <item.icon className="h-4 w-4 mr-2" />
              {item.label}
            </Button>
          ))}
        </nav>

        <div className="p-4 border-t space-y-2">
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate">Admin User</p>
                <p className="text-xs text-muted-foreground truncate">Connected via Key</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="border-b bg-card/30 backdrop-blur sticky top-0 z-10">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="md:hidden">
                <Button variant="ghost" size="icon"><LayoutDashboard className="h-5 w-5" /></Button>
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${stats ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-sm font-medium">Live</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`h-3.5 w-3.5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowTestModal(true)}>
                <Zap className="h-3.5 w-3.5 mr-2" />Run Load Test
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="h-3.5 w-3.5 mr-2" />Reset
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadReport}>
                <Download className="h-3.5 w-3.5 mr-2" />Report
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-6">
          {activeTab === 'overview' && (
            <OverviewTab stats={stats} resourceHistory={resourceHistory} />
          )}
          {activeTab === 'metrics' && (
            <MetricsTab adminKey={adminKey} dailyMetrics={stats.metrics.today} />
          )}
          {activeTab === 'containers' && (
            <ContainersTab stats={stats} />
          )}
          {activeTab === 'logs' && (
            <LogsTab adminKey={adminKey} />
          )}
          {activeTab === 'loadtests' && (
            <LoadTestsTab adminKey={adminKey} />
          )}
        </div>
      </main>

      <TestRunnerModal open={showTestModal} onOpenChange={setShowTestModal} />
    </div>
  );
}
