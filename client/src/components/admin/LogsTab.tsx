/**
 * Admin Dashboard – Logs Tab
 * Centralized server log viewer with filtering, search, live tail
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '../ui/input';
import { RefreshCw } from 'lucide-react';

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

interface LogsTabProps {
  adminKey: string;
}

export function LogsTab({ adminKey }: LogsTabProps) {
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
    <div className="space-y-4 animate-in fade-in duration-500">
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
