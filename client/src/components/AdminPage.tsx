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
  FileText,
  Settings,
  AlertCircle,
  ArrowLeft,
  Users,
  UserPlus,
  Trash2,
  Edit2,
  Save,
  X,
  Upload
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
    activeStudents?: { id: string, regNo: string, name: string }[];
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

const LOG_LEVEL_COLORS: Record<string, string> = {
  debug: 'text-zinc-400',
  info: 'text-blue-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

const LOG_LEVEL_BG: Record<string, string> = {
  debug: 'bg-zinc-800/50',
  info: 'bg-blue-950/30',
  warn: 'bg-yellow-950/30',
  error: 'bg-red-950/30',
};

interface LogEntry {
  id: number;
  timestamp: string;
  level: string;
  category: string;
  message: string;
}

function LogsTab({ adminKey }: { adminKey: string }) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    if (!adminKey) return;
    const params = new URLSearchParams({ limit: '200' });
    if (levelFilter) params.set('level', levelFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    if (search) params.set('search', search);

    try {
      const res = await fetch(`/admin/logs?${params}`, {
        headers: { 'X-Admin-Key': adminKey },
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
        setCategories(data.categories);
        setSummary(data.summary);
      }
    } catch { /* ignore fetch errors */ }
  }, [adminKey, levelFilter, categoryFilter, search]);

  useEffect(() => {
    fetchLogs();
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [fetchLogs, autoRefresh]);

  return (
    <div className="space-y-4">
      {/* Summary counts */}
      <div className="flex gap-3 flex-wrap">
        {(['debug', 'info', 'warn', 'error'] as const).map(level => (
          <button
            key={level}
            onClick={() => setLevelFilter(levelFilter === level ? '' : level)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${levelFilter === level
              ? 'border-primary bg-primary/20 text-primary'
              : 'border-border bg-card hover:bg-accent'
              }`}
          >
            <span className={LOG_LEVEL_COLORS[level]}>{level.toUpperCase()}</span>
            <span className="ml-2 text-muted-foreground">{summary[level] ?? 0}</span>
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${autoRefresh
            ? 'border-green-600 bg-green-950/30 text-green-400'
            : 'border-border bg-card text-muted-foreground'
            }`}
        >
          {autoRefresh ? '● Live' : '○ Paused'}
        </button>
        <button
          onClick={fetchLogs}
          className="px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-card hover:bg-accent text-muted-foreground"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-1.5 rounded-md text-sm border border-border bg-card text-foreground"
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <Input
          placeholder="Search logs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs h-8 text-sm"
        />
      </div>

      {/* Log entries */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto font-mono text-xs">
          {entries.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No log entries found</div>
          ) : (
            entries.map(entry => (
              <div
                key={entry.id}
                className={`px-3 py-1.5 border-b border-border/50 flex items-start gap-3 ${LOG_LEVEL_BG[entry.level] || ''}`}
              >
                <span className="text-muted-foreground whitespace-nowrap w-[160px] shrink-0">
                  {new Date(entry.timestamp).toLocaleTimeString('en-US', {
                    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
                    fractionalSecondDigits: 3,
                  } as Intl.DateTimeFormatOptions)}
                </span>
                <span className={`uppercase w-[44px] shrink-0 font-semibold ${LOG_LEVEL_COLORS[entry.level] || ''}`}>
                  {entry.level}
                </span>
                <span className="text-purple-400 w-[140px] shrink-0 truncate">
                  {entry.category}
                </span>
                <span className="text-foreground break-all">
                  {entry.message}
                </span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}

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
  const [activeTab, setActiveTab] = useState('overview');
  const [resourceHistory, setResourceHistory] = useState<{ time: string; cpu: number; memory: number }[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const isFetchingRef = useRef(false);

  const fetchStats = useCallback(async () => {
    if (!adminKey) return;

    // If already fetching, don't start a new request (prevents React Strict Mode double-mount issues)
    if (isFetchingRef.current) {
      return;
    }

    // Only set loading on initial fetch (first time)
    if (!hasLoadedOnceRef.current) {
      setLoading(true);
    }

    isFetchingRef.current = true;

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/admin/stats`, {
        signal: abortControllerRef.current.signal,
        cache: 'no-store', // Prevent caching
        headers: { 'X-Admin-Key': adminKey },
      });
      if (!response.ok) {
        if (response.status === 401) {
          // Key is no longer valid, log out
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
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetchingRef.current = false;
    }
  }, [adminKey]);

  // Load saved key from localStorage on mount
  useEffect(() => {
    const savedKey = sessionStorage.getItem('adminKey');
    if (savedKey) {
      setAdminKey(savedKey);
      setIsAuthenticated(true);
      setLoading(true); // Set loading immediately when we have a saved key
    }
  }, []);

  // Fetch stats when authenticated
  useEffect(() => {
    if (!isAuthenticated || !adminKey) return;

    fetchStats();
    const interval = setInterval(() => {
      fetchStats();
    }, 5000);
    return () => {
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
      const response = await fetch(`/admin/stats`, {
        headers: { 'X-Admin-Key': keyInput },
      });
      if (!response.ok) {
        throw new Error(response.status === 401 ? 'Invalid admin key' : 'Authentication failed');
      }

      // Key is valid, save and authenticate
      setAdminKey(keyInput);
      setIsAuthenticated(true);
      sessionStorage.setItem('adminKey', keyInput);
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
    sessionStorage.removeItem('adminKey');
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
      const response = await fetch(`/admin/reset`, {
        method: 'POST',
        headers: { 'X-Admin-Key': adminKey },
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
    try {
      const response = await fetch(`/admin/report/download?date=${date}`, {
        headers: { 'X-Admin-Key': adminKey },
      });
      if (!response.ok) throw new Error('Failed to download report');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    }
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

  // Show error state only when there's an actual error
  if (error) {
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
            variant={activeTab === 'students' ? 'secondary' : 'ghost'}
            className="w-full justify-start"
            onClick={() => setActiveTab('students')}
          >
            <Users className="h-4 w-4 mr-2" />
            Students
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
                <Button variant="ghost" size="icon"><LayoutDashboard className="h-5 w-5" /></Button>
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
                        {Array.from({ length: Math.min(stats.clients.activeClients, 3) }).map((_, i) => (
                          <div key={i} className="w-6 h-6 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-[10px] font-bold">
                            {i + 1}
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
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
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

              {/* Active Students Table */}
              <Card className="shadow-sm mt-6">
                <CardHeader>
                  <CardTitle>Connected Students</CardTitle>
                  <CardDescription>Live session details of verified students</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <div className="max-h-[300px] overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b bg-muted/50 text-left sticky top-0">
                          <tr>
                            <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Register No</th>
                            <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                            <th className="px-4 py-3 font-medium text-muted-foreground text-right">Socket ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.clients.activeStudents && stats.clients.activeStudents.length > 0 ? (
                            stats.clients.activeStudents.map((student) => (
                              <tr key={student.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3 font-medium">{student.regNo}</td>
                                <td className="px-4 py-3">{student.name}</td>
                                <td className="px-4 py-3 text-right text-muted-foreground font-mono text-xs">{student.id.substring(0, 8)}...</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                                No students currently connected via verification portal.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
          )
          }

          {activeTab === 'students' && <StudentsTab adminKey={adminKey} />}
          {activeTab === 'logs' && <LogsTab adminKey={adminKey} />}
          {activeTab === 'settings' && <div className="p-10 text-center text-muted-foreground">Settings panel coming soon...</div>}

        </div >
      </main >

      {/* Test Runner Modal */}
      < TestRunnerModal open={showTestModal} onOpenChange={setShowTestModal} />
    </div >
  );
}
