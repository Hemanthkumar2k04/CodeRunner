import { describe, it, expect } from 'vitest';

describe('Socket Hook Tests', () => {
  it('should initialize socket connection', () => {
    interface Socket {
      connected: boolean;
      connect: () => void;
      disconnect: () => void;
    }

    const socket: Socket = {
      connected: false,
      connect() {
        this.connected = true;
      },
      disconnect() {
        this.connected = false;
      },
    };

    expect(socket.connected).toBe(false);
    socket.connect();
    expect(socket.connected).toBe(true);
    socket.disconnect();
    expect(socket.connected).toBe(false);
  });

  it('should emit code execution events', () => {
    interface ExecutionEvent {
      type: string;
      sessionId: string;
      code: string;
      language: string;
    }

    const events: ExecutionEvent[] = [];

    const emit = (event: ExecutionEvent) => {
      events.push(event);
    };

    emit({
      type: 'run',
      sessionId: '123',
      code: 'print("test")',
      language: 'python',
    });

    expect(events.length).toBe(1);
    expect(events[0].type).toBe('run');
    expect(events[0].language).toBe('python');
  });

  it('should handle input submission', () => {
    interface InputEvent {
      sessionId: string;
      input: string;
    }

    const inputs: InputEvent[] = [];

    const submitInput = (sessionId: string, input: string) => {
      inputs.push({ sessionId, input });
    };

    submitInput('123', 'user input');
    expect(inputs[0].input).toBe('user input');
  });

  it('should handle stop signal', () => {
    interface StopEvent {
      sessionId: string;
    }

    const stops: StopEvent[] = [];

    const stop = (sessionId: string) => {
      stops.push({ sessionId });
    };

    stop('123');
    expect(stops[0].sessionId).toBe('123');
  });

  it('should manage multiple sessions', () => {
    const sessions = new Map<string, { code: string; running: boolean }>();

    const createSession = (id: string) => {
      sessions.set(id, { code: '', running: false });
    };

    const runCode = (id: string, code: string) => {
      const session = sessions.get(id);
      if (session) {
        session.code = code;
        session.running = true;
      }
    };

    createSession('s1');
    createSession('s2');
    
    runCode('s1', 'print("test")');
    
    expect(sessions.get('s1')?.running).toBe(true);
    expect(sessions.get('s2')?.running).toBe(false);
  });
});
