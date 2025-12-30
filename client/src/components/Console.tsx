import { useEffect, useRef, useState, useCallback } from 'react';
import AnsiToHtml from 'ansi-to-html';
import { useEditorStore } from '@/stores/useEditorStore';
import type { EditorState } from '@/stores/useEditorStore';
import { useSocket } from '@/hooks/useSocket';
import { useTheme } from './theme-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Trash2, ArrowDownToLine, Send, Terminal as TerminalIcon, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
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
  const output = useEditorStore((state: EditorState) => state.output);
  const isRunning = useEditorStore((state: EditorState) => state.isRunning);
  const clearOutput = useEditorStore((state: EditorState) => state.clearOutput);
  const { sendInput } = useSocket();
  const [inputValue, setInputValue] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);

  // Select the appropriate ANSI converter based on theme
  const ansiConverter = theme === 'dark' ? darkAnsiConverter : lightAnsiConverter;

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (autoScroll && outputEndRef.current && !isMinimized) {
      outputEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output, autoScroll, isMinimized]);

  const handleSendInput = useCallback(() => {
    if (inputValue.trim() && isRunning) {
      sendInput(inputValue + '\n');
      setInputValue('');
    }
  }, [inputValue, isRunning, sendInput]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendInput();
      }
    },
    [handleSendInput]
  );

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

  return (
    <TooltipProvider>
      <div className={cn(
        "h-full w-full flex flex-col border-t overflow-hidden",
        "bg-background text-foreground"
      )}>
        {/* Console header - Minimizable like LeetCode */}
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
              {isRunning && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">Running</span>
                </div>
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
                        clearOutput();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Clear console</TooltipContent>
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
            {/* Console output */}
            <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
              <div className="p-4 font-mono text-sm whitespace-pre-wrap break-words">
                {output.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="inline-flex p-4 rounded-xl bg-muted/30 border-2 border-dashed border-border">
                      <Sparkles className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-muted-foreground font-medium">Output will appear here</p>
                      <p className="text-xs text-muted-foreground/70">Run your code to see results</p>
                    </div>
                  </div>
                ) : (
                  output.map((entry: { timestamp: number; data: string; type: 'stdout' | 'stderr' | 'system' }, index: number) => (
                    <div key={`${entry.timestamp}-${index}`} className="leading-relaxed">
                      {renderOutput(entry.data, entry.type)}
                    </div>
                  ))
                )}
                <div ref={outputEndRef} />
              </div>
            </ScrollArea>

            {/* Input area */}
            <div className="flex items-center gap-3 p-3 border-t bg-muted/20 shrink-0">
              <div className="flex items-center gap-2 px-3 py-2 bg-background border rounded-lg flex-1">
                <span className="text-green-600 dark:text-green-400 text-sm font-bold">❯</span>
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isRunning ? 'Type input and press Enter...' : 'Run code to enable input'}
                  disabled={!isRunning}
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
                      isRunning && inputValue.trim() 
                        ? "text-blue-600 dark:text-blue-400 hover:bg-blue-500/10" 
                        : "text-muted-foreground"
                    )}
                    onClick={handleSendInput}
                    disabled={!isRunning || !inputValue.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Send input (Enter)</TooltipContent>
              </Tooltip>
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}