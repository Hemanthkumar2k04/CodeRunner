import { useCallback, useEffect, useState, useRef } from 'react';
import { connectSocket, getSocket } from '@/lib/socket';

/**
 * Kernel output types
 */
export interface KernelOutput {
  type: 'stdout' | 'stderr' | 'error' | 'image' | 'html';
  content: string;
  cellId: string;
}

export type KernelStatus = 'disconnected' | 'starting' | 'idle' | 'busy' | 'dead';

export interface CellOutput {
  type: 'stdout' | 'stderr' | 'error' | 'image' | 'html';
  content: string;
}

export interface CellExecution {
  executionCount: number | null;
  status: 'idle' | 'running' | 'finished' | 'error';
  outputs: CellOutput[];
}

/**
 * Hook for managing notebook kernel communication
 * Independent from the regular console execution system
 */
export function useNotebookKernel(notebookId: string) {
  const [kernelId, setKernelId] = useState<string | null>(null);
  const [kernelStatus, setKernelStatus] = useState<KernelStatus>('disconnected');
  const [cellExecutions, setCellExecutions] = useState<Map<string, CellExecution>>(new Map());
  const [error, setError] = useState<string | null>(null);

  // Track current executing cell
  const currentCellRef = useRef<string | null>(null);

  // Initialize cell execution state
  const initCellExecution = useCallback((cellId: string) => {
    setCellExecutions(prev => {
      const next = new Map(prev);
      if (!next.has(cellId)) {
        next.set(cellId, {
          executionCount: null,
          status: 'idle',
          outputs: [],
        });
      }
      return next;
    });
  }, []);

  // Clear cell outputs
  const clearCellOutputs = useCallback((cellId: string) => {
    setCellExecutions(prev => {
      const next = new Map(prev);
      const existing = next.get(cellId);
      next.set(cellId, {
        executionCount: existing?.executionCount || null,
        status: 'idle',
        outputs: [],
      });
      return next;
    });
  }, []);

  // Start kernel
  const startKernel = useCallback(() => {
    if (kernelStatus !== 'disconnected' && kernelStatus !== 'dead') {
      return;
    }
    const sock = getSocket() || connectSocket();
    setKernelStatus('starting');
    setError(null);
    sock.emit('kernel:start', { notebookId, language: 'python' });
  }, [notebookId, kernelStatus]);

  // Execute cell
  const executeCell = useCallback((cellId: string, code: string) => {
    if (!kernelId) {
      setError('Kernel not started');
      return;
    }
    if (kernelStatus === 'busy') {
      setError('Kernel is busy');
      return;
    }

    const sock = getSocket();
    if (!sock) {
      setError('Socket not connected');
      return;
    }

    currentCellRef.current = cellId;
    
    // Clear previous outputs and set status to running
    setCellExecutions(prev => {
      const next = new Map(prev);
      next.set(cellId, {
        executionCount: null,
        status: 'running',
        outputs: [],
      });
      return next;
    });

    sock.emit('kernel:execute', { kernelId, cellId, code });
  }, [kernelId, kernelStatus]);

  // Interrupt kernel
  const interruptKernel = useCallback(() => {
    if (!kernelId) return;
    const sock = getSocket();
    sock?.emit('kernel:interrupt', { kernelId });
  }, [kernelId]);

  // Restart kernel
  const restartKernel = useCallback(() => {
    if (!kernelId) return;
    const sock = getSocket();
    sock?.emit('kernel:restart', { kernelId });
    // Clear all cell outputs on restart
    setCellExecutions(new Map());
  }, [kernelId]);

  // Shutdown kernel
  const shutdownKernel = useCallback(() => {
    if (!kernelId) return;
    const sock = getSocket();
    sock?.emit('kernel:shutdown', { kernelId });
  }, [kernelId]);

  // Get cell execution state
  const getCellExecution = useCallback((cellId: string): CellExecution | undefined => {
    return cellExecutions.get(cellId);
  }, [cellExecutions]);

  // Socket event handlers
  useEffect(() => {
    const handleKernelStarted = (data: { notebookId: string; kernelId: string }) => {
      if (data.notebookId === notebookId) {
        setKernelId(data.kernelId);
        setKernelStatus('idle');
        setError(null);
      }
    };

    const handleKernelOutput = (data: { kernelId: string } & KernelOutput) => {
      if (data.kernelId !== kernelId) return;

      setCellExecutions(prev => {
        const next = new Map(prev);
        const existing = next.get(data.cellId) || {
          executionCount: null,
          status: 'running' as const,
          outputs: [],
        };

        next.set(data.cellId, {
          ...existing,
          outputs: [...existing.outputs, { type: data.type, content: data.content }],
        });
        return next;
      });
    };

    const handleKernelStatus = (data: { kernelId: string; status: KernelStatus }) => {
      if (data.kernelId !== kernelId) return;
      
      setKernelStatus(data.status);

      // If kernel becomes idle, mark current cell as finished
      if (data.status === 'idle' && currentCellRef.current) {
        setCellExecutions(prev => {
          const next = new Map(prev);
          const cellId = currentCellRef.current!;
          const existing = next.get(cellId);
          if (existing && existing.status === 'running') {
            next.set(cellId, {
              ...existing,
              status: 'finished',
            });
          }
          return next;
        });
        currentCellRef.current = null;
      }
    };

    const handleExecutionStarted = (data: { kernelId: string; cellId: string; executionCount: number }) => {
      if (data.kernelId !== kernelId) return;

      setCellExecutions(prev => {
        const next = new Map(prev);
        const existing = next.get(data.cellId);
        if (existing) {
          next.set(data.cellId, {
            ...existing,
            executionCount: data.executionCount,
          });
        }
        return next;
      });
    };

    const handleKernelError = (data: { notebookId?: string; kernelId?: string; cellId?: string; error: string }) => {
      if (data.notebookId && data.notebookId !== notebookId) return;
      if (data.kernelId && data.kernelId !== kernelId) return;

      setError(data.error);

      // If error on a cell, mark it
      if (data.cellId) {
        setCellExecutions(prev => {
          const next = new Map(prev);
          const existing = next.get(data.cellId!);
          if (existing) {
            next.set(data.cellId!, {
              ...existing,
              status: 'error',
              outputs: [...existing.outputs, { type: 'error', content: data.error }],
            });
          }
          return next;
        });
      }
    };

    const handleKernelInterrupted = (data: { kernelId: string }) => {
      if (data.kernelId !== kernelId) return;
      
      // Mark current cell as interrupted
      if (currentCellRef.current) {
        setCellExecutions(prev => {
          const next = new Map(prev);
          const cellId = currentCellRef.current!;
          const existing = next.get(cellId);
          if (existing && existing.status === 'running') {
            next.set(cellId, {
              ...existing,
              status: 'error',
              outputs: [...existing.outputs, { type: 'error', content: 'KeyboardInterrupt' }],
            });
          }
          return next;
        });
        currentCellRef.current = null;
      }
    };

    const handleKernelRestarted = (data: { kernelId: string }) => {
      if (data.kernelId !== kernelId) return;
      setKernelStatus('idle');
    };

    const handleKernelShutdown = (data: { kernelId: string }) => {
      if (data.kernelId !== kernelId) return;
      setKernelId(null);
      setKernelStatus('disconnected');
    };

    const handleCellComplete = (data: { kernelId: string; cellId: string }) => {
      if (data.kernelId !== kernelId) return;
      
      setCellExecutions(prev => {
        const next = new Map(prev);
        const existing = next.get(data.cellId);
        if (existing) {
          next.set(data.cellId, {
            ...existing,
            status: 'finished',
          });
        }
        return next;
      });
      currentCellRef.current = null;
    };

    // Get or create socket and register event listeners
    const sock = getSocket() || connectSocket();
    
    sock.on('kernel:started', handleKernelStarted);
    sock.on('kernel:output', handleKernelOutput);
    sock.on('kernel:status', handleKernelStatus);
    sock.on('kernel:execution_started', handleExecutionStarted);
    sock.on('kernel:error', handleKernelError);
    sock.on('kernel:interrupted', handleKernelInterrupted);
    sock.on('kernel:restarted', handleKernelRestarted);
    sock.on('kernel:shutdown_complete', handleKernelShutdown);
    sock.on('kernel:cell_complete', handleCellComplete);

    return () => {
      sock.off('kernel:started', handleKernelStarted);
      sock.off('kernel:output', handleKernelOutput);
      sock.off('kernel:status', handleKernelStatus);
      sock.off('kernel:execution_started', handleExecutionStarted);
      sock.off('kernel:error', handleKernelError);
      sock.off('kernel:interrupted', handleKernelInterrupted);
      sock.off('kernel:restarted', handleKernelRestarted);
      sock.off('kernel:shutdown_complete', handleKernelShutdown);
      sock.off('kernel:cell_complete', handleCellComplete);
    };
  }, [notebookId, kernelId]);

  // Auto-start kernel when hook is mounted (delayed to avoid cascade effect)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (kernelStatus === 'disconnected') {
        startKernel();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [kernelStatus, startKernel]);

  return {
    kernelId,
    kernelStatus,
    error,
    startKernel,
    executeCell,
    interruptKernel,
    restartKernel,
    shutdownKernel,
    getCellExecution,
    cellExecutions,
    initCellExecution,
    clearCellOutputs,
  };
}
