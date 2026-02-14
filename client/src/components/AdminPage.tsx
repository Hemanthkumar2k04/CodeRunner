import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';
import { Progress } from './ui/progress';
import { TestRunnerModal } from './TestRunnerModal';
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
  AreaChart,
  Area,
} from 'recharts';
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
  Settings,
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
    process: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
    };
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
  executionQueue: {
    queued: number;
    active: number;
    maxConcurrent: number;
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
  const [showTestModal, setShowTestModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [resourceHistory, setResourceHistory] = useState<{ time: string; cpu: number; memory: number }[]>([]);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const isFetchingRef = useRef(false);

  const fetchStats = useCallback(async () => {
    console.log('[AdminPage] fetchStats called, adminKey:', adminKey ? 'present' : 'missing', 'isFetching:', isFetchingRef.current);
    if (!adminKey) return;
    
    // If already fetching, don't start a new request (prevents React Strict Mode double-mount issues)
    if (isFetchingRef.current) {
      console.log('[AdminPage] Already fetching, skipping...');
      return;
    }

    // Only set loading on initial fetch (first time)
    if (!hasLoadedOnceRef.current) {
      console.log('[AdminPage] First fetch, setting loading=true');
      setLoading(true);
    }

    isFetchingRef.current = true;

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();

    try {
      console.log('[AdminPage] Fetching /admin/stats...');
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
      console.log('[AdminPage] Stats received, setting state');
      setStats(data);
      
      if (data.server.resources) {
        setResourceHistory(prev => {
          const now = new Date();
          const time = now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' });
          const newPoint = {
            time,
            cpu: data.server.resources.cpu,
            memory: data.server.resources.memory.usagePercentage
          };
          const newHistory = [...prev, newPoint];
          return newHistory.length > 20 ? newHistory.slice(newHistory.length - 20) : newHistory;
        });
      }

      setError(null);
      hasLoadedOnceRef.current = true;
    } catch (err: any) {
      console.log('[AdminPage] Fetch error:', err.name, err.message);
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      console.log('[AdminPage] Fetch complete, setting loading=false');
      setLoading(false);
      setRefreshing(false);
      isFetchingRef.current = false;
    }
  }, [adminKey]);

  // Load saved key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('adminKey');
    console.log('[AdminPage] Checking for saved key:', savedKey ? 'found' : 'not found');
    if (savedKey) {
      setAdminKey(savedKey);
      setIsAuthenticated(true);
      setLoading(true); // Set loading immediately when we have a saved key
      console.log('[AdminPage] Set authenticated and loading');
    }
  }, []);

  // Fetch stats when authenticated
  useEffect(() => {
    if (!isAuthenticated || !adminKey) return;

    console.log('[AdminPage] useEffect triggered - fetching stats');
    fetchStats();
    const interval = setInterval(() => {
      console.log('[AdminPage] Interval fetch');
      fetchStats();
    }, 5000);
    return () => {
      console.log('[AdminPage] Cleanup - clearing interval');
      clearInterval(interval);
    };
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
    hasLoadedOnceRef.current = false;
    isFetchingRef.current = false;
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

  // Show login form if not authenticated
  if (!isAuthenticated) {
    console.log('[AdminPage] Rendering: Login form');
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
    console.log('[AdminPage] Rendering: Loading skeleton');
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

  // Show error state only when there's an actual error
  if (error) {
    console.log('[AdminPage] Rendering: Error screen', error);
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

  // Defensive check - if no stats and no loading/error, something went wrong
  if (!stats) {
    console.log('[AdminPage] Rendering: Defensive error (no stats)', { loading, error, isAuthenticated });
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
            <p className="text-muted-foreground mb-4">Unable to load dashboard data</p>
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

  console.log('[AdminPage] Rendering: Dashboard with stats');

  const latencyData = [
    { name: 'Avg', value: stats.metrics.today.latency.average },
    { name: 'P95', value: stats.metrics.today.latency.p95 },
    { name: 'P99', value: stats.metrics.today.latency.p99 },
  ];

  const languageData = Object.entries(stats.metrics.today.requestsByLanguage).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card/50 hidden md:flex flex-col">
        <div className="p-6">
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
              CR
            </div>
            CodeRunner
          </h2>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <Button
            variant={activeTab === 'overview' ? 'secondary' : 'ghost'}
            className="w-full justify-start"
            onClick={() => setActiveTab('overview')}
          >
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Overview
          </Button>
          <Button
            variant={activeTab === 'metrics' ? 'secondary' : 'ghost'}
            className="w-full justify-start"
            onClick={() => setActiveTab('metrics')}
          >
            <Activity className="h-4 w-4 mr-2" />
            Metrics
          </Button>
          <Button
            variant={activeTab === 'containers' ? 'secondary' : 'ghost'}
            className="w-full justify-start"
            onClick={() => setActiveTab('containers')}
          >
            <Container className="h-4 w-4 mr-2" />
            Containers
          </Button>
          <Button
            variant={activeTab === 'logs' ? 'secondary' : 'ghost'}
            className="w-full justify-start"
            onClick={() => setActiveTab('logs')}
          >
            <FileText className="h-4 w-4 mr-2" />
            Logs
          </Button>
           <Button
            variant={activeTab === 'settings' ? 'secondary' : 'ghost'}
            className="w-full justify-start"
            onClick={() => setActiveTab('settings')}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
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
                <LogOut className="h-4 w-4 mr-2" />
                Logout
             </Button>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="border-b bg-card/30 backdrop-blur sticky top-0 z-10">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <div className="md:hidden">
                 {/* Mobile menu trigger could go here */}
                 <Button variant="ghost" size="icon"><LayoutDashboard className="h-5 w-5"/></Button>
               </div>
               <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${stats ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className="text-sm font-medium">Live Status: {stats ? 'Connected' : 'Disconnected'}</span>
               </div>
            </div>
            
            <div className="flex items-center gap-2">
               <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
               </Button>
               <Button variant="outline" size="sm" onClick={() => setShowTestModal(true)}>
                  <Zap className="h-3.5 w-3.5 mr-2" />
                  Run Load Test
               </Button>
               <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-3.5 w-3.5 mr-2" />
                  Reset Metrics
               </Button>
               <Button variant="outline" size="sm" onClick={handleDownloadReport}>
                  <Download className="h-3.5 w-3.5 mr-2" />
                  Download Report
               </Button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {activeTab === 'overview' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Top Statistics Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-all">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                       <CardTitle className="text-sm font-medium">Concurrent Executions</CardTitle>
                    </CardHeader>
                    <CardContent>
                       <div className="text-3xl font-bold">{stats.executionQueue.active}</div>
                       <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-muted-foreground">{stats.executionQueue.queued} queued / {stats.executionQueue.maxConcurrent || 10} max</p>
                       </div>
                       <Progress value={(stats.executionQueue.active / (stats.executionQueue.maxConcurrent || 10)) * 100} className="h-1.5 mt-3" />
                    </CardContent>
                  </Card>
                   
                  <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-all">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                       <CardTitle className="text-sm font-medium">Active Containers</CardTitle>
                    </CardHeader>
                    <CardContent>
                       <div className="text-3xl font-bold">{stats.containers.active}</div>
                       <p className="text-xs text-muted-foreground mt-1">
                         {stats.containers.reused} reused / {stats.containers.created} created
                       </p>
                       {/* Mini visualization of container pool */}
                       <div className="flex gap-0.5 mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                          <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${Math.min((stats.containers.active / 20) * 100, 100)}%` }} />
                       </div>
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-all">
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
                            {Array.from({length: Math.min(stats.clients.activeClients, 3)}).map((_, i) => (
                               <div key={i} className="w-6 h-6 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-[10px] font-bold">
                                 {i+1}
                               </div>
                            ))}
                          </div>
                          {stats.clients.activeClients > 3 && <span className="text-xs text-muted-foreground">+{stats.clients.activeClients - 3} more</span>}
                        </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Main Charts Row */}
                <div className="grid gap-6 md:grid-cols-3">
                   {/* Latency Distribution - Spans 2 cols */}
                   <Card className="md:col-span-2 shadow-sm">
                      <CardHeader>
                         <div className="flex items-center justify-between">
                            <div>
                               <CardTitle>Latency Distribution</CardTitle>
                               <CardDescription>Response time percentiles (ms)</CardDescription>
                            </div>
                            <div className="flex gap-4 text-xs font-mono text-muted-foreground bg-secondary/30 p-2 rounded-md">
                               <span>Avg: {stats.metrics.today.latency.average}</span>
                               <span>P95: {stats.metrics.today.latency.p95}</span>
                               <span>P99: {stats.metrics.today.latency.p99}</span>
                               <span className="text-destructive">Max: {stats.metrics.today.latency.highest}</span>
                            </div>
                         </div>
                      </CardHeader>
                      <CardContent>
                         <ResponsiveContainer width="100%" height={240}>
                           <BarChart data={latencyData} layout="vertical" margin={{ left: 40, right: 20, top: 10, bottom: 10 }}>
                             <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted/20" />
                             <XAxis type="number" className="text-xs font-mono" />
                             <YAxis dataKey="name" type="category" className="text-xs font-medium" width={30} />
                             <Tooltip 
                               contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                               formatter={(value: any) => [`${value}ms`, 'Latency']}
                             />
                             <Bar dataKey="value" fill="url(#colorLatency)" radius={[0, 4, 4, 0]} barSize={32}>
                               {latencyData.map((_, index) => (
                                 <Cell key={`cell-${index}`} fill={['#3b82f6', '#8b5cf6', '#ec4899', '#ef4444'][index] || '#3b82f6'} />
                               ))}
                             </Bar>
                           </BarChart>
                         </ResponsiveContainer>
                      </CardContent>
                   </Card>

                   {/* Requests by Language */}
                   <Card className="shadow-sm">
                      <CardHeader>
                        <CardTitle>Requests by Language</CardTitle>
                        <CardDescription>Execution distribution</CardDescription>
                      </CardHeader>
                      <CardContent>
                         <div className="h-[240px] relative">
                           <ResponsiveContainer width="100%" height="100%">
                             <PieChart>
                               <Pie
                                 data={languageData}
                                 cx="50%"
                                 cy="50%"
                                 innerRadius={60}
                                 outerRadius={80}
                                 paddingAngle={5}
                                 dataKey="value"
                               >
                                 {languageData.map((_, index) => (
                                   <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                 ))}
                               </Pie>
                               <Tooltip 
                                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                               />
                             </PieChart>
                           </ResponsiveContainer>
                           {/* Center Text */}
                           <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                              <span className="text-2xl font-bold">{stats.metrics.today.totalRequests}</span>
                              <span className="text-xs text-muted-foreground uppercase">Requests</span>
                           </div>
                         </div>
                         {/* Legend */}
                         <div className="flex flex-wrap gap-2 justify-center mt-4">
                            {languageData.map((entry, index) => (
                               <div key={index} className="flex items-center gap-1.5 text-xs">
                                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                  <span className="font-medium text-muted-foreground">{entry.name}</span>
                                  <span className="font-bold">{((entry.value / stats.metrics.today.totalRequests) * 100).toFixed(1)}%</span>
                               </div>
                            ))}
                         </div>
                      </CardContent>
                   </Card>
                </div>

                {/* Resource Usage Charts */}
                <div className="grid gap-6 md:grid-cols-2">
                   <Card className="shadow-sm">
                      <CardHeader>
                        <CardTitle>CPU Usage</CardTitle>
                        <CardDescription>Server processor utilization over time</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[200px]">
                           <ResponsiveContainer width="100%" height="100%">
                             <AreaChart data={resourceHistory}>
                               <defs>
                                 <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                   <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                   <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                 </linearGradient>
                               </defs>
                               <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/20" />
                               <XAxis dataKey="time" hide />
                               <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} className="text-xs font-mono" width={35} />
                               <Tooltip 
                                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                                  formatter={(value: any) => [`${value}%`, 'CPU Load']}
                                  labelFormatter={(label) => `Time: ${label}`}
                               />
                               <Area type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" isAnimationActive={false} />
                             </AreaChart>
                           </ResponsiveContainer>
                        </div>
                      </CardContent>
                   </Card>

                   <Card className="shadow-sm">
                      <CardHeader>
                        <CardTitle>Memory Usage</CardTitle>
                        <CardDescription>Server RAM utilization over time</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[200px]">
                           <ResponsiveContainer width="100%" height="100%">
                             <AreaChart data={resourceHistory}>
                               <defs>
                                 <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                                   <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                                   <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                 </linearGradient>
                               </defs>
                               <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/20" />
                               <XAxis dataKey="time" hide />
                               <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} className="text-xs font-mono" width={35} />
                               <Tooltip 
                                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                                  formatter={(value: any) => [`${value}%`, 'Memory Usage']}
                                  labelFormatter={(label) => `Time: ${label}`}
                               />
                               <Area type="monotone" dataKey="memory" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorMem)" isAnimationActive={false} />
                             </AreaChart>
                           </ResponsiveContainer>
                        </div>
                      </CardContent>
                   </Card>
                </div>
             </div>
          )}

          {activeTab === 'metrics' && (
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 animate-in fade-in duration-500">
                {/* Reusing existing metric cards logic but adapting layout */}
                <Card>
                   <CardHeader><CardTitle className="text-lg">Total Requests</CardTitle></CardHeader>
                   <CardContent><div className="text-3xl font-bold">{stats.metrics.today.totalRequests}</div></CardContent>
                </Card>
                <Card>
                   <CardHeader><CardTitle className="text-lg">Success Rate</CardTitle></CardHeader>
                   <CardContent><div className="text-3xl font-bold text-green-500">{stats.metrics.today.successRate}</div></CardContent>
                </Card>
                 <Card>
                   <CardHeader><CardTitle className="text-lg">Avg Latency</CardTitle></CardHeader>
                   <CardContent><div className="text-3xl font-bold">{stats.metrics.today.latency.average}ms</div></CardContent>
                </Card>
                 <Card>
                   <CardHeader><CardTitle className="text-lg">Unique Containers</CardTitle></CardHeader>
                   <CardContent><div className="text-3xl font-bold">{stats.metrics.today.uniqueContainers}</div></CardContent>
                </Card>
             </div>
          )}
          
          {/* Placeholders for other tabs */}
          {activeTab === 'containers' && <div className="p-10 text-center text-muted-foreground">Detailed container management coming soon...</div>}
          {activeTab === 'logs' && <div className="p-10 text-center text-muted-foreground">Log viewer coming soon...</div>}
          {activeTab === 'settings' && <div className="p-10 text-center text-muted-foreground">Settings panel coming soon...</div>}

        </div>
      </main>

      {/* Test Runner Modal */}
      <TestRunnerModal open={showTestModal} onOpenChange={setShowTestModal} />
    </div>
  );
}
