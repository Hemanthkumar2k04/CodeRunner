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
  FileText,
  FileBarChart,
  AlertCircle,
  ArrowLeft,
  Users,
  UserPlus,
  Trash2,
  Edit2,
  Save,
  X,
  Upload,
  Container
} from 'lucide-react';
import Papa from 'papaparse';
import * as xlsx from 'xlsx';

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
  clients: {
    activeClients: number;
    activeExecutions: number;
    activeStudents?: { id: string; regNo: string; name: string }[];
  };
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

type TabId = 'overview' | 'metrics' | 'containers' | 'logs' | 'loadtests' | 'students';

const NAV_ITEMS: { id: TabId; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'metrics', label: 'Metrics', icon: Activity },
  { id: 'containers', label: 'Containers', icon: Container },
  { id: 'logs', label: 'Logs', icon: FileText },
  { id: 'loadtests', label: 'Load Tests', icon: FileBarChart },
  { id: 'students', label: 'Students', icon: Users },
];

interface Student {
  id: number;
  regNo: string;
  name: string;
  department: string;
  year: string;
  created_at: string;
}

function StudentsTab({ adminKey }: { adminKey: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add/Edit state
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ regNo: '', name: '', department: '', year: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const normalizeYear = (val: string): string => {
    const norm = String(val).trim().toLowerCase();
    if (['1', 'i', 'first'].includes(norm)) return 'I';
    if (['2', 'ii', 'second'].includes(norm)) return 'II';
    if (['3', 'iii', 'third'].includes(norm)) return 'III';
    if (['4', 'iv', 'fourth'].includes(norm)) return 'IV';
    return String(val).trim().toUpperCase();
  };

  const normalizeDept = (val: string): string => {
    const norm = String(val).trim().toLowerCase();
    const map: Record<string, string> = {
      'computer science': 'CSE',
      'computer science and engineering': 'CSE',
      'cse': 'CSE',
      'information technology': 'IT',
      'it': 'IT',
      'electronics and communication': 'ECE',
      'electronics and communication engineering': 'ECE',
      'ece': 'ECE',
      'electrical and electronics': 'EEE',
      'electrical and electronics engineering': 'EEE',
      'eee': 'EEE',
      'mechanical': 'MECH',
      'mechanical engineering': 'MECH',
      'mech': 'MECH',
      'civil': 'CIVIL',
      'civil engineering': 'CIVIL',
      'artificial intelligence and data science': 'AI&DS',
      'ai&ds': 'AI&DS',
      'aids': 'AI&DS',
      'artificial intelligence and machine learning': 'AIML',
      'aiml': 'AIML',
      'ai&ml': 'AIML'
    };
    return map[norm] || String(val).trim().toUpperCase();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    let parsedData: any[] = [];

    try {
      setLoading(true);
      if (fileName.endsWith('.csv')) {
        const text = await file.text();
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        parsedData = result.data;
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = xlsx.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        parsedData = xlsx.utils.sheet_to_json(worksheet, { defval: '' });
      } else {
        throw new Error('Unsupported file format. Please upload a CSV or Excel file.');
      }

      const normalizedStudents = parsedData.map((row: any) => {
        const getVal = (keys: string[]) => {
          const key = Object.keys(row).find(k => keys.includes(k.toLowerCase().trim()));
          return key ? String(row[key] || '') : '';
        };

        const regNo = getVal(['regno', 'reg_no', 'register number', 'registration number', 'reg no']);
        const name = getVal(['name', 'student name']);
        const department = getVal(['department', 'dept']);
        const year = getVal(['year', 'yr']);

        if (!regNo || !name || !department || !year) return null;

        return {
          regNo: regNo.trim(),
          name: name.trim(),
          department: normalizeDept(department),
          year: normalizeYear(year)
        };
      }).filter(Boolean);

      if (normalizedStudents.length === 0) {
        throw new Error('No valid student records found. Check column headers (RegNo, Name, Department, Year).');
      }

      const res = await fetch('/admin/students/bulk', {
        method: 'POST',
        headers: {
          'X-Admin-Key': adminKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ students: normalizedStudents })
      });

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.error || 'Failed to bulk import students');
      }

      alert(`Successfully imported ${resData.count} students!`);
      await fetchStudents();

    } catch (err: any) {
      alert(err.message);
      setLoading(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/admin/students', {
        headers: { 'X-Admin-Key': adminKey }
      });
      if (!res.ok) throw new Error('Failed to fetch students');
      const data = await res.json();
      setStudents(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleSave = async () => {
    try {
      if (!formData.regNo || !formData.name || !formData.department || !formData.year) {
        alert('All fields are required');
        return;
      }

      const url = editingId ? `/admin/students/${editingId}` : '/admin/students';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'X-Admin-Key': adminKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save student');
      }

      await fetchStudents();
      cancelEdit();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this student?')) return;
    try {
      const res = await fetch(`/admin/students/${id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Key': adminKey }
      });
      if (!res.ok) throw new Error('Failed to delete student');
      await fetchStudents();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const startEdit = (student: Student) => {
    setEditingId(student.id);
    setFormData({ regNo: student.regNo, name: student.name, department: student.department, year: student.year });
    setIsAdding(false);
  };

  const startAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData({ regNo: '', name: '', department: '', year: '' });
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ regNo: '', name: '', department: '', year: '' });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Student Management</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage authorized users for the CodeRunner Lab</p>
        </div>
        {!isAdding && !editingId && (
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFile}
              accept=".csv,.xlsx,.xls"
              className="hidden"
            />
            <Button onClick={() => fileInputRef.current?.click()} size="sm" variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Import CSV/Excel
            </Button>
            <Button onClick={startAdd} size="sm">
              <UserPlus className="w-4 h-4 mr-2" />
              Add Student
            </Button>
          </div>
        )}
      </div>

      {(isAdding || editingId) && (
        <Card className="border-primary/50 shadow-sm animate-in fade-in slide-in-from-top-2">
          <CardHeader>
            <CardTitle className="text-lg">{isAdding ? 'Add New Student' : 'Edit Student'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium">Register No</label>
                <Input value={formData.regNo} onChange={e => setFormData({ ...formData, regNo: e.target.value })} placeholder="e.g. 310621104000" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Name</label>
                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. John Doe" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Department</label>
                <Input value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} placeholder="e.g. CSE" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Year</label>
                <Input value={formData.year} onChange={e => setFormData({ ...formData, year: e.target.value })} placeholder="e.g. III" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={cancelEdit}><X className="w-4 h-4 mr-2" /> Cancel</Button>
              <Button onClick={handleSave}><Save className="w-4 h-4 mr-2" /> Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Reg No</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground md:table-cell hidden">Department</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground md:table-cell hidden">Year</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground md:table-cell hidden text-right">Created</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right w-[120px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center"><RefreshCw className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : error ? (
                  <tr><td colSpan={6} className="p-8 text-center text-destructive">{error}</td></tr>
                ) : students.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No students found in the database. Add one to get started.</td></tr>
                ) : (
                  students.map(student => (
                    <tr key={student.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{student.regNo}</td>
                      <td className="px-4 py-3">{student.name}</td>
                      <td className="px-4 py-3 md:table-cell hidden">{student.department}</td>
                      <td className="px-4 py-3 md:table-cell hidden">{student.year}</td>
                      <td className="px-4 py-3 md:table-cell hidden text-muted-foreground text-xs text-right whitespace-nowrap">
                        {new Date(student.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30" onClick={() => startEdit(student)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30" onClick={() => handleDelete(student.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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
          {activeTab === 'students' && <StudentsTab adminKey={adminKey} />}
        </div>
      </main>

      <TestRunnerModal open={showTestModal} onOpenChange={setShowTestModal} />
    </div>
  );
}
