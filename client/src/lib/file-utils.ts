import type { FileNode } from '@/stores/useEditorStore';

// Language mappings for execution
export const SUPPORTED_LANGUAGES = ['python', 'javascript', 'java', 'cpp', 'sql'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Extension to language mapping
const extensionToLanguage: Record<string, SupportedLanguage> = {
  // Python
  '.py': 'python',
  '.pyw': 'python',
  
  // JavaScript
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  
  // Java
  '.java': 'java',
  
  // C++
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.c++': 'cpp',
  '.c': 'cpp',
  '.h': 'cpp',
  '.hpp': 'cpp',
  
  // SQL/MySQL
  '.sql': 'sql',
};

// Extension to Monaco language ID mapping
const extensionToMonaco: Record<string, string> = {
  // Python
  '.py': 'python',
  '.pyw': 'python',
  
  // JavaScript/TypeScript
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  
  // Java
  '.java': 'java',
  
  // C/C++
  '.c': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.c++': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  
  // Web
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.json': 'json',
  '.xml': 'xml',
  
  // Other
  '.md': 'markdown',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.sql': 'sql',
  '.sh': 'shell',
  '.bash': 'shell',
  '.txt': 'plaintext',
  '.ipynb': 'json', // Notebooks are JSON files in Monaco
};

// File icon mappings based on extension
export const extensionToIcon: Record<string, string> = {
  '.py': '🐍',
  '.js': '📜',
  '.ts': '📘',
  '.jsx': '⚛️',
  '.tsx': '⚛️',
  '.java': '☕',
  '.cpp': '⚙️',
  '.c': '⚙️',
  '.h': '📋',
  '.hpp': '📋',
  '.sql': '🗄️',
  '.html': '🌐',
  '.css': '🎨',
  '.json': '📦',
  '.md': '📝',
  '.txt': '📄',
  '.ipynb': '📓',
};

/**
 * Get the execution language from a filename
 */
export function getLanguageFromExtension(filename: string): SupportedLanguage | null {
  const ext = getExtension(filename);
  return extensionToLanguage[ext] || null;
}

/**
 * Get Monaco editor language ID from filename
 */
export function getMonacoLanguage(filename: string): string {
  const ext = getExtension(filename);
  return extensionToMonaco[ext] || 'plaintext';
}

/**
 * Get file extension from filename
 */
export function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) return '';
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Get display icon for a file based on extension
 */
export function getFileIcon(filename: string): string {
  const ext = getExtension(filename);
  return extensionToIcon[ext] || '📄';
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get byte size of a string
 */
export function getFileSize(content: string): number {
  return new Blob([content]).size;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Flatten file tree to array (non-folder files only)
 */
export function flattenTree(
  files: Record<string, FileNode>,
  rootIds: string[]
): FileNode[] {
  const result: FileNode[] = [];
  
  const traverse = (ids: string[]) => {
    for (const id of ids) {
      const node = files[id];
      if (!node) continue;
      
      if (node.isFolder) {
        traverse(node.children);
      } else {
        result.push(node);
      }
    }
  };
  
  traverse(rootIds);
  return result;
}

/**
 * Sort file nodes - folders first, then alphabetically
 */
export function sortFileNodes(
  ids: string[],
  files: Record<string, FileNode>
): string[] {
  return [...ids].sort((a, b) => {
    const nodeA = files[a];
    const nodeB = files[b];
    
    if (!nodeA || !nodeB) return 0;
    
    // Folders before files
    if (nodeA.isFolder && !nodeB.isFolder) return -1;
    if (!nodeA.isFolder && nodeB.isFolder) return 1;
    
    // Alphabetical within same type
    return nodeA.name.localeCompare(nodeB.name);
  });
}

/**
 * Check if a language is supported for execution
 */
export function isLanguageSupported(language: string | null): language is SupportedLanguage {
  return language !== null && SUPPORTED_LANGUAGES.includes(language as SupportedLanguage);
}

/**
 * Check if a file is a data file (not a source code file)
 * Data files should always be included when running code
 */
export function isDataFile(filename: string): boolean {
  const ext = getExtension(filename).toLowerCase();
  return ['.csv', '.json', '.yaml', '.yml', '.txt', '.xml'].includes(ext);
}

/**
 * Get the entry point filename for a language
 */
export function getDefaultEntryPoint(language: SupportedLanguage): string {
  switch (language) {
    case 'python':
      return 'main.py';
    case 'javascript':
      return 'index.js';
    case 'java':
      return 'Main.java';
    case 'cpp':
      return 'main.cpp';
    case 'sql':
      return 'queries.sql';
  }
}
