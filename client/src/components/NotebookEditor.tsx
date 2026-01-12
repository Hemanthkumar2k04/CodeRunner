import { useState, useCallback, useEffect, useMemo } from 'react';
import { NotebookCell } from './NotebookCell';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, 
  Play, 
  Code, 
  FileText,
  Square,
  RotateCcw,
  Circle,
} from 'lucide-react';
import {
  parseNotebook,
  serializeNotebook,
  createCell,
  createEmptyNotebook,
  getNotebookLanguage,
  type NotebookDocument,
  type CellType,
} from '@/lib/notebook-utils';
import { useNotebookKernel } from '@/hooks/useNotebookKernel';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface NotebookEditorProps {
  fileId: string;
  content: string;
  onContentChange: (content: string) => void;
}

export function NotebookEditor({ 
  fileId, 
  content, 
  onContentChange
}: NotebookEditorProps) {
  // Parse notebook from content
  const [notebook, setNotebook] = useState<NotebookDocument>(() => {
    if (content.trim()) {
      return parseNotebook(content);
    }
    return createEmptyNotebook();
  });
  
  const [activeCellId, setActiveCellId] = useState<string | null>(
    notebook.cells[0]?.id || null
  );

  // Get notebook language
  const language = useMemo(() => getNotebookLanguage(notebook), [notebook]);

  // Kernel hook - uses the fileId as notebook identifier
  const {
    kernelId,
    kernelStatus,
    error: kernelError,
    startKernel,
    executeCell,
    interruptKernel,
    restartKernel,
    getCellExecution,
    initCellExecution,
    clearCellOutputs,
  } = useNotebookKernel(fileId);

  // Initialize cell execution state for all cells
  useEffect(() => {
    notebook.cells.forEach(cell => {
      if (cell.cell_type === 'code') {
        initCellExecution(cell.id);
      }
    });
  }, [notebook.cells, initCellExecution]);

  // Cell operations
  const updateCellSource = useCallback((cellId: string, source: string) => {
    setNotebook(prev => ({
      ...prev,
      cells: prev.cells.map(cell => 
        cell.id === cellId ? { ...cell, source } : cell
      ),
    }));
    // Debounce content update
    const newNotebook = {
      ...notebook,
      cells: notebook.cells.map(cell => 
        cell.id === cellId ? { ...cell, source } : cell
      ),
    };
    onContentChange(serializeNotebook(newNotebook));
  }, [notebook, onContentChange]);

  const addCell = useCallback((type: CellType, afterCellId?: string) => {
    const newCell = createCell(type);
    setNotebook(prev => {
      const insertIndex = afterCellId 
        ? prev.cells.findIndex(c => c.id === afterCellId) + 1 
        : prev.cells.length;
      const newCells = [...prev.cells];
      newCells.splice(insertIndex, 0, newCell);
      const newNotebook = { ...prev, cells: newCells };
      onContentChange(serializeNotebook(newNotebook));
      return newNotebook;
    });
    setActiveCellId(newCell.id);
  }, [onContentChange]);

  const deleteCell = useCallback((cellId: string) => {
    setNotebook(prev => {
      if (prev.cells.length <= 1) return prev; // Keep at least one cell
      const newCells = prev.cells.filter(c => c.id !== cellId);
      const newNotebook = { ...prev, cells: newCells };
      onContentChange(serializeNotebook(newNotebook));
      
      // Update active cell if deleted
      if (activeCellId === cellId) {
        const deletedIndex = prev.cells.findIndex(c => c.id === cellId);
        const newActiveIndex = Math.min(deletedIndex, newCells.length - 1);
        setActiveCellId(newCells[newActiveIndex]?.id || null);
      }
      
      return newNotebook;
    });
  }, [activeCellId, onContentChange]);

  const moveCell = useCallback((cellId: string, direction: 'up' | 'down') => {
    setNotebook(prev => {
      const index = prev.cells.findIndex(c => c.id === cellId);
      if (index === -1) return prev;
      
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.cells.length) return prev;
      
      const newCells = [...prev.cells];
      [newCells[index], newCells[newIndex]] = [newCells[newIndex], newCells[index]];
      
      const newNotebook = { ...prev, cells: newCells };
      onContentChange(serializeNotebook(newNotebook));
      return newNotebook;
    });
  }, [onContentChange]);

  const changeCellType = useCallback((cellId: string, newType: CellType) => {
    setNotebook(prev => {
      const newCells = prev.cells.map(cell => {
        if (cell.id !== cellId) return cell;
        return {
          ...cell,
          cell_type: newType,
          outputs: newType === 'code' ? [] : undefined,
          execution_count: newType === 'code' ? null : undefined,
        };
      });
      const newNotebook = { ...prev, cells: newCells };
      onContentChange(serializeNotebook(newNotebook));
      return newNotebook;
    });
  }, [onContentChange]);

  // Run a single cell using the kernel
  const runCell = useCallback((cellId: string) => {
    const cell = notebook.cells.find(c => c.id === cellId);
    if (!cell || cell.cell_type !== 'code' || !cell.source.trim()) return;

    if (kernelStatus !== 'idle') {
      if (kernelStatus === 'disconnected' || kernelStatus === 'dead') {
        startKernel();
        // Queue execution after kernel starts
        return;
      }
      return; // Kernel is busy
    }

    executeCell(cellId, cell.source);
  }, [notebook, kernelStatus, startKernel, executeCell]);

  // Run all cells sequentially
  const runAllCells = useCallback(async () => {
    for (const cell of notebook.cells) {
      if (cell.cell_type === 'code' && cell.source.trim()) {
        // Wait for kernel to be idle before running next cell
        if (kernelStatus === 'busy') {
          // TODO: Queue cells for execution
          break;
        }
        executeCell(cell.id, cell.source);
        // Simple delay to allow sequential execution
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }, [notebook, kernelStatus, executeCell]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeCellId) return;

      // Shift+Enter: Run cell and move to next
      if (e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        const cell = notebook.cells.find(c => c.id === activeCellId);
        if (cell?.cell_type === 'code') {
          runCell(activeCellId);
        }
        // Move to next cell or create new one
        const currentIndex = notebook.cells.findIndex(c => c.id === activeCellId);
        if (currentIndex < notebook.cells.length - 1) {
          setActiveCellId(notebook.cells[currentIndex + 1].id);
        } else {
          addCell('code', activeCellId);
        }
      }

      // Ctrl+Enter: Run cell
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        const cell = notebook.cells.find(c => c.id === activeCellId);
        if (cell?.cell_type === 'code') {
          runCell(activeCellId);
        }
      }

      // Escape: Blur current cell
      if (e.key === 'Escape') {
        (document.activeElement as HTMLElement)?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeCellId, notebook, runCell, addCell]);

  // Kernel status indicator
  const getKernelStatusColor = () => {
    switch (kernelStatus) {
      case 'idle': return 'text-green-500';
      case 'busy': return 'text-yellow-500 animate-pulse';
      case 'starting': return 'text-blue-500 animate-pulse';
      case 'dead': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getKernelStatusText = () => {
    switch (kernelStatus) {
      case 'idle': return 'Kernel Ready';
      case 'busy': return 'Kernel Busy';
      case 'starting': return 'Kernel Starting...';
      case 'dead': return 'Kernel Dead';
      default: return 'Kernel Disconnected';
    }
  };

  return (
    <TooltipProvider>
      <div className="h-full w-full flex flex-col bg-background overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
          <Button
            variant="outline"
            size="sm"
            onClick={() => addCell('code', activeCellId || undefined)}
          >
            <Plus className="h-4 w-4 mr-1" />
            <Code className="h-4 w-4 mr-1" />
            Code
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => addCell('markdown', activeCellId || undefined)}
          >
            <Plus className="h-4 w-4 mr-1" />
            <FileText className="h-4 w-4 mr-1" />
            Markdown
          </Button>

          <div className="h-4 w-px bg-border mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                onClick={runAllCells}
                disabled={kernelStatus === 'busy'}
              >
                <Play className="h-4 w-4 mr-1" />
                Run All
              </Button>
            </TooltipTrigger>
            <TooltipContent>Run all code cells</TooltipContent>
          </Tooltip>

          {kernelStatus === 'busy' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={interruptKernel}
                >
                  <Square className="h-4 w-4 mr-1" />
                  Interrupt
                </Button>
              </TooltipTrigger>
              <TooltipContent>Stop execution</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={restartKernel}
                disabled={!kernelId || kernelStatus === 'starting'}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Restart kernel (clears all state)</TooltipContent>
          </Tooltip>

          <div className="flex-1" />

          {/* Kernel status */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-xs">
                <Circle className={`h-2 w-2 fill-current ${getKernelStatusColor()}`} />
                <span className="text-muted-foreground">{getKernelStatusText()}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {kernelStatus === 'disconnected' 
                ? 'Click Run to start kernel'
                : kernelStatus === 'dead'
                ? 'Click Restart to recover'
                : `Python kernel: ${kernelStatus}`
              }
            </TooltipContent>
          </Tooltip>

          <div className="h-4 w-px bg-border mx-1" />

          <div className="text-xs text-muted-foreground">
            {language.charAt(0).toUpperCase() + language.slice(1)} • {notebook.cells.length} cells
          </div>
        </div>

        {/* Kernel error banner */}
        {kernelError && (
          <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm">
            Kernel Error: {kernelError}
          </div>
        )}

        {/* Cells */}
        <ScrollArea className="flex-1 min-w-0">
          <div className="p-4" style={{ maxWidth: '100%' }}>
            {notebook.cells.map((cell, index) => {
              const cellExecution = getCellExecution(cell.id);
              return (
                <NotebookCell
                  key={cell.id}
                  cell={cell}
                  index={index}
                  isActive={activeCellId === cell.id}
                  isRunning={cellExecution?.status === 'running'}
                  executionCount={cellExecution?.executionCount ?? null}
                  outputs={cellExecution?.outputs ?? []}
                  language={language}
                  onSelect={() => setActiveCellId(cell.id)}
                  onSourceChange={(source) => updateCellSource(cell.id, source)}
                  onRun={() => runCell(cell.id)}
                  onDelete={() => deleteCell(cell.id)}
                  onMoveUp={() => moveCell(cell.id, 'up')}
                  onMoveDown={() => moveCell(cell.id, 'down')}
                  onChangeType={(type) => changeCellType(cell.id, type)}
                  onClearOutput={() => clearCellOutputs(cell.id)}
                  canMoveUp={index > 0}
                  canMoveDown={index < notebook.cells.length - 1}
                />
              );
            })}

            {/* Add cell button at bottom */}
            <div className="flex justify-center gap-2 mt-4 py-4 border-t border-dashed">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => addCell('code')}
                className="text-muted-foreground"
              >
                <Plus className="h-4 w-4 mr-1" />
                <Code className="h-4 w-4 mr-1" />
                Add Code Cell
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => addCell('markdown')}
                className="text-muted-foreground"
              >
                <Plus className="h-4 w-4 mr-1" />
                <FileText className="h-4 w-4 mr-1" />
                Add Markdown Cell
              </Button>
            </div>
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}
