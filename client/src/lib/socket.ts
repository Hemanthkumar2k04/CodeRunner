import { io, Socket } from 'socket.io-client';
import { useEditorStore } from '@/stores/useEditorStore';

// Dynamically determine server URL:
// 1. Use VITE_SERVER_URL env var if set
// 2. When accessed via port 3000 directly (local dev), connect to that same origin
// 3. Otherwise (behind Nginx at port 8080+), connect to the same origin — Nginx proxies /socket.io/
const getServerUrl = (): string => {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  const { protocol, hostname, port } = window.location;
  // Local dev: backend is on port 3000, frontend on 5173
  if (port === '5173' || port === '3000') {
    const proto = protocol === 'https:' ? 'https:' : 'http:';
    return `${proto}//${hostname}:3000`;
  }
  // Docker / Nginx: connect to same origin (Nginx proxies /socket.io/ → backend)
  return window.location.origin;
};

const SERVER_URL = getServerUrl();
console.log('[Socket] Server URL:', SERVER_URL);

let socket: Socket | null = null;
let connectionPromise: Promise<void> | null = null;

const attachListeners = (sock: Socket) => {
  // Remove any existing listeners first to avoid duplicates
  sock.off('output');
  sock.off('exit');
  sock.off('error');

  sock.on('output', (data: { sessionId: string; type: 'stdout' | 'stderr'; data: string }) => {
    const store = useEditorStore.getState();
    const consoleState = Object.values(store.consoles).find(c => c.sessionId === data.sessionId);
    if (consoleState) {
      store.appendOutputToConsole(consoleState.fileId, { type: data.type, data: data.data });
    }
  });

  sock.on('exit', (data: { sessionId: string; code: number; executionTime?: number }) => {
    const store = useEditorStore.getState();
    const consoleState = Object.values(store.consoles).find(c => c.sessionId === data.sessionId);
    if (consoleState) {
      store.appendOutputToConsole(consoleState.fileId, {
        type: 'system',
        data: `\n[Process exited with code ${data.code}]`,
      });
      store.setConsoleRunning(consoleState.fileId, false);
      if (data.executionTime !== undefined) {
        store.setConsoleExecutionTime(consoleState.fileId, data.executionTime);
      }
    }
  });

  sock.on('error', (data: { sessionId?: string; message: string }) => {
    const store = useEditorStore.getState();
    if (data.sessionId) {
      const consoleState = Object.values(store.consoles).find(c => c.sessionId === data.sessionId);
      if (consoleState) {
        store.appendOutputToConsole(consoleState.fileId, {
          type: 'stderr',
          data: `Error: ${data.message}`,
        });
        store.setConsoleRunning(consoleState.fileId, false);
      }
    }
  });
};

export const connectSocket = (): Socket => {
  if (!socket) {
    socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: true,
    });

    connectionPromise = new Promise((resolve) => {
      if (socket!.connected) {
        resolve();
      } else {
        socket!.once('connect', () => {
          resolve();
        });
      }
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected to server:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
    });

    // Attach output/exit/error listeners
    attachListeners(socket);
  }

  return socket;
};

export const waitForConnection = async (): Promise<boolean> => {
  if (!socket) {
    connectSocket();
  }
  if (socket?.connected) {
    return true;
  }
  try {
    await connectionPromise;
    return socket?.connected ?? false;
  } catch {
    return false;
  }
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
    connectionPromise = null;
  }
};

export const getSocket = (): Socket | null => {
  return socket;
};

export const isConnected = (): boolean => {
  return socket?.connected ?? false;
};

export type { Socket };
