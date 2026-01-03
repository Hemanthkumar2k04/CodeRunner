import { useEffect, useRef, useState, useCallback } from 'react';
import AnsiToHtml from 'ansi-to-html';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEditorStore, MAX_OUTPUT_ENTRIES_PER_CONSOLE } from '@/stores/useEditorStore';
import type { EditorState } from '@/stores/useEditorStore';
import { useSocket } from '@/hooks/useSocket';
import { useTheme } from './theme-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Trash2, ArrowDownToLine, Send, Terminal as TerminalIcon, X, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// ANSI to HTML converter instances for light and dark themes
const darkAnsiConverter = new AnsiToHtml({
  fg: '#d4d4d4',
  bg: 'transparent',
  newline: true,
  escapeXML: true,
  colors: {
    0: '#1e1e1e',
    1: '#f87171',
    2: '#4ade80',
    3: '#facc15',
    4: '#60a5fa',
    5: '#c084fc',
    6: '#22d3ee',
    7: '#d4d4d4',
    8: '#737373',
    9: '#fca5a5',
    10: '#86efac',
    11: '#fde047',
    12: '#93c5fd',
    13: '#d8b4fe',
    14: '#67e8f9',
    15: '#ffffff',
  },
});

const lightAnsiConverter = new AnsiToHtml({
  fg: '#1e1e1e',
  bg: 'transparent',
  newline: true,
  escapeXML: true,
  colors: {
    0: '#ffffff',
    1: '#dc2626',
    2: '#16a34a',
    3: '#ca8a04',
    4: '#2563eb',
    5: '#9333ea',
    6: '#0891b2',
    7: '#1e1e1e',
    8: '#737373',
    9: '#ef4444',
    10: '#22c55e',
    11: '#eab308',
    12: '#3b82f6',
    13: '#a855f7',
    14: '#06b6d4',
    15: '#000000',
  },
});

interface ConsoleProps {
  isMinimized: boolean;
  onToggleMinimize: () => void;
}

export function Console({ isMinimized, onToggleMinimize }: ConsoleProps) {
  const { theme } = useTheme();
  const consoles = useEditorStore((state: EditorState) => state.consoles);
  const activeConsoleId = useEditorStore((state: EditorState) => state.activeConsoleId);
  const setActiveConsole = useEditorStore((state: EditorState) => state.setActiveConsole);
  const clearConsole = useEditorStore((state: EditorState) => state.clearConsole);
  const deleteConsole = useEditorStore((state: EditorState) => state.deleteConsole);
  const { sendInput } = useSocket();
  const [inputValue, setInputValue] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollingRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Select the appropriate ANSI converter based on theme
  const ansiConverter = theme === 'dark' ? darkAnsiConverter : lightAnsiConverter;

  // Get the current active console
  const activeConsole = activeConsoleId ? consoles[activeConsoleId] : null;
  const consoleArray = Object.values(consoles).sort((a, b) => a.createdAt - b.createdAt);

  // If no console is active but consoles exist, set the first one as active
  useEffect(() => {
    if (!activeConsoleId && consoleArray.length > 0) {
      setActiveConsole(consoleArray[0].fileId);
    }
  }, [activeConsoleId, consoleArray.length, setActiveConsole]);

  // Virtual list configuration for each console
  // Virtual list configuration - only for active console to avoid hook violations
  // We only need virtualization for the visible console anyway
  const rowVirtualizer = useVirtualizer({
    count: activeConsole?.output.length || 0,
    getScrollElement: () => activeConsoleId ? scrollingRefs.current[activeConsoleId] : null,
    estimateSize: useCallback(() => 28, []),
    overscan: 10,
    measureElement:
      typeof window !== 'undefined' && 'ResizeObserver' in window
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
  });

  // Auto-scroll to bottom when new output arrives in active console
  useEffect(() => {
    if (autoScroll && !isMinimized && activeConsole && activeConsole.output.length > 0) {
      setTimeout(() => {
        const ref = scrollingRefs.current[activeConsole.fileId];
        if (ref) {
          ref.scrollTop = ref.scrollHeight;
        }
      }, 0);
    }
  }, [activeConsole?.output.length, autoScroll, isMinimized, activeConsole?.fileId]);

  const handleSendInput = useCallback(() => {
    if (inputValue.trim() && activeConsole?.isRunning) {
      sendInput(inputValue + '\n');
      setInputValue('');
    }
  }, [inputValue, activeConsole?.isRunning, sendInput]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendInput();
      }
    },
    [handleSendInput]
  );

  const handleClearConsole = useCallback(() => {
    if (activeConsoleId) {
      clearConsole(activeConsoleId);
    }
  }, [activeConsoleId, clearConsole]);

  const handleCloseConsole = useCallback((fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteConsole(fileId);
  }, [deleteConsole]);

  const renderOutput = (text: string, type: 'stdout' | 'stderr' | 'system') => {
    const html = ansiConverter.toHtml(text);
    return (
      <span
        className={cn(
          type === 'stderr' && 'text-red-600 dark:text-red-400',
          type === 'system' && 'text-blue-600 dark:text-blue-400 italic'
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  // Calculate buffer usage for active console
  const outputUsagePercent = activeConsole 
    ? Math.round((activeConsole.output.length / MAX_OUTPUT_ENTRIES_PER_CONSOLE) * 100)
    : 0;
  const isNearCapacity = outputUsagePercent > 80;

  return (
    <TooltipProvider>
      <div className={cn(
        "h-full w-full flex flex-col border-t overflow-hidden",
        "bg-background text-foreground"
      )}>
        {/* Console header - Minimizable */}
        <div 
          className={cn(
            "flex items-center justify-between px-4 py-3 border-b shrink-0 cursor-pointer select-none",
            "bg-muted/20 hover:bg-muted/30 transition-colors"
          )}
          onClick={onToggleMinimize}
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-blue-500/10">
              <TerminalIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold">Console</span>
              {consoleArray.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({consoleArray.length} {consoleArray.length === 1 ? 'console' : 'consoles'})
                </span>
              )}
              {activeConsole?.isRunning && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">Running</span>
                </div>
              )}
              {isNearCapacity && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20">
                      <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                        {outputUsagePercent}% capacity
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    Output buffer approaching limit ({activeConsole?.output.length.toLocaleString()} / {MAX_OUTPUT_ENTRIES_PER_CONSOLE.toLocaleString()} entries)
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {!isMinimized && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-8 w-8 transition-all',
                        autoScroll && 'text-blue-600 dark:text-blue-400 bg-blue-500/10'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        setAutoScroll(!autoScroll);
                      }}
                    >
                      <ArrowDownToLine className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearConsole();
                      }}
                      disabled={!activeConsoleId}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Clear active console</TooltipContent>
                </Tooltip>
              </>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleMinimize();
                  }}
                >
                  {isMinimized ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isMinimized ? 'Expand console' : 'Minimize console'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Console content - Only show when not minimized */}
        {!isMinimized && (
          <>
            {consoleArray.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-4">
                <div className="inline-flex p-4 rounded-xl bg-muted/30 border-2 border-dashed border-border">
                  <TerminalIcon className="h-10 w-10 text-muted-foreground" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-muted-foreground font-medium">No consoles yet</p>
                  <p className="text-xs text-muted-foreground/70">Run a file to create a console</p>
                </div>
              </div>
            ) : (
              <Tabs 
                value={activeConsoleId || undefined} 
                onValueChange={setActiveConsole}
                className="flex-1 flex flex-col min-h-0"
              >
                {/* Console tabs */}
                <TabsList className="w-full justify-start rounded-none border-b bg-muted/20 h-auto p-0">
                  {consoleArray.map((console) => (
                    <TabsTrigger
                      key={console.fileId}
                      value={console.fileId}
                      className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-muted/30 px-3 py-2 gap-2"
                    >
                      <span className="text-sm max-w-[200px] truncate">{console.filePath}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0 hover:bg-destructive/10"
                        onClick={(e) => handleCloseConsole(console.fileId, e)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* Console content for each tab */}
                {consoleArray.map((console) => {
                  const isActive = console.fileId === activeConsoleId;
                  return (
                    <TabsContent
                      key={console.fileId}
                      value={console.fileId}
                      className="flex-1 min-h-0 m-0 data-[state=active]:flex data-[state=active]:flex-col"
                    >
                      {/* Output area */}
                      <div
                        ref={(el) => { scrollingRefs.current[console.fileId] = el; }}
                        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden font-mono text-sm"
                      >
                        {console.output.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="text-center space-y-1">
                              <p className="text-muted-foreground font-medium">Output will appear here</p>
                              <p className="text-xs text-muted-foreground/70">Run your code to see results</p>
                            </div>
                          </div>
                        ) : isActive && rowVirtualizer ? (
                          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                            {rowVirtualizer.getVirtualItems().map((virtualItem: any) => {
                              const entry = console.output[virtualItem.index];
                              return (
                                <div
                                  key={`${entry.timestamp}-${virtualItem.index}`}
                                  data-index={virtualItem.index}
                                  ref={rowVirtualizer.measureElement}
                                  style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    transform: `translateY(${virtualItem.start}px)`,
                                  }}
                                  className="px-4 py-1 leading-relaxed whitespace-pre-wrap break-words"
                                >
                                  {renderOutput(entry.data, entry.type)}
                                </div>
                              );
                            })}
                          </div>
                        ) : !isActive ? null : (
                          // Fallback for non-virtualized display (if virtualizer fails)
                          <div className="px-4 py-1">
                            {console.output.map((entry, idx) => (
                              <div
                                key={`${entry.timestamp}-${idx}`}
                                className="leading-relaxed whitespace-pre-wrap break-words"
                              >
                                {renderOutput(entry.data, entry.type)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Input area */}
                      <div className="flex items-center gap-3 p-3 border-t bg-muted/20 shrink-0">
                        <div className="flex items-center gap-2 px-3 py-2 bg-background border rounded-lg flex-1">
                          <span className="text-green-600 dark:text-green-400 text-sm font-bold">❯</span>
                          <Input
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={console.isRunning ? 'Type input and press Enter...' : 'Run code to enable input'}
                            disabled={!console.isRunning}
                            className="flex-1 bg-transparent border-0 placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 h-auto p-0"
                          />
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className={cn(
                                "h-9 w-9 rounded-lg transition-all",
                                console.isRunning && inputValue.trim() 
                                  ? "text-blue-600 dark:text-blue-400 hover:bg-blue-500/10" 
                                  : "text-muted-foreground"
                              )}
                              onClick={handleSendInput}
                              disabled={!console.isRunning || !inputValue.trim()}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Send input (Enter)</TooltipContent>
                        </Tooltip>
                      </div>
                    </TabsContent>
                  );
                })}
              </Tabs>
            )}
          </>
        )}
      </div>
    </TooltipProvider>
  );
}