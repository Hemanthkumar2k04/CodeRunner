import { io, Socket } from 'socket.io-client';
import { useEditorStore } from '@/stores/useEditorStore';

// Dynamically determine server URL:
// 1. Use VITE_SERVER_URL env var if set
// 2. Otherwise, use the same hostname as the browser but with port 3000
const getServerUrl = (): string => {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  // Use the same host the browser is accessing, but with port 3000
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:3000`;
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

  sock.on('output', (data: { type: 'stdout' | 'stderr'; data: string }) => {
    console.log('[Socket] Received output:', data);
    useEditorStore.getState().appendOutput({ type: data.type, data: data.data });
  });

  sock.on('exit', (code: number) => {
    console.log('[Socket] Received exit:', code);
    useEditorStore.getState().appendOutput({
      type: 'system',
      data: `\n[Process exited with code ${code}]`,
    });
    useEditorStore.getState().setRunning(false);
  });

  sock.on('error', (data: { message: string }) => {
    console.log('[Socket] Received error:', data);
    useEditorStore.getState().appendOutput({
      type: 'stderr',
      data: `Error: ${data.message}`,
    });
    useEditorStore.getState().setRunning(false);
  });

  // Debug: log all events
  sock.onAny((event, ...args) => {
    console.log('[Socket] Event:', event, args);
  });

  console.log('[Socket] Listeners attached');
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
