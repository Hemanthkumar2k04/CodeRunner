/**
 * Centralized Logger Module
 * 
 * All server logging goes through this module. Logs are stored in an
 * in-memory ring buffer and exposed via the admin API for the dashboard.
 * 
 * Terminal output is minimal: only client connect/disconnect events
 * and critical startup/shutdown messages are printed to stdout.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
    id: number;
    timestamp: string;
    level: LogLevel;
    category: string;
    message: string;
    meta?: Record<string, unknown>;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

// Categories whose info-level messages are printed to stdout
const CONSOLE_CATEGORIES = new Set([
    'Client',
    'Server',
    'Shutdown',
]);

class Logger {
    private buffer: LogEntry[] = [];
    private maxBufferSize: number;
    private idCounter: number = 0;
    private minLevel: LogLevel;

    constructor(maxBufferSize = 2000, minLevel: LogLevel = 'debug') {
        this.maxBufferSize = maxBufferSize;
        this.minLevel = minLevel;
    }

    // ── Core log method ──────────────────────────────────────────────

    private log(level: LogLevel, category: string, message: string, meta?: Record<string, unknown>): void {
        if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) return;

        const entry: LogEntry = {
            id: ++this.idCounter,
            timestamp: new Date().toISOString(),
            level,
            category,
            message,
            meta,
        };

        // Push to ring buffer
        this.buffer.push(entry);
        if (this.buffer.length > this.maxBufferSize) {
            this.buffer.shift();
        }

        // Console output — only for certain categories or warn/error levels
        // that are critical enough to warrant terminal visibility
        if (level === 'error') {
            console.error(`[${category}] ${message}`);
        } else if (level === 'warn') {
            // Warnings go to console only for critical categories
            if (CONSOLE_CATEGORIES.has(category)) {
                console.warn(`[${category}] ${message}`);
            }
        } else if (CONSOLE_CATEGORIES.has(category)) {
            console.log(`[${category}] ${message}`);
        }
        // All other logs are silent in the terminal — only in the buffer
    }

    // ── Public convenience methods ───────────────────────────────────

    debug(category: string, message: string, meta?: Record<string, unknown>): void {
        this.log('debug', category, message, meta);
    }

    info(category: string, message: string, meta?: Record<string, unknown>): void {
        this.log('info', category, message, meta);
    }

    warn(category: string, message: string, meta?: Record<string, unknown>): void {
        this.log('warn', category, message, meta);
    }

    error(category: string, message: string, meta?: Record<string, unknown>): void {
        this.log('error', category, message, meta);
    }

    // ── Query methods (for admin API) ────────────────────────────────

    /**
     * Get recent log entries, optionally filtered by level and/or category.
     * Returns newest-first.
     */
    getEntries(options: {
        limit?: number;
        level?: LogLevel;
        category?: string;
        sinceId?: number;
        search?: string;
    } = {}): LogEntry[] {
        const { limit = 100, level, category, sinceId, search } = options;

        let entries = this.buffer;

        if (sinceId !== undefined) {
            entries = entries.filter(e => e.id > sinceId);
        }

        if (level) {
            const minPriority = LOG_LEVEL_PRIORITY[level];
            entries = entries.filter(e => LOG_LEVEL_PRIORITY[e.level] >= minPriority);
        }

        if (category) {
            entries = entries.filter(e => e.category === category);
        }

        if (search) {
            const lowerSearch = search.toLowerCase();
            entries = entries.filter(e =>
                e.message.toLowerCase().includes(lowerSearch) ||
                e.category.toLowerCase().includes(lowerSearch)
            );
        }

        // Return most recent first, limited
        return entries.slice(-limit).reverse();
    }

    /**
     * Get all unique category names currently in the buffer.
     */
    getCategories(): string[] {
        const categories = new Set<string>();
        for (const entry of this.buffer) {
            categories.add(entry.category);
        }
        return Array.from(categories).sort();
    }

    /**
     * Get counts by level for summary display.
     */
    getSummary(): Record<LogLevel, number> {
        const counts: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 };
        for (const entry of this.buffer) {
            counts[entry.level]++;
        }
        return counts;
    }

    /**
     * Get the total number of entries in the buffer.
     */
    get size(): number {
        return this.buffer.length;
    }

    /**
     * Clear all entries.
     */
    clear(): void {
        this.buffer = [];
    }
}

// Singleton
export const logger = new Logger();
