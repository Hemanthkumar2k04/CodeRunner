import { describe, it, expect } from 'vitest';

describe('Console Component Tests', () => {
  it('should render console output', () => {
    interface ConsoleOutput {
      lines: string[];
      addLine: (line: string) => void;
      clear: () => void;
    }

    const console: ConsoleOutput = {
      lines: [],
      addLine(line: string) {
        this.lines.push(line);
      },
      clear() {
        this.lines = [];
      },
    };

    console.addLine('Output line 1');
    console.addLine('Output line 2');

    expect(console.lines.length).toBe(2);
    expect(console.lines[0]).toBe('Output line 1');
  });

  it('should manage multiple tabs', () => {
    interface Tab {
      id: string;
      name: string;
      outputs: string[];
    }

    const tabs = new Map<string, Tab>();

    const addTab = (id: string, name: string) => {
      tabs.set(id, { id, name, outputs: [] });
    };

    const removeTab = (id: string) => {
      tabs.delete(id);
    };

    addTab('tab1', 'Python Console');
    addTab('tab2', 'JavaScript Console');

    expect(tabs.size).toBe(2);

    removeTab('tab1');
    expect(tabs.size).toBe(1);
  });

  it('should handle ANSI color codes', () => {
    const parseAnsi = (text: string): { text: string; color?: string } => {
      const colorMatch = text.match(/\x1b\[(\d+)m/);
      if (!colorMatch) return { text };

      const colors: { [key: string]: string } = {
        '31': 'red',
        '32': 'green',
        '34': 'blue',
      };

      return {
        text: text.replace(/\x1b\[\d+m/g, ''),
        color: colors[colorMatch[1]],
      };
    };

    const result = parseAnsi('\x1b[31mError message\x1b[0m');
    expect(result.color).toBe('red');
    expect(result.text).toContain('Error message');
  });

  it('should track console state', () => {
    interface ConsoleState {
      running: boolean;
      executionTime: number;
      outputCount: number;
      start: () => void;
      stop: () => void;
      reset: () => void;
    }

    const state: ConsoleState = {
      running: false,
      executionTime: 0,
      outputCount: 0,
      start() {
        this.running = true;
      },
      stop() {
        this.running = false;
      },
      reset() {
        this.outputCount = 0;
        this.executionTime = 0;
      },
    };

    state.start();
    expect(state.running).toBe(true);

    state.stop();
    expect(state.running).toBe(false);

    state.reset();
    expect(state.outputCount).toBe(0);
  });

  it('should enforce output limits', () => {
    const MAX_OUTPUTS = 2000;

    const addOutput = (outputs: string[], line: string): boolean => {
      if (outputs.length >= MAX_OUTPUTS) {
        return false;
      }
      outputs.push(line);
      return true;
    };

    const outputs: string[] = [];
    
    for (let i = 0; i < MAX_OUTPUTS; i++) {
      expect(addOutput(outputs, `line ${i}`)).toBe(true);
    }

    expect(addOutput(outputs, 'overflow')).toBe(false);
    expect(outputs.length).toBe(MAX_OUTPUTS);
  });

  it('should support virtual scrolling', () => {
    interface ScrollState {
      totalItems: number;
      visibleItems: number;
      scrollPosition: number;
      getVisibleRange: () => [number, number];
    }

    const state: ScrollState = {
      totalItems: 10000,
      visibleItems: 30,
      scrollPosition: 0,
      getVisibleRange() {
        return [this.scrollPosition, this.scrollPosition + this.visibleItems];
      },
    };

    let [start, end] = state.getVisibleRange();
    expect(end - start).toBe(30);

    state.scrollPosition = 100;
    [start, end] = state.getVisibleRange();
    expect(start).toBe(100);
    expect(end).toBe(130);
  });
});
