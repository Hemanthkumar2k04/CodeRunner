import { useEffect, useCallback } from 'react';
import { connectSocket, disconnectSocket, getSocket, waitForConnection, isConnected } from '@/lib/socket';
import { useEditorStore } from '@/stores/useEditorStore';

interface ExecutionFile {
  name: string;
  content: string;
  toBeExec?: boolean;
}

const generateSessionId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const useSocket = () => {
  // Initialize socket connection on mount
  useEffect(() => {
    connectSocket();
  }, []);

  const runCode = useCallback(
    async (fileId: string, filePath: string, files: ExecutionFile[], language: string) => {
      const store = useEditorStore.getState();
      const sessionId = generateSessionId();
      
      // Create or reset console for this file
      store.createConsole(fileId, filePath, sessionId);
      store.appendOutputToConsole(fileId, {
        type: 'system',
        data: `[Connecting to server...]\n`,
      });

      // Wait for connection if not already connected
      const connected = await waitForConnection();
      if (!connected) {
        store.appendOutputToConsole(fileId, {
          type: 'stderr',
          data: 'Error: Could not connect to server. Please check if the server is running.',
        });
        store.setConsoleRunning(fileId, false);
        return;
      }

      const socket = getSocket();
      store.appendOutputToConsole(fileId, {
        type: 'system',
        data: `[Running ${language} code...]\n`,
      });

      console.log('[useSocket] Emitting run event:', { sessionId, language, files });
      socket!.emit('run', { sessionId, language, files });
    },
    []
  );

  const sendInput = useCallback((input: string) => {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('input', input);
    }
  }, []);

  const stopCode = useCallback((fileId: string) => {
    const socket = getSocket();
    const store = useEditorStore.getState();
    if (socket?.connected) {
      const console = store.getConsoleByFileId(fileId);
      if (console) {
        socket.emit('stop', { sessionId: console.sessionId });
        store.appendOutputToConsole(fileId, {
          type: 'system',
          data: '[Execution stopped by user]\n',
        });
        store.setConsoleRunning(fileId, false);
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    disconnectSocket();
  }, []);

  return {
    runCode,
    sendInput,
    stopCode,
    disconnect,
    isConnected,
  };
};
