import { useEffect, useRef, useState, useCallback } from 'react';
import AnsiToHtml from 'ansi-to-html';
import { useEditorStore } from '@/stores/useEditorStore';
import type { EditorState } from '@/stores/useEditorStore';
import { useSocket } from '@/hooks/useSocket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Trash2, ArrowDownToLine, Send, Terminal as TerminalIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ANSI to HTML converter instance
const ansiConverter = new AnsiToHtml({
  fg: '#d4d4d4',
  bg: 'transparent',
  newline: true,
  escapeXML: true,
  colors: {
    0: '#1e1e1e',   // Black
    1: '#f87171',   // Red
    2: '#4ade80',   // Green
    3: '#facc15',   // Yellow
    4: '#60a5fa',   // Blue
    5: '#c084fc',   // Magenta
    6: '#22d3ee',   // Cyan
    7: '#d4d4d4',   // White
    8: '#737373',   // Bright Black
    9: '#fca5a5',   // Bright Red
    10: '#86efac',  // Bright Green
    11: '#fde047',  // Bright Yellow
    12: '#93c5fd',  // Bright Blue
    13: '#d8b4fe',  // Bright Magenta
    14: '#67e8f9',  // Bright Cyan
    15: '#ffffff',  // Bright White
  },
});

export function Console() {
  const output = useEditorStore((state: EditorState) => state.output);
  const isRunning = useEditorStore((state: EditorState) => state.isRunning);
  const clearOutput = useEditorStore((state: EditorState) => state.clearOutput);
  const { sendInput } = useSocket();
  const [inputValue, setInputValue] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (autoScroll && outputEndRef.current) {
      outputEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output, autoScroll]);

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
          type === 'stderr' && 'text-red-400',
          type === 'system' && 'text-blue-400 italic'
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  return (
    <TooltipProvider>
      <div className="h-full w-full flex flex-col bg-[#1e1e1e] text-gray-200 border-t overflow-hidden">
        {/* Console header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-[#252526] shrink-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <TerminalIcon className="h-4 w-4" />
            <span>Console</span>
            {isRunning && (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Running
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-7 w-7 text-gray-400 hover:text-gray-200 hover:bg-gray-700',
                    autoScroll && 'text-blue-400'
                  )}
                  onClick={() => setAutoScroll(!autoScroll)}
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
                  className="h-7 w-7 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                  onClick={clearOutput}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear console</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Console output */}
        <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
          <div className="p-3 font-mono text-sm whitespace-pre-wrap break-words">
            {output.length === 0 ? (
              <div className="text-gray-500 italic">
                Output will appear here when you run your code...
              </div>
            ) : (
              output.map((entry: any, index: number) => (
                <div key={`${entry.timestamp}-${index}`}>
                  {renderOutput(entry.data, entry.type)}
                </div>
              ))
            )}
            <div ref={outputEndRef} />
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="flex items-center gap-2 p-2 border-t border-gray-700 bg-[#252526] shrink-0">
          <span className="text-gray-500 text-sm">{'>'}</span>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRunning ? 'Type input and press Enter...' : 'Run code to enable input'}
            disabled={!isRunning}
            className="flex-1 bg-[#1e1e1e] border-gray-700 text-gray-200 placeholder:text-gray-500 focus-visible:ring-blue-500"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                onClick={handleSendInput}
                disabled={!isRunning || !inputValue.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send input</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
