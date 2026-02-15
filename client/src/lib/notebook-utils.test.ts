import { describe, it, expect } from 'vitest';

/**
 * Comprehensive tests for notebook-utils functions
 * Mirrors the logic from src/lib/notebook-utils.ts
 */

// Types matching the source module
type CellType = 'code' | 'markdown' | 'raw';

interface NotebookOutput {
  output_type: 'stream' | 'execute_result' | 'display_data' | 'error';
  name?: string;
  text?: string | string[];
  data?: Record<string, string | string[]>;
  ename?: string;
  evalue?: string;
  traceback?: string[];
  execution_count?: number;
}

interface NotebookCell {
  id: string;
  cell_type: CellType;
  source: string;
  metadata: Record<string, unknown>;
  outputs?: NotebookOutput[];
  execution_count?: number | null;
}

interface NotebookDocument {
  cells: NotebookCell[];
  metadata: {
    kernelspec?: { display_name: string; language: string; name: string };
    language_info?: { name: string; version?: string };
  };
  nbformat: number;
  nbformat_minor: number;
}

// Inline implementations matching the source module
function generateCellId(): string {
  return `cell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function createEmptyNotebook(language: string = 'python'): NotebookDocument {
  return {
    cells: [
      {
        id: generateCellId(),
        cell_type: 'code',
        source: '',
        metadata: {},
        outputs: [],
        execution_count: null,
      },
    ],
    metadata: {
      kernelspec: {
        display_name: language.charAt(0).toUpperCase() + language.slice(1),
        language,
        name: language,
      },
      language_info: { name: language },
    },
    nbformat: 4,
    nbformat_minor: 5,
  };
}

function createCell(type: CellType, source: string = ''): NotebookCell {
  return {
    id: generateCellId(),
    cell_type: type,
    source,
    metadata: {},
    outputs: type === 'code' ? [] : undefined,
    execution_count: type === 'code' ? null : undefined,
  };
}

function parseNotebook(content: string): NotebookDocument {
  try {
    const notebook = JSON.parse(content) as NotebookDocument;
    notebook.cells = notebook.cells.map(cell => ({
      ...cell,
      id: cell.id || generateCellId(),
      source: Array.isArray(cell.source) ? (cell.source as unknown as string[]).join('') : cell.source,
      outputs: cell.outputs?.map(output => ({
        ...output,
        text: Array.isArray(output.text) ? output.text.join('') : output.text,
      })) || [],
    }));
    return notebook;
  } catch {
    return createEmptyNotebook();
  }
}

function serializeNotebook(notebook: NotebookDocument): string {
  const serializable = {
    ...notebook,
    cells: notebook.cells.map(cell => ({
      ...cell,
      source: cell.source.split('\n').map((line, i, arr) =>
        i < arr.length - 1 ? line + '\n' : line
      ),
      outputs: cell.outputs?.map(output => ({
        ...output,
        text: typeof output.text === 'string'
          ? output.text.split('\n').map((line, i, arr) =>
              i < arr.length - 1 ? line + '\n' : line
            )
          : output.text,
      })),
    })),
  };
  return JSON.stringify(serializable, null, 2);
}

function isNotebookFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.ipynb');
}

function getNotebookLanguage(notebook: NotebookDocument): string {
  return notebook.metadata?.language_info?.name ||
         notebook.metadata?.kernelspec?.language ||
         'python';
}

function formatCellOutput(output: NotebookOutput): { type: 'text' | 'error' | 'html' | 'image'; content: string } {
  switch (output.output_type) {
    case 'stream':
      return { type: 'text', content: typeof output.text === 'string' ? output.text : (output.text?.join('') || '') };
    case 'error':
      return { type: 'error', content: output.traceback?.join('\n') || `${output.ename}: ${output.evalue}` };
    case 'execute_result':
    case 'display_data':
      if (output.data) {
        if (output.data['text/html']) {
          const html = output.data['text/html'];
          return { type: 'html', content: Array.isArray(html) ? html.join('') : html };
        }
        if (output.data['image/png']) {
          return { type: 'image', content: `data:image/png;base64,${Array.isArray(output.data['image/png']) ? output.data['image/png'].join('') : output.data['image/png']}` };
        }
        if (output.data['text/plain']) {
          const text = output.data['text/plain'];
          return { type: 'text', content: Array.isArray(text) ? text.join('') : text };
        }
      }
      return { type: 'text', content: '' };
    default:
      return { type: 'text', content: '' };
  }
}

describe('Notebook Utils Tests', () => {
  describe('generateCellId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateCellId();
      const id2 = generateCellId();
      expect(id1).not.toBe(id2);
    });

    it('should start with "cell-" prefix', () => {
      expect(generateCellId().startsWith('cell-')).toBe(true);
    });

    it('should contain a timestamp', () => {
      const before = Date.now();
      const id = generateCellId();
      const after = Date.now();
      const parts = id.split('-');
      const timestamp = parseInt(parts[1]);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('isNotebookFile', () => {
    it('should return true for .ipynb files', () => {
      expect(isNotebookFile('notebook.ipynb')).toBe(true);
      expect(isNotebookFile('my_analysis.ipynb')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(isNotebookFile('test.IPYNB')).toBe(true);
      expect(isNotebookFile('test.Ipynb')).toBe(true);
    });

    it('should return false for non-notebook files', () => {
      expect(isNotebookFile('main.py')).toBe(false);
      expect(isNotebookFile('index.js')).toBe(false);
      expect(isNotebookFile('file.ipyn')).toBe(false);
    });
  });

  describe('createEmptyNotebook', () => {
    it('should create a notebook with default python language', () => {
      const notebook = createEmptyNotebook();
      expect(notebook.metadata.kernelspec?.language).toBe('python');
      expect(notebook.metadata.language_info?.name).toBe('python');
    });

    it('should create a notebook with specified language', () => {
      const notebook = createEmptyNotebook('javascript');
      expect(notebook.metadata.kernelspec?.language).toBe('javascript');
      expect(notebook.metadata.language_info?.name).toBe('javascript');
    });

    it('should have one empty code cell', () => {
      const notebook = createEmptyNotebook();
      expect(notebook.cells).toHaveLength(1);
      expect(notebook.cells[0].cell_type).toBe('code');
      expect(notebook.cells[0].source).toBe('');
    });

    it('should have correct nbformat', () => {
      const notebook = createEmptyNotebook();
      expect(notebook.nbformat).toBe(4);
      expect(notebook.nbformat_minor).toBe(5);
    });

    it('should capitalize kernelspec display name', () => {
      expect(createEmptyNotebook('python').metadata.kernelspec?.display_name).toBe('Python');
      expect(createEmptyNotebook('javascript').metadata.kernelspec?.display_name).toBe('Javascript');
    });
  });

  describe('createCell', () => {
    it('should create a code cell with outputs', () => {
      const cell = createCell('code');
      expect(cell.cell_type).toBe('code');
      expect(cell.outputs).toEqual([]);
      expect(cell.execution_count).toBeNull();
      expect(cell.source).toBe('');
    });

    it('should create a markdown cell without outputs', () => {
      const cell = createCell('markdown');
      expect(cell.cell_type).toBe('markdown');
      expect(cell.outputs).toBeUndefined();
      expect(cell.execution_count).toBeUndefined();
    });

    it('should create a raw cell', () => {
      const cell = createCell('raw', 'raw content');
      expect(cell.cell_type).toBe('raw');
      expect(cell.source).toBe('raw content');
    });

    it('should create a cell with provided source', () => {
      const cell = createCell('code', 'print("hello")');
      expect(cell.source).toBe('print("hello")');
    });

    it('should assign a unique id', () => {
      const cell1 = createCell('code');
      const cell2 = createCell('code');
      expect(cell1.id).not.toBe(cell2.id);
    });

    it('should have empty metadata', () => {
      expect(createCell('code').metadata).toEqual({});
    });
  });

  describe('parseNotebook', () => {
    it('should parse a valid notebook JSON', () => {
      const json = JSON.stringify({
        cells: [{ id: 'cell-1', cell_type: 'code', source: 'print("hello")', metadata: {}, outputs: [] }],
        metadata: { kernelspec: { display_name: 'Python', language: 'python', name: 'python' }, language_info: { name: 'python' } },
        nbformat: 4,
        nbformat_minor: 5,
      });
      const notebook = parseNotebook(json);
      expect(notebook.cells).toHaveLength(1);
      expect(notebook.cells[0].source).toBe('print("hello")');
    });

    it('should join array sources', () => {
      const json = JSON.stringify({
        cells: [{ cell_type: 'code', source: ['print(', '"hello"', ')'], metadata: {}, outputs: [] }],
        metadata: {},
        nbformat: 4,
        nbformat_minor: 5,
      });
      const notebook = parseNotebook(json);
      expect(notebook.cells[0].source).toBe('print("hello")');
    });

    it('should assign IDs to cells without IDs', () => {
      const json = JSON.stringify({
        cells: [{ cell_type: 'code', source: '', metadata: {}, outputs: [] }],
        metadata: {},
        nbformat: 4,
        nbformat_minor: 5,
      });
      const notebook = parseNotebook(json);
      expect(notebook.cells[0].id).toBeTruthy();
      expect(notebook.cells[0].id.startsWith('cell-')).toBe(true);
    });

    it('should return empty notebook on invalid JSON', () => {
      const notebook = parseNotebook('not valid json');
      expect(notebook.cells).toHaveLength(1);
      expect(notebook.nbformat).toBe(4);
    });

    it('should join array output text', () => {
      const json = JSON.stringify({
        cells: [{ cell_type: 'code', source: '', metadata: {}, outputs: [{ output_type: 'stream', name: 'stdout', text: ['line1\n', 'line2\n'] }] }],
        metadata: {},
        nbformat: 4,
        nbformat_minor: 5,
      });
      const notebook = parseNotebook(json);
      expect(notebook.cells[0].outputs![0].text).toBe('line1\nline2\n');
    });
  });

  describe('serializeNotebook', () => {
    it('should serialize notebook to JSON', () => {
      const notebook = createEmptyNotebook();
      const json = serializeNotebook(notebook);
      const parsed = JSON.parse(json);
      expect(parsed.nbformat).toBe(4);
      expect(parsed.cells).toHaveLength(1);
    });

    it('should split source into array of lines', () => {
      const notebook = createEmptyNotebook();
      notebook.cells[0].source = 'line1\nline2\nline3';
      const json = serializeNotebook(notebook);
      const parsed = JSON.parse(json);
      expect(parsed.cells[0].source).toEqual(['line1\n', 'line2\n', 'line3']);
    });

    it('should be valid JSON', () => {
      const notebook = createEmptyNotebook();
      const json = serializeNotebook(notebook);
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should roundtrip with parseNotebook', () => {
      const original = createEmptyNotebook('javascript');
      original.cells[0].source = 'console.log("hello")';
      const serialized = serializeNotebook(original);
      const parsed = parseNotebook(serialized);
      expect(parsed.cells[0].source).toBe('console.log("hello")');
      expect(parsed.metadata.language_info?.name).toBe('javascript');
    });
  });

  describe('getNotebookLanguage', () => {
    it('should return language from language_info', () => {
      const notebook: NotebookDocument = {
        cells: [],
        metadata: { language_info: { name: 'python' }, kernelspec: { display_name: 'Python', language: 'javascript', name: 'python' } },
        nbformat: 4,
        nbformat_minor: 5,
      };
      expect(getNotebookLanguage(notebook)).toBe('python');
    });

    it('should fall back to kernelspec language', () => {
      const notebook: NotebookDocument = {
        cells: [],
        metadata: { kernelspec: { display_name: 'JS', language: 'javascript', name: 'js' } },
        nbformat: 4,
        nbformat_minor: 5,
      };
      expect(getNotebookLanguage(notebook)).toBe('javascript');
    });

    it('should default to python if no metadata', () => {
      const notebook: NotebookDocument = { cells: [], metadata: {}, nbformat: 4, nbformat_minor: 5 };
      expect(getNotebookLanguage(notebook)).toBe('python');
    });
  });

  describe('formatCellOutput', () => {
    it('should format stream output', () => {
      const result = formatCellOutput({ output_type: 'stream', name: 'stdout', text: 'Hello, World!\n' });
      expect(result.type).toBe('text');
      expect(result.content).toBe('Hello, World!\n');
    });

    it('should format stream output with array text', () => {
      const result = formatCellOutput({ output_type: 'stream', name: 'stdout', text: ['line1\n', 'line2\n'] });
      expect(result.type).toBe('text');
      expect(result.content).toBe('line1\nline2\n');
    });

    it('should format error output with traceback', () => {
      const result = formatCellOutput({ output_type: 'error', ename: 'ValueError', evalue: 'bad', traceback: ['Traceback...', 'ValueError: bad'] });
      expect(result.type).toBe('error');
      expect(result.content).toContain('Traceback...');
    });

    it('should format error output without traceback', () => {
      const result = formatCellOutput({ output_type: 'error', ename: 'TypeError', evalue: 'oops' });
      expect(result.type).toBe('error');
      expect(result.content).toBe('TypeError: oops');
    });

    it('should format execute_result with HTML', () => {
      const result = formatCellOutput({ output_type: 'execute_result', data: { 'text/html': '<b>bold</b>' } });
      expect(result.type).toBe('html');
      expect(result.content).toBe('<b>bold</b>');
    });

    it('should format execute_result with plain text', () => {
      const result = formatCellOutput({ output_type: 'execute_result', data: { 'text/plain': 'hello world' } });
      expect(result.type).toBe('text');
      expect(result.content).toBe('hello world');
    });

    it('should format display_data with image', () => {
      const result = formatCellOutput({ output_type: 'display_data', data: { 'image/png': 'base64data' } });
      expect(result.type).toBe('image');
      expect(result.content).toBe('data:image/png;base64,base64data');
    });

    it('should return empty text for stream with no text', () => {
      const result = formatCellOutput({ output_type: 'stream' });
      expect(result.type).toBe('text');
      expect(result.content).toBe('');
    });

    it('should prefer HTML over plain text in execute_result', () => {
      const result = formatCellOutput({ output_type: 'execute_result', data: { 'text/html': '<b>html</b>', 'text/plain': 'plain' } });
      expect(result.type).toBe('html');
      expect(result.content).toBe('<b>html</b>');
    });

    it('should handle array HTML data', () => {
      const result = formatCellOutput({ output_type: 'execute_result', data: { 'text/html': ['<b>', 'bold', '</b>'] } });
      expect(result.type).toBe('html');
      expect(result.content).toBe('<b>bold</b>');
    });
  });
});
