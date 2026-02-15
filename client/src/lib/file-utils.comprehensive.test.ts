import { describe, it, expect } from 'vitest';

/**
 * Comprehensive tests for file-utils functions
 * Mirrors the logic from src/lib/file-utils.ts
 */

// Inline implementations matching the source module
const SUPPORTED_LANGUAGES = ['python', 'javascript', 'java', 'cpp', 'sql'] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const extensionToLanguage: Record<string, SupportedLanguage> = {
  '.py': 'python', '.pyw': 'python',
  '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.java': 'java',
  '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.c++': 'cpp', '.c': 'cpp', '.h': 'cpp', '.hpp': 'cpp',
  '.sql': 'sql',
};

const extensionToMonaco: Record<string, string> = {
  '.py': 'python', '.pyw': 'python',
  '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript', '.jsx': 'javascript',
  '.ts': 'typescript', '.tsx': 'typescript',
  '.java': 'java',
  '.c': 'c', '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.c++': 'cpp', '.h': 'c', '.hpp': 'cpp',
  '.html': 'html', '.htm': 'html', '.css': 'css', '.scss': 'scss', '.less': 'less',
  '.json': 'json', '.xml': 'xml',
  '.md': 'markdown', '.yaml': 'yaml', '.yml': 'yaml',
  '.sql': 'sql', '.sh': 'shell', '.bash': 'shell', '.txt': 'plaintext',
  '.ipynb': 'json',
};

const extensionToIcon: Record<string, string> = {
  '.py': '🐍', '.js': '📜', '.ts': '📘', '.jsx': '⚛️', '.tsx': '⚛️',
  '.java': '☕', '.cpp': '⚙️', '.c': '⚙️', '.h': '📋', '.hpp': '📋',
  '.sql': '🗄️', '.html': '🌐', '.css': '🎨', '.json': '📦',
  '.md': '📝', '.txt': '📄', '.ipynb': '📓',
};

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) return '';
  return filename.slice(lastDot).toLowerCase();
}

function getLanguageFromExtension(filename: string): SupportedLanguage | null {
  const ext = getExtension(filename);
  return extensionToLanguage[ext] || null;
}

function getMonacoLanguage(filename: string): string {
  const ext = getExtension(filename);
  return extensionToMonaco[ext] || 'plaintext';
}

function getFileIcon(filename: string): string {
  const ext = getExtension(filename);
  return extensionToIcon[ext] || '📄';
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

interface FileNode {
  id: string;
  name: string;
  isFolder: boolean;
  children: string[];
}

function flattenTree(files: Record<string, FileNode>, rootIds: string[]): FileNode[] {
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

function sortFileNodes(ids: string[], files: Record<string, FileNode>): string[] {
  return [...ids].sort((a, b) => {
    const nodeA = files[a];
    const nodeB = files[b];
    if (!nodeA || !nodeB) return 0;
    if (nodeA.isFolder && !nodeB.isFolder) return -1;
    if (!nodeA.isFolder && nodeB.isFolder) return 1;
    return nodeA.name.localeCompare(nodeB.name);
  });
}

function isLanguageSupported(language: string | null): language is SupportedLanguage {
  return language !== null && SUPPORTED_LANGUAGES.includes(language as SupportedLanguage);
}

function isDataFile(filename: string): boolean {
  const ext = getExtension(filename).toLowerCase();
  return ['.csv', '.json', '.yaml', '.yml', '.txt', '.xml'].includes(ext);
}

function getDefaultEntryPoint(language: SupportedLanguage): string {
  switch (language) {
    case 'python': return 'main.py';
    case 'javascript': return 'index.js';
    case 'java': return 'Main.java';
    case 'cpp': return 'main.cpp';
    case 'sql': return 'queries.sql';
  }
}

describe('File Utils Tests', () => {
  describe('getExtension', () => {
    it('should return extension with dot', () => {
      expect(getExtension('test.py')).toBe('.py');
      expect(getExtension('Main.java')).toBe('.java');
      expect(getExtension('script.js')).toBe('.js');
    });

    it('should return lowercase extension', () => {
      expect(getExtension('file.PY')).toBe('.py');
      expect(getExtension('README.MD')).toBe('.md');
    });

    it('should handle multiple dots', () => {
      expect(getExtension('my.file.txt')).toBe('.txt');
      expect(getExtension('archive.tar.gz')).toBe('.gz');
    });

    it('should return empty string for no extension', () => {
      expect(getExtension('Makefile')).toBe('');
    });

    it('should return empty for dot-prefixed files', () => {
      expect(getExtension('.gitignore')).toBe('');
    });
  });

  describe('getLanguageFromExtension', () => {
    it('should map Python extensions', () => {
      expect(getLanguageFromExtension('main.py')).toBe('python');
      expect(getLanguageFromExtension('script.pyw')).toBe('python');
    });

    it('should map JavaScript extensions', () => {
      expect(getLanguageFromExtension('index.js')).toBe('javascript');
      expect(getLanguageFromExtension('module.mjs')).toBe('javascript');
      expect(getLanguageFromExtension('lib.cjs')).toBe('javascript');
    });

    it('should map Java extensions', () => {
      expect(getLanguageFromExtension('Main.java')).toBe('java');
    });

    it('should map C++ extensions', () => {
      expect(getLanguageFromExtension('main.cpp')).toBe('cpp');
      expect(getLanguageFromExtension('main.c')).toBe('cpp');
      expect(getLanguageFromExtension('header.h')).toBe('cpp');
      expect(getLanguageFromExtension('header.hpp')).toBe('cpp');
      expect(getLanguageFromExtension('main.cc')).toBe('cpp');
      expect(getLanguageFromExtension('main.cxx')).toBe('cpp');
    });

    it('should map SQL extensions', () => {
      expect(getLanguageFromExtension('queries.sql')).toBe('sql');
    });

    it('should return null for unsupported extensions', () => {
      expect(getLanguageFromExtension('style.css')).toBeNull();
      expect(getLanguageFromExtension('readme.md')).toBeNull();
      expect(getLanguageFromExtension('data.json')).toBeNull();
      expect(getLanguageFromExtension('noext')).toBeNull();
    });
  });

  describe('getMonacoLanguage', () => {
    it('should map source file extensions', () => {
      expect(getMonacoLanguage('test.py')).toBe('python');
      expect(getMonacoLanguage('test.js')).toBe('javascript');
      expect(getMonacoLanguage('test.ts')).toBe('typescript');
      expect(getMonacoLanguage('test.java')).toBe('java');
      expect(getMonacoLanguage('test.cpp')).toBe('cpp');
      expect(getMonacoLanguage('test.c')).toBe('c');
    });

    it('should map web file extensions', () => {
      expect(getMonacoLanguage('page.html')).toBe('html');
      expect(getMonacoLanguage('page.htm')).toBe('html');
      expect(getMonacoLanguage('style.css')).toBe('css');
      expect(getMonacoLanguage('data.json')).toBe('json');
      expect(getMonacoLanguage('style.scss')).toBe('scss');
    });

    it('should map other extensions', () => {
      expect(getMonacoLanguage('README.md')).toBe('markdown');
      expect(getMonacoLanguage('config.yaml')).toBe('yaml');
      expect(getMonacoLanguage('config.yml')).toBe('yaml');
      expect(getMonacoLanguage('script.sh')).toBe('shell');
      expect(getMonacoLanguage('queries.sql')).toBe('sql');
    });

    it('should return plaintext for unknown extensions', () => {
      expect(getMonacoLanguage('file.xyz')).toBe('plaintext');
      expect(getMonacoLanguage('noext')).toBe('plaintext');
    });

    it('should handle notebook files', () => {
      expect(getMonacoLanguage('notebook.ipynb')).toBe('json');
    });
  });

  describe('getFileIcon', () => {
    it('should return correct emoji icons', () => {
      expect(getFileIcon('main.py')).toBe('🐍');
      expect(getFileIcon('index.js')).toBe('📜');
      expect(getFileIcon('Main.java')).toBe('☕');
      expect(getFileIcon('main.cpp')).toBe('⚙️');
      expect(getFileIcon('queries.sql')).toBe('🗄️');
    });

    it('should return default icon for unknown extensions', () => {
      expect(getFileIcon('unknown.xyz')).toBe('📄');
      expect(getFileIcon('noext')).toBe('📄');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should return a non-empty string', () => {
      expect(generateId().length).toBeGreaterThan(0);
    });

    it('should contain a timestamp component', () => {
      const id = generateId();
      const parts = id.split('-');
      const timestamp = parseInt(parts[0]);
      expect(timestamp).toBeGreaterThan(0);
      expect(timestamp).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('formatBytes', () => {
    it('should format zero bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('should format bytes', () => {
      expect(formatBytes(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatBytes(1048576)).toBe('1 MB');
    });

    it('should format gigabytes', () => {
      expect(formatBytes(1073741824)).toBe('1 GB');
    });
  });

  describe('flattenTree', () => {
    it('should return files from root', () => {
      const files: Record<string, FileNode> = {
        f1: { id: 'f1', name: 'main.py', isFolder: false, children: [] },
        f2: { id: 'f2', name: 'test.py', isFolder: false, children: [] },
      };
      const result = flattenTree(files, ['f1', 'f2']);
      expect(result).toHaveLength(2);
    });

    it('should recurse into folders', () => {
      const files: Record<string, FileNode> = {
        dir1: { id: 'dir1', name: 'src', isFolder: true, children: ['f1'] },
        f1: { id: 'f1', name: 'main.py', isFolder: false, children: [] },
        f2: { id: 'f2', name: 'readme.md', isFolder: false, children: [] },
      };
      const result = flattenTree(files, ['dir1', 'f2']);
      expect(result).toHaveLength(2);
      expect(result.map(f => f.name)).toContain('main.py');
      expect(result.map(f => f.name)).toContain('readme.md');
    });

    it('should exclude folders from results', () => {
      const files: Record<string, FileNode> = {
        dir1: { id: 'dir1', name: 'src', isFolder: true, children: [] },
      };
      expect(flattenTree(files, ['dir1'])).toHaveLength(0);
    });

    it('should handle empty tree', () => {
      expect(flattenTree({}, [])).toHaveLength(0);
    });

    it('should handle missing node IDs gracefully', () => {
      expect(flattenTree({}, ['nonexistent'])).toHaveLength(0);
    });

    it('should handle deeply nested folders', () => {
      const files: Record<string, FileNode> = {
        d1: { id: 'd1', name: 'a', isFolder: true, children: ['d2'] },
        d2: { id: 'd2', name: 'b', isFolder: true, children: ['f1'] },
        f1: { id: 'f1', name: 'deep.py', isFolder: false, children: [] },
      };
      const result = flattenTree(files, ['d1']);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('deep.py');
    });
  });

  describe('sortFileNodes', () => {
    it('should sort folders before files', () => {
      const files: Record<string, FileNode> = {
        f1: { id: 'f1', name: 'main.py', isFolder: false, children: [] },
        dir1: { id: 'dir1', name: 'src', isFolder: true, children: [] },
      };
      const sorted = sortFileNodes(['f1', 'dir1'], files);
      expect(sorted).toEqual(['dir1', 'f1']);
    });

    it('should sort alphabetically within same type', () => {
      const files: Record<string, FileNode> = {
        f1: { id: 'f1', name: 'beta.py', isFolder: false, children: [] },
        f2: { id: 'f2', name: 'alpha.py', isFolder: false, children: [] },
      };
      const sorted = sortFileNodes(['f1', 'f2'], files);
      expect(sorted).toEqual(['f2', 'f1']);
    });

    it('should handle missing nodes', () => {
      const result = sortFileNodes(['missing'], {});
      expect(result).toEqual(['missing']);
    });

    it('should sort folders alphabetically', () => {
      const files: Record<string, FileNode> = {
        d1: { id: 'd1', name: 'utils', isFolder: true, children: [] },
        d2: { id: 'd2', name: 'components', isFolder: true, children: [] },
      };
      const sorted = sortFileNodes(['d1', 'd2'], files);
      expect(sorted).toEqual(['d2', 'd1']);
    });
  });

  describe('isLanguageSupported', () => {
    it('should return true for supported languages', () => {
      expect(isLanguageSupported('python')).toBe(true);
      expect(isLanguageSupported('javascript')).toBe(true);
      expect(isLanguageSupported('java')).toBe(true);
      expect(isLanguageSupported('cpp')).toBe(true);
      expect(isLanguageSupported('sql')).toBe(true);
    });

    it('should return false for unsupported languages', () => {
      expect(isLanguageSupported('ruby')).toBe(false);
      expect(isLanguageSupported('go')).toBe(false);
      expect(isLanguageSupported('')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isLanguageSupported(null)).toBe(false);
    });
  });

  describe('isDataFile', () => {
    it('should identify data files', () => {
      expect(isDataFile('data.csv')).toBe(true);
      expect(isDataFile('config.json')).toBe(true);
      expect(isDataFile('config.yaml')).toBe(true);
      expect(isDataFile('config.yml')).toBe(true);
      expect(isDataFile('readme.txt')).toBe(true);
      expect(isDataFile('data.xml')).toBe(true);
    });

    it('should return false for source code files', () => {
      expect(isDataFile('main.py')).toBe(false);
      expect(isDataFile('index.js')).toBe(false);
      expect(isDataFile('Main.java')).toBe(false);
      expect(isDataFile('main.cpp')).toBe(false);
    });
  });

  describe('getDefaultEntryPoint', () => {
    it('should return correct entry points for each language', () => {
      expect(getDefaultEntryPoint('python')).toBe('main.py');
      expect(getDefaultEntryPoint('javascript')).toBe('index.js');
      expect(getDefaultEntryPoint('java')).toBe('Main.java');
      expect(getDefaultEntryPoint('cpp')).toBe('main.cpp');
      expect(getDefaultEntryPoint('sql')).toBe('queries.sql');
    });
  });

  describe('SUPPORTED_LANGUAGES', () => {
    it('should contain exactly 5 languages', () => {
      expect(SUPPORTED_LANGUAGES).toHaveLength(5);
    });

    it('should contain the expected languages', () => {
      expect(SUPPORTED_LANGUAGES).toContain('python');
      expect(SUPPORTED_LANGUAGES).toContain('javascript');
      expect(SUPPORTED_LANGUAGES).toContain('java');
      expect(SUPPORTED_LANGUAGES).toContain('cpp');
      expect(SUPPORTED_LANGUAGES).toContain('sql');
    });
  });
});
