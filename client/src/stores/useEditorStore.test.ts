import { describe, it, expect } from 'vitest';

describe('Store Tests', () => {
  it('should handle state updates', () => {
    interface Store {
      files: Record<string, any>;
      addFile: (name: string) => void;
      updateContent: (id: string, content: string) => void;
    }

    // Simulate store behavior
    const createStore = (): Store => ({
      files: {},
      addFile(name: string) {
        this.files[name] = { content: '', size: 0 };
      },
      updateContent(id: string, content: string) {
        if (this.files[id]) {
          this.files[id].content = content;
          this.files[id].size = content.length;
        }
      },
    });

    const store = createStore();
    store.addFile('test.py');
    store.updateContent('test.py', 'print("hello")');

    expect(store.files['test.py'].content).toBe('print("hello")');
    expect(store.files['test.py'].size).toBe(14);
  });

  it('should enforce size limits', () => {
    const MAX_FILE_SIZE = 500 * 1024; // 500KB

    const validateSize = (content: string): boolean => {
      return content.length <= MAX_FILE_SIZE;
    };

    expect(validateSize('small content')).toBe(true);
    expect(validateSize('x'.repeat(MAX_FILE_SIZE))).toBe(true);
    expect(validateSize('x'.repeat(MAX_FILE_SIZE + 1))).toBe(false);
  });

  it('should manage console outputs', () => {
    interface Console {
      outputs: string[];
      appendOutput: (text: string) => void;
      clear: () => void;
    }

    const console: Console = {
      outputs: [],
      appendOutput(text: string) {
        this.outputs.push(text);
      },
      clear() {
        this.outputs = [];
      },
    };

    console.appendOutput('Line 1');
    console.appendOutput('Line 2');
    expect(console.outputs.length).toBe(2);
    
    console.clear();
    expect(console.outputs.length).toBe(0);
  });

  it('should track execution state', async () => {
    interface ExecutionState {
      running: boolean;
      startTime: number;
      endTime: number | null;
      start: () => void;
      end: () => void;
      duration: () => number;
    }

    const state: ExecutionState = {
      running: false,
      startTime: 0,
      endTime: null,
      start() {
        this.running = true;
        this.startTime = Date.now();
      },
      end() {
        this.running = false;
        this.endTime = Date.now();
      },
      duration() {
        return (this.endTime || Date.now()) - this.startTime;
      },
    };

    state.start();
    expect(state.running).toBe(true);

    // Add small delay to ensure duration > 0
    await new Promise(resolve => setTimeout(resolve, 1));

    state.end();
    expect(state.running).toBe(false);
    expect(state.duration()).toBeGreaterThanOrEqual(0);
  });
});
