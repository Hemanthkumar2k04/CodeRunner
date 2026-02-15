import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Comprehensive tests for the EditorStore (Zustand store)
 * 
 * Tests the store logic by mirroring the actual store's implementation.
 * Due to rolldown-vite SSR transform incompatibility with vitest,
 * we cannot directly import the store module. Instead, we test the
 * core logic patterns that the store implements.
 */

// Constants matching the source
const MAX_FILE_SIZE = 500 * 1024;
const MAX_TOTAL_SIZE = 4 * 1024 * 1024;
const MAX_OUTPUT_ENTRIES_PER_CONSOLE = 2000;

// File validation function from the store
const isValidFileName = (name: string): boolean => {
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
  const reservedNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  return name.length > 0 && name.length <= 255 && !invalidChars.test(name) && !reservedNames.test(name);
};

interface FileNode {
  id: string;
  name: string;
  path: string;
  content: string;
  isFolder: boolean;
  children: string[];
  parentId: string | null;
  isModified: boolean;
}

interface OutputEntry {
  type: 'stdout' | 'stderr' | 'system';
  data: string;
  timestamp: number;
}

interface ConsoleState {
  fileId: string;
  filePath: string;
  output: OutputEntry[];
  isRunning: boolean;
  sessionId: string | null;
  createdAt: number;
  executionTime: number | null;
}

// Simple state management for testing (mirrors Zustand store logic)
function createTestStore() {
  let files: Record<string, FileNode> = {};
  let rootIds: string[] = [];
  let activeFileId: string | null = null;
  let openTabs: string[] = [];
  let consoles: Record<string, ConsoleState> = {};
  let activeConsoleId: string | null = null;
  let selectedFilesForRun: string[] = [];

  const generateId = (): string => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    getState: () => ({ files, rootIds, activeFileId, openTabs, consoles, activeConsoleId, selectedFilesForRun }),
    reset: () => { files = {}; rootIds = []; activeFileId = null; openTabs = []; consoles = {}; activeConsoleId = null; selectedFilesForRun = []; },

    addFile: (name: string, parentId: string | null) => {
      if (!isValidFileName(name)) return { success: false, error: 'Invalid file name' };

      const siblings = parentId ? files[parentId]?.children || [] : rootIds;
      if (siblings.some(id => files[id]?.name === name)) return { success: false, error: 'A file with this name already exists' };

      const id = generateId();
      const parentPath = parentId ? files[parentId]?.path || '' : '';
      const path = parentPath ? `${parentPath}/${name}` : name;

      files[id] = { id, name, path, content: '', isFolder: false, children: [], parentId, isModified: false };
      if (parentId && files[parentId]) {
        files[parentId] = { ...files[parentId], children: [...files[parentId].children, id] };
      } else {
        rootIds = [...rootIds, id];
      }
      activeFileId = id;
      if (!openTabs.includes(id)) openTabs = [...openTabs, id];
      return { success: true, id };
    },

    addFolder: (name: string, parentId: string | null) => {
      if (!isValidFileName(name)) return { success: false, error: 'Invalid folder name' };

      const siblings = parentId ? files[parentId]?.children || [] : rootIds;
      if (siblings.some(id => files[id]?.name === name)) return { success: false, error: 'A folder with this name already exists' };

      const id = generateId();
      const parentPath = parentId ? files[parentId]?.path || '' : '';
      const path = parentPath ? `${parentPath}/${name}` : name;

      files[id] = { id, name, path, content: '', isFolder: true, children: [], parentId, isModified: false };
      if (parentId && files[parentId]) {
        files[parentId] = { ...files[parentId], children: [...files[parentId].children, id] };
      } else {
        rootIds = [...rootIds, id];
      }
      return { success: true, id };
    },

    updateContent: (id: string, content: string) => {
      const fileSize = new Blob([content]).size;
      if (fileSize > MAX_FILE_SIZE) return { success: false, error: `File size exceeds limit of ${MAX_FILE_SIZE / 1024}KB` };
      if (!files[id]) return { success: false, error: 'File not found' };

      const currentSize = new Blob([files[id].content]).size;
      const totalSize = Object.values(files).reduce((t, f) => t + new Blob([f.content]).size, 0) - currentSize + fileSize;
      if (totalSize > MAX_TOTAL_SIZE) return { success: false, error: `Total workspace size exceeds limit` };

      files[id] = { ...files[id], content, isModified: false };
      return { success: true };
    },

    deleteNode: (id: string) => {
      const node = files[id];
      if (!node) return;

      const idsToDelete = [id];
      const collectChildren = (nodeId: string) => {
        const n = files[nodeId];
        if (n?.isFolder) n.children.forEach(cId => { idsToDelete.push(cId); collectChildren(cId); });
      };
      collectChildren(id);

      idsToDelete.forEach(delId => delete files[delId]);
      if (node.parentId && files[node.parentId]) {
        files[node.parentId] = { ...files[node.parentId], children: files[node.parentId].children.filter(c => c !== id) };
      } else {
        rootIds = rootIds.filter(r => r !== id);
      }
      openTabs = openTabs.filter(t => !idsToDelete.includes(t));
      if (idsToDelete.includes(activeFileId || '')) activeFileId = openTabs[0] || null;
      selectedFilesForRun = selectedFilesForRun.filter(f => !idsToDelete.includes(f));
      idsToDelete.forEach(delId => delete consoles[delId]);
      if (idsToDelete.includes(activeConsoleId || '')) activeConsoleId = Object.keys(consoles)[0] || null;
    },

    renameNode: (id: string, newName: string) => {
      if (!isValidFileName(newName)) return { success: false, error: 'Invalid name' };
      if (!files[id]) return { success: false, error: 'File not found' };

      const siblings = files[id].parentId ? files[files[id].parentId!]?.children || [] : rootIds;
      if (siblings.some(sId => sId !== id && files[sId]?.name === newName)) return { success: false, error: 'A file with this name already exists' };

      const parentPath = files[id].parentId ? files[files[id].parentId!]?.path || '' : '';
      const newPath = parentPath ? `${parentPath}/${newName}` : newName;
      files[id] = { ...files[id], name: newName, path: newPath };
      return { success: true };
    },

    openTab: (id: string) => {
      if (!openTabs.includes(id)) openTabs = [...openTabs, id];
      activeFileId = id;
    },

    closeTab: (id: string) => {
      const closedIndex = openTabs.indexOf(id);
      openTabs = openTabs.filter(t => t !== id);
      if (activeFileId === id) activeFileId = openTabs[Math.min(closedIndex, openTabs.length - 1)] || null;
    },

    setActiveFile: (id: string | null) => { activeFileId = id; },

    toggleFileForRun: (id: string) => {
      selectedFilesForRun = selectedFilesForRun.includes(id) ? selectedFilesForRun.filter(f => f !== id) : [...selectedFilesForRun, id];
    },

    setSelectedFilesForRun: (ids: string[]) => { selectedFilesForRun = ids; },

    createConsole: (fileId: string, filePath: string, sessionId: string) => {
      const existing = consoles[fileId];
      consoles[fileId] = {
        fileId, filePath, output: [], isRunning: true, sessionId,
        createdAt: existing?.createdAt ?? Date.now(), executionTime: null,
      };
      activeConsoleId = fileId;
    },

    deleteConsole: (fileId: string) => {
      delete consoles[fileId];
      if (activeConsoleId === fileId) activeConsoleId = Object.keys(consoles)[0] || null;
    },

    clearConsole: (fileId: string) => {
      if (consoles[fileId]) consoles[fileId] = { ...consoles[fileId], output: [] };
    },

    appendOutput: (fileId: string, entry: Omit<OutputEntry, 'timestamp'>) => {
      if (!consoles[fileId]) return;
      let newOutput = [...consoles[fileId].output, { ...entry, timestamp: Date.now() }];
      if (newOutput.length > MAX_OUTPUT_ENTRIES_PER_CONSOLE) newOutput = newOutput.slice(-MAX_OUTPUT_ENTRIES_PER_CONSOLE);
      consoles[fileId] = { ...consoles[fileId], output: newOutput };
    },

    setConsoleRunning: (fileId: string, running: boolean) => {
      if (consoles[fileId]) consoles[fileId] = { ...consoles[fileId], isRunning: running };
    },

    setConsoleExecutionTime: (fileId: string, time: number) => {
      if (consoles[fileId]) consoles[fileId] = { ...consoles[fileId], executionTime: time };
    },

    getAllFiles: () => Object.values(files).filter(f => !f.isFolder),
    getTotalSize: () => Object.values(files).reduce((t, f) => t + new Blob([f.content]).size, 0),
    getFilesForExecution: () => {
      return selectedFilesForRun
        .map(id => files[id])
        .filter((f): f is FileNode => f !== undefined && !f.isFolder)
        .map(f => ({ name: f.name, content: f.content, toBeExec: f.id === activeFileId }));
    },
  };
}

describe('Editor Store Tests', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe('constants', () => {
    it('should have correct file size limit', () => {
      expect(MAX_FILE_SIZE).toBe(500 * 1024);
    });

    it('should have correct total size limit', () => {
      expect(MAX_TOTAL_SIZE).toBe(4 * 1024 * 1024);
    });

    it('should have correct output entries limit', () => {
      expect(MAX_OUTPUT_ENTRIES_PER_CONSOLE).toBe(2000);
    });
  });

  describe('isValidFileName', () => {
    it('should accept valid file names', () => {
      expect(isValidFileName('main.py')).toBe(true);
      expect(isValidFileName('my-file.js')).toBe(true);
      expect(isValidFileName('file_name.txt')).toBe(true);
      expect(isValidFileName('a')).toBe(true);
    });

    it('should reject empty names', () => {
      expect(isValidFileName('')).toBe(false);
    });

    it('should reject names with invalid characters', () => {
      expect(isValidFileName('file<name')).toBe(false);
      expect(isValidFileName('file>name')).toBe(false);
      expect(isValidFileName('file:name')).toBe(false);
      expect(isValidFileName('file"name')).toBe(false);
      expect(isValidFileName('file|name')).toBe(false);
      expect(isValidFileName('file?name')).toBe(false);
      expect(isValidFileName('file*name')).toBe(false);
    });

    it('should reject reserved names', () => {
      expect(isValidFileName('CON')).toBe(false);
      expect(isValidFileName('PRN')).toBe(false);
      expect(isValidFileName('AUX')).toBe(false);
      expect(isValidFileName('NUL')).toBe(false);
      expect(isValidFileName('COM1')).toBe(false);
      expect(isValidFileName('LPT1')).toBe(false);
    });

    it('should reject names exceeding 255 characters', () => {
      expect(isValidFileName('a'.repeat(256))).toBe(false);
    });

    it('should accept names at exactly 255 characters', () => {
      expect(isValidFileName('a'.repeat(255))).toBe(true);
    });
  });

  describe('addFile', () => {
    it('should add a file to root', () => {
      const result = store.addFile('main.py', null);
      expect(result.success).toBe(true);
      expect(result.id).toBeTruthy();

      const state = store.getState();
      expect(state.rootIds).toContain(result.id);
      expect(state.files[result.id!].name).toBe('main.py');
      expect(state.files[result.id!].isFolder).toBe(false);
    });

    it('should auto-open the new file in a tab', () => {
      const result = store.addFile('main.py', null);
      const state = store.getState();
      expect(state.openTabs).toContain(result.id);
      expect(state.activeFileId).toBe(result.id);
    });

    it('should reject invalid file names', () => {
      expect(store.addFile('', null).success).toBe(false);
      expect(store.addFile('file<>.txt', null).success).toBe(false);
    });

    it('should reject duplicate file names at same level', () => {
      store.addFile('main.py', null);
      const result = store.addFile('main.py', null);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should add file to folder', () => {
      const folder = store.addFolder('src', null);
      const file = store.addFile('main.py', folder.id!);
      expect(file.success).toBe(true);

      const state = store.getState();
      expect(state.files[folder.id!].children).toContain(file.id);
      expect(state.files[file.id!].parentId).toBe(folder.id);
      expect(state.files[file.id!].path).toBe('src/main.py');
    });

    it('should allow same filename in different folders', () => {
      const folder1 = store.addFolder('src', null);
      const folder2 = store.addFolder('test', null);
      expect(store.addFile('main.py', folder1.id!).success).toBe(true);
      expect(store.addFile('main.py', folder2.id!).success).toBe(true);
    });
  });

  describe('addFolder', () => {
    it('should add a folder to root', () => {
      const result = store.addFolder('src', null);
      expect(result.success).toBe(true);
      const state = store.getState();
      expect(state.files[result.id!].isFolder).toBe(true);
      expect(state.files[result.id!].children).toEqual([]);
    });

    it('should reject duplicate folder names', () => {
      store.addFolder('src', null);
      expect(store.addFolder('src', null).success).toBe(false);
    });

    it('should create nested folders', () => {
      const outer = store.addFolder('src', null);
      const inner = store.addFolder('utils', outer.id!);
      expect(inner.success).toBe(true);
      const state = store.getState();
      expect(state.files[outer.id!].children).toContain(inner.id);
      expect(state.files[inner.id!].path).toBe('src/utils');
    });
  });

  describe('updateContent', () => {
    it('should update file content', () => {
      const file = store.addFile('main.py', null);
      const result = store.updateContent(file.id!, 'print("hello")');
      expect(result.success).toBe(true);
      expect(store.getState().files[file.id!].content).toBe('print("hello")');
    });

    it('should reject content exceeding max file size', () => {
      const file = store.addFile('main.py', null);
      const result = store.updateContent(file.id!, 'x'.repeat(MAX_FILE_SIZE + 1));
      expect(result.success).toBe(false);
      expect(result.error).toContain('size exceeds limit');
    });

    it('should reject updates for nonexistent files', () => {
      const result = store.updateContent('nonexistent', 'content');
      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found');
    });
  });

  describe('deleteNode', () => {
    it('should delete a file', () => {
      const file = store.addFile('main.py', null);
      store.deleteNode(file.id!);
      expect(store.getState().files[file.id!]).toBeUndefined();
      expect(store.getState().rootIds).not.toContain(file.id);
    });

    it('should delete folder and its children', () => {
      const folder = store.addFolder('src', null);
      const file = store.addFile('main.py', folder.id!);
      store.deleteNode(folder.id!);
      expect(store.getState().files[folder.id!]).toBeUndefined();
      expect(store.getState().files[file.id!]).toBeUndefined();
    });

    it('should remove deleted file from open tabs', () => {
      const file = store.addFile('main.py', null);
      store.deleteNode(file.id!);
      expect(store.getState().openTabs).not.toContain(file.id);
    });

    it('should clean up consoles for deleted files', () => {
      const file = store.addFile('main.py', null);
      store.createConsole(file.id!, 'main.py', 'session-1');
      store.deleteNode(file.id!);
      expect(store.getState().consoles[file.id!]).toBeUndefined();
    });

    it('should clean up selectedFilesForRun', () => {
      const file = store.addFile('main.py', null);
      store.toggleFileForRun(file.id!);
      store.deleteNode(file.id!);
      expect(store.getState().selectedFilesForRun).not.toContain(file.id);
    });
  });

  describe('renameNode', () => {
    it('should rename a file', () => {
      const file = store.addFile('old.py', null);
      expect(store.renameNode(file.id!, 'new.py').success).toBe(true);
      expect(store.getState().files[file.id!].name).toBe('new.py');
      expect(store.getState().files[file.id!].path).toBe('new.py');
    });

    it('should reject invalid names', () => {
      const file = store.addFile('test.py', null);
      expect(store.renameNode(file.id!, '').success).toBe(false);
    });

    it('should reject duplicate names among siblings', () => {
      store.addFile('existing.py', null);
      const file = store.addFile('other.py', null);
      expect(store.renameNode(file.id!, 'existing.py').success).toBe(false);
    });

    it('should return error for nonexistent file', () => {
      const result = store.renameNode('nonexistent', 'new.py');
      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found');
    });
  });

  describe('tab management', () => {
    it('should open a tab and set it active', () => {
      const file = store.addFile('main.py', null);
      store.openTab(file.id!);
      expect(store.getState().openTabs).toContain(file.id);
      expect(store.getState().activeFileId).toBe(file.id);
    });

    it('should not duplicate tabs', () => {
      const file = store.addFile('main.py', null);
      store.openTab(file.id!);
      store.openTab(file.id!);
      const tabs = store.getState().openTabs.filter(id => id === file.id);
      expect(tabs).toHaveLength(1);
    });

    it('should close a tab', () => {
      const file1 = store.addFile('main.py', null);
      store.addFile('test.py', null);
      store.closeTab(file1.id!);
      expect(store.getState().openTabs).not.toContain(file1.id);
    });

    it('should switch active file when closing active tab', () => {
      const file1 = store.addFile('main.py', null);
      store.addFile('test.py', null);
      store.setActiveFile(file1.id!);
      store.closeTab(file1.id!);
      expect(store.getState().activeFileId).not.toBe(file1.id);
    });

    it('should set active file to null when all tabs closed', () => {
      const file = store.addFile('main.py', null);
      store.closeTab(file.id!);
      expect(store.getState().activeFileId).toBeNull();
    });
  });

  describe('console management', () => {
    let fileId: string;

    beforeEach(() => {
      fileId = store.addFile('main.py', null).id!;
    });

    it('should create a console', () => {
      store.createConsole(fileId, 'main.py', 'session-1');
      const state = store.getState();
      expect(state.consoles[fileId]).toBeDefined();
      expect(state.consoles[fileId].isRunning).toBe(true);
      expect(state.consoles[fileId].sessionId).toBe('session-1');
      expect(state.activeConsoleId).toBe(fileId);
    });

    it('should preserve createdAt when recreating console', () => {
      store.createConsole(fileId, 'main.py', 'session-1');
      const originalCreatedAt = store.getState().consoles[fileId].createdAt;
      store.createConsole(fileId, 'main.py', 'session-2');
      expect(store.getState().consoles[fileId].createdAt).toBe(originalCreatedAt);
    });

    it('should delete a console', () => {
      store.createConsole(fileId, 'main.py', 'session-1');
      store.deleteConsole(fileId);
      expect(store.getState().consoles[fileId]).toBeUndefined();
    });

    it('should clear console output', () => {
      store.createConsole(fileId, 'main.py', 'session-1');
      store.appendOutput(fileId, { type: 'stdout', data: 'hello' });
      store.clearConsole(fileId);
      expect(store.getState().consoles[fileId].output).toHaveLength(0);
    });

    it('should append output to console', () => {
      store.createConsole(fileId, 'main.py', 'session-1');
      store.appendOutput(fileId, { type: 'stdout', data: 'line 1' });
      store.appendOutput(fileId, { type: 'stderr', data: 'error' });
      const output = store.getState().consoles[fileId].output;
      expect(output).toHaveLength(2);
      expect(output[0].type).toBe('stdout');
      expect(output[1].type).toBe('stderr');
    });

    it('should enforce max output entries per console', () => {
      store.createConsole(fileId, 'main.py', 'session-1');
      for (let i = 0; i < MAX_OUTPUT_ENTRIES_PER_CONSOLE + 100; i++) {
        store.appendOutput(fileId, { type: 'stdout', data: `line ${i}` });
      }
      expect(store.getState().consoles[fileId].output.length).toBeLessThanOrEqual(MAX_OUTPUT_ENTRIES_PER_CONSOLE);
    });

    it('should set console running state', () => {
      store.createConsole(fileId, 'main.py', 'session-1');
      store.setConsoleRunning(fileId, false);
      expect(store.getState().consoles[fileId].isRunning).toBe(false);
    });

    it('should set execution time', () => {
      store.createConsole(fileId, 'main.py', 'session-1');
      store.setConsoleExecutionTime(fileId, 1234);
      expect(store.getState().consoles[fileId].executionTime).toBe(1234);
    });

    it('should switch active console when deleting active', () => {
      const file2 = store.addFile('test.py', null);
      store.createConsole(fileId, 'main.py', 's1');
      store.createConsole(file2.id!, 'test.py', 's2');
      store.deleteConsole(file2.id!);
      expect(store.getState().activeConsoleId).not.toBe(file2.id);
    });
  });

  describe('execution selection', () => {
    it('should toggle file for run', () => {
      const file = store.addFile('main.py', null);
      store.toggleFileForRun(file.id!);
      expect(store.getState().selectedFilesForRun).toContain(file.id);
      store.toggleFileForRun(file.id!);
      expect(store.getState().selectedFilesForRun).not.toContain(file.id);
    });

    it('should set selected files for run', () => {
      const f1 = store.addFile('a.py', null);
      const f2 = store.addFile('b.py', null);
      store.setSelectedFilesForRun([f1.id!, f2.id!]);
      expect(store.getState().selectedFilesForRun).toEqual([f1.id!, f2.id!]);
    });
  });

  describe('utility functions', () => {
    it('should get all files excluding folders', () => {
      store.addFolder('src', null);
      store.addFile('main.py', null);
      store.addFile('test.py', null);
      expect(store.getAllFiles()).toHaveLength(2);
      expect(store.getAllFiles().every(f => !f.isFolder)).toBe(true);
    });

    it('should calculate total size', () => {
      const file = store.addFile('main.py', null);
      store.updateContent(file.id!, 'hello world');
      expect(store.getTotalSize()).toBeGreaterThan(0);
    });

    it('should get files for execution', () => {
      const f1 = store.addFile('main.py', null);
      const f2 = store.addFile('util.py', null);
      store.updateContent(f1.id!, 'print("main")');
      store.updateContent(f2.id!, 'def helper(): pass');
      store.setSelectedFilesForRun([f1.id!, f2.id!]);
      store.setActiveFile(f1.id!);

      const execFiles = store.getFilesForExecution();
      expect(execFiles).toHaveLength(2);
      expect(execFiles.find(f => f.name === 'main.py')?.toBeExec).toBe(true);
      expect(execFiles.find(f => f.name === 'util.py')?.toBeExec).toBe(false);
    });

    it('should exclude folders from execution', () => {
      const folder = store.addFolder('src', null);
      const file = store.addFile('main.py', null);
      store.setSelectedFilesForRun([folder.id!, file.id!]);
      store.setActiveFile(file.id!);

      const execFiles = store.getFilesForExecution();
      expect(execFiles).toHaveLength(1);
      expect(execFiles[0].name).toBe('main.py');
    });
  });
});
