/**
 * Notebook utilities for parsing and serializing Jupyter notebook files (.ipynb)
 */

// Jupyter notebook cell types
export type CellType = 'code' | 'markdown' | 'raw';

// Output types from Jupyter
export interface NotebookOutput {
  output_type: 'stream' | 'execute_result' | 'display_data' | 'error';
  name?: string; // 'stdout' | 'stderr' for stream
  text?: string | string[];
  data?: Record<string, string | string[]>; // MIME type -> data
  ename?: string; // Error name
  evalue?: string; // Error value
  traceback?: string[]; // Error traceback
  execution_count?: number;
}

// Individual cell in a notebook
export interface NotebookCell {
  id: string;
  cell_type: CellType;
  source: string; // Cell content
  metadata: Record<string, unknown>;
  outputs?: NotebookOutput[]; // Only for code cells
  execution_count?: number | null;
}

// Full notebook structure
export interface NotebookDocument {
  cells: NotebookCell[];
  metadata: {
    kernelspec?: {
      display_name: string;
      language: string;
      name: string;
    };
    language_info?: {
      name: string;
      version?: string;
    };
  };
  nbformat: number;
  nbformat_minor: number;
}

/**
 * Generate a unique cell ID
 */
export function generateCellId(): string {
  return `cell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse a Jupyter notebook JSON string into a NotebookDocument
 */
export function parseNotebook(content: string): NotebookDocument {
  try {
    const notebook = JSON.parse(content) as NotebookDocument;
    
    // Ensure cells have IDs
    notebook.cells = notebook.cells.map(cell => ({
      ...cell,
      id: cell.id || generateCellId(),
      source: Array.isArray(cell.source) ? cell.source.join('') : cell.source,
      outputs: cell.outputs?.map(output => ({
        ...output,
        text: Array.isArray(output.text) ? output.text.join('') : output.text,
      })) || [],
    }));
    
    return notebook;
  } catch {
    // Return empty notebook on parse error
    return createEmptyNotebook();
  }
}

/**
 * Serialize a NotebookDocument back to JSON string
 */
export function serializeNotebook(notebook: NotebookDocument): string {
  // Convert source strings back to arrays (Jupyter format)
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

/**
 * Create a new empty notebook
 */
export function createEmptyNotebook(language: string = 'python'): NotebookDocument {
  return {
    cells: [
      {
        id: generateCellId(),
        cell_type: 'code',
        source: '',
        metadata: {},
        outputs: [],
        execution_count: null,
      }
    ],
    metadata: {
      kernelspec: {
        display_name: language.charAt(0).toUpperCase() + language.slice(1),
        language: language,
        name: language,
      },
      language_info: {
        name: language,
      },
    },
    nbformat: 4,
    nbformat_minor: 5,
  };
}

/**
 * Create a new cell
 */
export function createCell(type: CellType, source: string = ''): NotebookCell {
  return {
    id: generateCellId(),
    cell_type: type,
    source,
    metadata: {},
    outputs: type === 'code' ? [] : undefined,
    execution_count: type === 'code' ? null : undefined,
  };
}

/**
 * Check if a file is a Jupyter notebook
 */
export function isNotebookFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.ipynb');
}

/**
 * Get the language from notebook metadata
 */
export function getNotebookLanguage(notebook: NotebookDocument): string {
  return notebook.metadata?.language_info?.name || 
         notebook.metadata?.kernelspec?.language || 
         'python';
}

/**
 * Format cell output for display
 */
export function formatCellOutput(output: NotebookOutput): { type: 'text' | 'error' | 'html' | 'image'; content: string } {
  switch (output.output_type) {
    case 'stream':
      return {
        type: 'text',
        content: typeof output.text === 'string' ? output.text : (output.text?.join('') || ''),
      };
    
    case 'error':
      return {
        type: 'error',
        content: output.traceback?.join('\n') || `${output.ename}: ${output.evalue}`,
      };
    
    case 'execute_result':
    case 'display_data':
      // Check for different MIME types
      if (output.data) {
        // Prefer HTML, then plain text
        if (output.data['text/html']) {
          const html = output.data['text/html'];
          return {
            type: 'html',
            content: Array.isArray(html) ? html.join('') : html,
          };
        }
        if (output.data['image/png']) {
          return {
            type: 'image',
            content: `data:image/png;base64,${Array.isArray(output.data['image/png']) ? output.data['image/png'].join('') : output.data['image/png']}`,
          };
        }
        if (output.data['text/plain']) {
          const text = output.data['text/plain'];
          return {
            type: 'text',
            content: Array.isArray(text) ? text.join('') : text,
          };
        }
      }
      return { type: 'text', content: '' };
    
    default:
      return { type: 'text', content: '' };
  }
}
