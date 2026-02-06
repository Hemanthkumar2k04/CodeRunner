import { useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from './theme-provider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Play, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  Code, 
  FileText,
  GripVertical,
  X
} from 'lucide-react';
import type { NotebookCell as NotebookCellType, NotebookOutput } from '@/lib/notebook-utils';
import { formatCellOutput } from '@/lib/notebook-utils';
import type { CellOutput as CellOutputType } from '@/hooks/useNotebookKernel';

interface NotebookCellProps {
  cell: NotebookCellType;
  index: number;
  isActive: boolean;
  isRunning: boolean;
  executionCount: number | null;
  outputs: CellOutputType[];
  language: string;
  onSelect: () => void;
  onSourceChange: (source: string) => void;
  onRun: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChangeType: (type: 'code' | 'markdown') => void;
  onClearOutput: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export function NotebookCell({
  cell,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  index: _index,
  isActive,
  isRunning,
  executionCount,
  outputs,
  language,
  onSelect,
  onSourceChange,
  onRun,
  onDelete,
  onMoveUp,
  onMoveDown,
  onChangeType,
  onClearOutput,
  canMoveUp,
  canMoveDown,
}: NotebookCellProps) {
  const { theme } = useTheme();
  const [isEditing, setIsEditing] = useState(cell.cell_type === 'code');
  const editorRef = useRef<unknown>(null);

  // For markdown cells, toggle between edit and preview
  const handleDoubleClick = () => {
    if (cell.cell_type === 'markdown') {
      setIsEditing(true);
    }
  };

  const handleMarkdownBlur = () => {
    if (cell.cell_type === 'markdown' && cell.source.trim()) {
      setIsEditing(false);
    }
  };

  // Calculate editor height based on content - minimum 5 lines (100px)
  const lineCount = cell.source.split('\n').length;
  const editorHeight = Math.max(100, Math.min(Math.max(lineCount, 5) * 20 + 20, 500));

  return (
    <div className="flex items-start gap-2 mb-2 group" style={{ width: '100%', maxWidth: '100%' }}>
      {/* Execution indicator - outside the cell */}
      {cell.cell_type === 'code' && (
        <div className="w-10 flex-shrink-0 flex items-center justify-end pt-3">
          {isRunning ? (
            <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          ) : executionCount !== null ? (
            <span className="text-xs text-muted-foreground font-mono">
              [{executionCount}]
            </span>
          ) : (
            <span className="text-xs text-muted-foreground font-mono">[ ]</span>
          )}
        </div>
      )}
      {cell.cell_type === 'markdown' && <div className="w-10 flex-shrink-0" />}
      
      {/* Main cell container */}
      <div
        className={cn(
          'flex-1 min-w-0 relative border rounded-lg transition-all overflow-hidden',
          isActive 
            ? 'border-blue-500 shadow-sm' 
            : 'border-border hover:border-muted-foreground/50',
          isRunning && 'border-yellow-500'
        )}
        style={{ maxWidth: 'calc(100% - 48px)' }}
        onClick={onSelect}
      >
        {/* Cell header with controls */}
      <div className={cn(
        'flex items-center gap-1 px-2 py-1 border-b bg-muted/30',
        'opacity-0 group-hover:opacity-100 transition-opacity',
        isActive && 'opacity-100'
      )}>
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
        
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2"
          onClick={(e) => { e.stopPropagation(); onChangeType('code'); }}
          disabled={cell.cell_type === 'code'}
        >
          <Code className="h-3 w-3 mr-1" />
          Code
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2"
          onClick={(e) => { e.stopPropagation(); onChangeType('markdown'); }}
          disabled={cell.cell_type === 'markdown'}
        >
          <FileText className="h-3 w-3 mr-1" />
          Markdown
        </Button>

        <div className="flex-1" />

        {cell.cell_type === 'code' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => { e.stopPropagation(); onRun(); }}
            disabled={isRunning}
          >
            <Play className="h-3 w-3" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          disabled={!canMoveUp}
        >
          <ChevronUp className="h-3 w-3" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          disabled={!canMoveDown}
        >
          <ChevronDown className="h-3 w-3" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Cell content */}
      <div className="relative overflow-hidden min-w-0" onDoubleClick={handleDoubleClick}>
        {cell.cell_type === 'code' ? (
          // Code cell - always show editor
          <div className="overflow-hidden w-full max-w-full">
            <Editor
              height={editorHeight}
              width="100%"
              language={language}
              value={cell.source}
              onChange={(value) => onSourceChange(value || '')}
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: 'on',
                lineNumbers: 'on',
                glyphMargin: false,
                folding: false,
                lineDecorationsWidth: 10,
                lineNumbersMinChars: 4,
                renderLineHighlight: 'none',
                overviewRulerBorder: false,
                hideCursorInOverviewRuler: true,
                overviewRulerLanes: 0,
                scrollbar: {
                  vertical: 'hidden',
                  horizontal: 'hidden',
                  verticalScrollbarSize: 0,
                  horizontalScrollbarSize: 0,
                },
                padding: { top: 8, bottom: 8 },
                fontSize: 13,
                fontFamily: "'Fira Code', 'Consolas', monospace",
              }}
              onMount={(editor: any) => {
                editorRef.current = editor;

                const dom = editor.getDomNode?.();
                if (!dom) return;

                const onPaste = (e: ClipboardEvent) => {
                  e.preventDefault();
                  try { editor.focus(); } catch {}
                };

                const onKeyDown = (e: KeyboardEvent) => {
                  if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
                    e.preventDefault();
                  }
                  if (e.shiftKey && e.key === 'Insert') {
                    e.preventDefault();
                  }
                };

                const onDrop = (e: DragEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                };

                const onDragOver = (e: DragEvent) => e.preventDefault();

                dom.addEventListener('paste', onPaste);
                dom.addEventListener('keydown', onKeyDown);
                dom.addEventListener('drop', onDrop);
                dom.addEventListener('dragover', onDragOver);

                const dispose = () => {
                  try {
                    dom.removeEventListener('paste', onPaste);
                    dom.removeEventListener('keydown', onKeyDown);
                    dom.removeEventListener('drop', onDrop);
                    dom.removeEventListener('dragover', onDragOver);
                  } catch {}
                };

                try {
                  editor.onDidDispose(dispose);
                } catch {
                  window.addEventListener('unload', dispose);
                }
              }}
            />
          </div>
        ) : (
          // Markdown cell - toggle between edit and preview
          isEditing ? (
            <div onBlur={handleMarkdownBlur}>
              <Editor
                height={editorHeight}
                language="markdown"
                value={cell.source}
                onChange={(value) => onSourceChange(value || '')}
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  lineNumbers: 'off',
                  glyphMargin: false,
                  folding: false,
                  lineDecorationsWidth: 0,
                  renderLineHighlight: 'none',
                  wordWrap: 'on',
                  scrollbar: {
                    vertical: 'hidden',
                    horizontal: 'hidden',
                  },
                  padding: { top: 8, bottom: 8 },
                  fontSize: 14,
                }}
                onMount={(editor: any) => {
                  const dom = editor.getDomNode?.();
                  if (!dom) return;

                  const onPaste = (e: ClipboardEvent) => {
                    e.preventDefault();
                    try { editor.focus(); } catch {}
                  };

                  const onKeyDown = (e: KeyboardEvent) => {
                    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
                      e.preventDefault();
                    }
                    if (e.shiftKey && e.key === 'Insert') {
                      e.preventDefault();
                    }
                  };

                  const onDrop = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };
                  const onDragOver = (e: DragEvent) => e.preventDefault();

                  dom.addEventListener('paste', onPaste);
                  dom.addEventListener('keydown', onKeyDown);
                  dom.addEventListener('drop', onDrop);
                  dom.addEventListener('dragover', onDragOver);

                  const dispose = () => {
                    try {
                      dom.removeEventListener('paste', onPaste);
                      dom.removeEventListener('keydown', onKeyDown);
                      dom.removeEventListener('drop', onDrop);
                      dom.removeEventListener('dragover', onDragOver);
                    } catch {}
                  };

                  try {
                    editor.onDidDispose(dispose);
                  } catch {
                    window.addEventListener('unload', dispose);
                  }
                }}
              />
            </div>
          ) : (
            <div 
              className="px-4 py-3 prose prose-sm dark:prose-invert max-w-none min-h-[40px]"
              onClick={() => setIsEditing(true)}
            >
              {cell.source.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {cell.source}
                </ReactMarkdown>
              ) : (
                <p className="text-muted-foreground italic">Double-click to edit</p>
              )}
            </div>
          )
        )}
      </div>

      {/* Cell outputs (for code cells) - from kernel execution */}
      {cell.cell_type === 'code' && outputs && outputs.length > 0 && (
        <div className="border-t bg-muted/20 relative">
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1 h-5 w-5 p-0 opacity-50 hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); onClearOutput(); }}
          >
            <X className="h-3 w-3" />
          </Button>
          {outputs.map((output, i) => (
            <KernelOutput key={i} output={output} />
          ))}
        </div>
      )}

      {/* Legacy notebook outputs (from .ipynb file) */}
      {cell.cell_type === 'code' && (!outputs || outputs.length === 0) && cell.outputs && cell.outputs.length > 0 && (
        <div className="border-t bg-muted/20">
          {cell.outputs.map((output, i) => (
            <LegacyCellOutput key={i} output={output} />
          ))}
        </div>
      )}

      </div>
    </div>
  );
}

// Kernel output renderer (from live execution)
function KernelOutput({ output }: { output: CellOutputType }) {
  switch (output.type) {
    case 'stdout':
      return (
        <pre className="px-4 py-2 text-sm font-mono whitespace-pre-wrap overflow-x-auto text-foreground">
          {output.content}
        </pre>
      );
    
    case 'stderr':
      return (
        <pre className="px-4 py-2 text-sm font-mono whitespace-pre-wrap overflow-x-auto text-orange-500">
          {output.content}
        </pre>
      );
    
    case 'error':
      return (
        <pre className="px-4 py-2 text-sm font-mono text-red-500 whitespace-pre-wrap overflow-x-auto bg-red-500/10">
          {output.content}
        </pre>
      );
    
    case 'html':
      return (
        <div 
          className="px-4 py-2 overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: output.content }}
        />
      );
    
    case 'image':
      return (
        <div className="px-4 py-2">
          <img 
            src={`data:image/png;base64,${output.content}`} 
            alt="Output" 
            className="max-w-full" 
          />
        </div>
      );
    
    default:
      return null;
  }
}

// Legacy output renderer (from .ipynb file outputs)
function LegacyCellOutput({ output }: { output: NotebookOutput }) {
  const formatted = formatCellOutput(output);

  switch (formatted.type) {
    case 'text':
      return (
        <pre className="px-4 py-2 text-sm font-mono whitespace-pre-wrap overflow-x-auto">
          {formatted.content}
        </pre>
      );
    
    case 'error':
      return (
        <pre className="px-4 py-2 text-sm font-mono text-red-500 whitespace-pre-wrap overflow-x-auto bg-red-500/10">
          {formatted.content}
        </pre>
      );
    
    case 'html':
      return (
        <div 
          className="px-4 py-2 overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: formatted.content }}
        />
      );
    
    case 'image':
      return (
        <div className="px-4 py-2">
          <img src={formatted.content} alt="Output" className="max-w-full" />
        </div>
      );
    
    default:
      return null;
  }
}
