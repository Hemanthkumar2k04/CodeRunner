import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from '@/lib/idb-storage';

// Constants for storage limits
export const MAX_FILE_SIZE = 500 * 1024; // 500KB per file
export const MAX_TOTAL_SIZE = 4 * 1024 * 1024; // 4MB total
/**
 * Maximum number of console output entries per console.
 * Each file gets its own console with this limit.
 * 
 * This prevents unbounded memory growth during long-running sessions or
 * repeated code executions. Without this limit, the output array can grow
 * indefinitely and cause performance degradation and memory leaks.
 * 
 * 2,000 entries per console represents approximately 400KB-1MB of memory usage
 * depending on average output line length. With multiple consoles, total memory
 * is bounded by: 2,000 * number_of_active_consoles.
 * 
 * See also:
 * - appendOutputToConsole() in EditorState for buffer management implementation
 * - Console.tsx for rendering with virtualization (only visible entries rendered)
 * - server/src/index.ts for output batching on the server side
 */
export const MAX_OUTPUT_ENTRIES_PER_CONSOLE = 2000; // Per-console limit to manage memory with multiple consoles

export interface FileNode {
  id: string;
  name: string;
  path: string;
  content: string;
  isFolder: boolean;
  children: string[]; // Array of child IDs for folders
  parentId: string | null;
  isModified: boolean;
  isBinary?: boolean; // Flag for binary files (images, etc.)
}

export interface OutputEntry {
  type: 'stdout' | 'stderr' | 'system';
  data: string;
  timestamp: number;
}

export interface ConsoleState {
  fileId: string;
  filePath: string; // Display name: "file.py" or "folder/file.py"
  output: OutputEntry[];
  isRunning: boolean;
  sessionId: string | null;
  createdAt: number;
  executionTime: number | null; // Execution time in milliseconds
}

export interface EditorState {
  // File system
  files: Record<string, FileNode>;
  rootIds: string[]; // Top-level file/folder IDs

  // Editor state
  activeFileId: string | null;
  openTabs: string[];

  // Execution state
  consoles: Record<string, ConsoleState>; // fileId -> console state
  activeConsoleId: string | null;
  selectedFilesForRun: string[];

  // Actions - File management
  addFile: (name: string, parentId: string | null) => { success: boolean; error?: string; id?: string };
  addFolder: (name: string, parentId: string | null) => { success: boolean; error?: string; id?: string };
  updateContent: (id: string, content: string) => { success: boolean; error?: string };
  deleteNode: (id: string) => void;
  renameNode: (id: string, newName: string) => { success: boolean; error?: string };
  uploadFiles: (files: File[], parentId: string | null) => Promise<{ success: boolean; error?: string; uploadedCount?: number }>;

  // Actions - Editor
  setActiveFile: (id: string | null) => void;
  openTab: (id: string) => void;
  closeTab: (id: string) => void;
  markAsSaved: (id: string) => void;

  // Actions - Execution
  toggleFileForRun: (id: string) => void;
  setSelectedFilesForRun: (ids: string[]) => void;

  // Console management
  createConsole: (fileId: string, filePath: string, sessionId: string) => void;
  deleteConsole: (fileId: string) => void;
  setActiveConsole: (fileId: string | null) => void;
  clearConsole: (fileId: string) => void;
  appendOutputToConsole: (fileId: string, entry: Omit<OutputEntry, 'timestamp'>) => void;
  setConsoleRunning: (fileId: string, running: boolean) => void;
  setConsoleExecutionTime: (fileId: string, time: number) => void;
  getConsoleByFileId: (fileId: string) => ConsoleState | undefined;

  // Utilities
  getFileById: (id: string) => FileNode | undefined;
  getAllFiles: () => FileNode[];
  getTotalSize: () => number;
  getFilesForExecution: () => { name: string; content: string; toBeExec?: boolean }[];
}

const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const getFileSize = (content: string): number => {
  return new Blob([content]).size;
};

const isValidFileName = (name: string): boolean => {
  // Check for invalid characters and reserved names
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
  const reservedNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  return name.length > 0 && name.length <= 255 && !invalidChars.test(name) && !reservedNames.test(name);
};

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      // Initial state
      files: {},
      rootIds: [],
      activeFileId: null,
      openTabs: [],
      consoles: {},
      activeConsoleId: null,
      selectedFilesForRun: [],

      // File management actions
      addFile: (name: string, parentId: string | null) => {
        if (!isValidFileName(name)) {
          return { success: false, error: 'Invalid file name' };
        }

        const state = get();
        const siblings = parentId
          ? state.files[parentId]?.children || []
          : state.rootIds;

        // Check for duplicate names
        const isDuplicate = siblings.some(id => state.files[id]?.name === name);
        if (isDuplicate) {
          return { success: false, error: 'A file with this name already exists' };
        }

        const id = generateId();
        const parentPath = parentId ? state.files[parentId]?.path || '' : '';
        const path = parentPath ? `${parentPath}/${name}` : name;

        const newFile: FileNode = {
          id,
          name,
          path,
          content: '',
          isFolder: false,
          children: [],
          parentId,
          isModified: false,
        };

        set(state => {
          const newFiles = { ...state.files, [id]: newFile };
          const newRootIds = parentId ? state.rootIds : [...state.rootIds, id];

          // Update parent's children if exists
          if (parentId && state.files[parentId]) {
            newFiles[parentId] = {
              ...state.files[parentId],
              children: [...state.files[parentId].children, id],
            };
          }

          // Auto-open the new file in editor
          return {
            files: newFiles,
            rootIds: newRootIds,
            activeFileId: id,
            openTabs: state.openTabs.includes(id) ? state.openTabs : [...state.openTabs, id],
          };
        });

        return { success: true, id };
      },

      addFolder: (name: string, parentId: string | null) => {
        if (!isValidFileName(name)) {
          return { success: false, error: 'Invalid folder name' };
        }

        const state = get();
        const siblings = parentId
          ? state.files[parentId]?.children || []
          : state.rootIds;

        // Check for duplicate names
        const isDuplicate = siblings.some(id => state.files[id]?.name === name);
        if (isDuplicate) {
          return { success: false, error: 'A folder with this name already exists' };
        }

        const id = generateId();
        const parentPath = parentId ? state.files[parentId]?.path || '' : '';
        const path = parentPath ? `${parentPath}/${name}` : name;

        const newFolder: FileNode = {
          id,
          name,
          path,
          content: '',
          isFolder: true,
          children: [],
          parentId,
          isModified: false,
        };

        set(state => {
          const newFiles = { ...state.files, [id]: newFolder };
          const newRootIds = parentId ? state.rootIds : [...state.rootIds, id];

          // Update parent's children if exists
          if (parentId && state.files[parentId]) {
            newFiles[parentId] = {
              ...state.files[parentId],
              children: [...state.files[parentId].children, id],
            };
          }

          return { files: newFiles, rootIds: newRootIds };
        });

        return { success: true, id };
      },

      updateContent: (id: string, content: string) => {
        const fileSize = getFileSize(content);
        if (fileSize > MAX_FILE_SIZE) {
          return { success: false, error: `File size exceeds limit of ${MAX_FILE_SIZE / 1024}KB` };
        }

        const state = get();
        const currentFile = state.files[id];
        if (!currentFile) {
          return { success: false, error: 'File not found' };
        }

        // Calculate new total size
        const currentSize = getFileSize(currentFile.content);
        const totalSize = state.getTotalSize() - currentSize + fileSize;

        if (totalSize > MAX_TOTAL_SIZE) {
          return { success: false, error: `Total workspace size exceeds limit of ${MAX_TOTAL_SIZE / (1024 * 1024)}MB` };
        }

        // Persist content but do NOT mark files as modified.
        // The app treats all open files as "saved" in-session, so we
        // intentionally keep `isModified` false to disable the dirty state.
        set(state => ({
          files: {
            ...state.files,
            [id]: { ...state.files[id], content, isModified: false },
          },
        }));

        return { success: true };
      },

      deleteNode: (id: string) => {
        const state = get();
        const node = state.files[id];
        if (!node) return;

        // Collect all IDs to delete (including children for folders)
        const idsToDelete: string[] = [id];
        const collectChildren = (nodeId: string) => {
          const n = state.files[nodeId];
          if (n?.isFolder) {
            n.children.forEach(childId => {
              idsToDelete.push(childId);
              collectChildren(childId);
            });
          }
        };
        collectChildren(id);

        set(state => {
          const newFiles = { ...state.files };
          idsToDelete.forEach(delId => delete newFiles[delId]);

          // Remove from parent's children or rootIds
          let newRootIds = state.rootIds;
          if (node.parentId && newFiles[node.parentId]) {
            newFiles[node.parentId] = {
              ...newFiles[node.parentId],
              children: newFiles[node.parentId].children.filter(cId => cId !== id),
            };
          } else {
            newRootIds = state.rootIds.filter(rId => rId !== id);
          }

          // Clean up tabs and active file
          const newOpenTabs = state.openTabs.filter(tabId => !idsToDelete.includes(tabId));
          const newActiveFileId = idsToDelete.includes(state.activeFileId || '')
            ? (newOpenTabs[0] || null)
            : state.activeFileId;

          // Clean up selected files for run
          const newSelectedFiles = state.selectedFilesForRun.filter(
            fId => !idsToDelete.includes(fId)
          );

          // Clean up consoles for deleted files
          const newConsoles = { ...state.consoles };
          idsToDelete.forEach(delId => delete newConsoles[delId]);

          // Update active console if it was deleted
          const newActiveConsoleId = idsToDelete.includes(state.activeConsoleId || '')
            ? (Object.keys(newConsoles)[0] || null)
            : state.activeConsoleId;

          return {
            files: newFiles,
            rootIds: newRootIds,
            openTabs: newOpenTabs,
            activeFileId: newActiveFileId,
            selectedFilesForRun: newSelectedFiles,
            consoles: newConsoles,
            activeConsoleId: newActiveConsoleId,
          };
        });
      },

      renameNode: (id: string, newName: string) => {
        if (!isValidFileName(newName)) {
          return { success: false, error: 'Invalid name' };
        }

        const state = get();
        const node = state.files[id];
        if (!node) {
          return { success: false, error: 'File not found' };
        }

        // Check for duplicate names among siblings
        const siblings = node.parentId
          ? state.files[node.parentId]?.children || []
          : state.rootIds;

        const isDuplicate = siblings.some(
          sibId => sibId !== id && state.files[sibId]?.name === newName
        );
        if (isDuplicate) {
          return { success: false, error: 'A file with this name already exists' };
        }

        // Update path for this node and all children
        const updatePaths = (nodeId: string, basePath: string): Record<string, FileNode> => {
          const n = state.files[nodeId];
          if (!n) return {};

          const newPath = basePath ? `${basePath}/${n.name}` : n.name;
          let updates: Record<string, FileNode> = {
            [nodeId]: { ...n, path: newPath },
          };

          if (n.isFolder) {
            n.children.forEach(childId => {
              updates = { ...updates, ...updatePaths(childId, newPath) };
            });
          }

          return updates;
        };

        const parentPath = node.parentId ? state.files[node.parentId]?.path || '' : '';
        const newPath = parentPath ? `${parentPath}/${newName}` : newName;

        set(state => {
          let newFiles = {
            ...state.files,
            [id]: { ...state.files[id], name: newName, path: newPath },
          };

          // Update children paths if it's a folder
          if (node.isFolder) {
            node.children.forEach(childId => {
              const childUpdates = updatePaths(childId, newPath);
              newFiles = { ...newFiles, ...childUpdates };
            });
          }

          return { files: newFiles };
        });

        return { success: true };
      },

      // Editor actions
      setActiveFile: (id: string | null) => {
        set({ activeFileId: id });
      },

      openTab: (id: string) => {
        set(state => {
          if (state.openTabs.includes(id)) {
            return { activeFileId: id };
          }
          return {
            openTabs: [...state.openTabs, id],
            activeFileId: id,
          };
        });
      },

      closeTab: (id: string) => {
        set(state => {
          const newTabs = state.openTabs.filter(tabId => tabId !== id);
          let newActiveId = state.activeFileId;

          if (state.activeFileId === id) {
            const closedIndex = state.openTabs.indexOf(id);
            newActiveId = newTabs[Math.min(closedIndex, newTabs.length - 1)] || null;
          }

          return {
            openTabs: newTabs,
            activeFileId: newActiveId,
          };
        });
      },

      markAsSaved: (id: string) => {
        set(state => ({
          files: {
            ...state.files,
            [id]: { ...state.files[id], isModified: false },
          },
        }));
      },

      // Network actions
      // Execution actions
      toggleFileForRun: (id: string) => {
        set(state => {
          const isSelected = state.selectedFilesForRun.includes(id);
          return {
            selectedFilesForRun: isSelected
              ? state.selectedFilesForRun.filter(fId => fId !== id)
              : [...state.selectedFilesForRun, id],
          };
        });
      },

      setSelectedFilesForRun: (ids: string[]) => {
        set({ selectedFilesForRun: ids });
      },

      // Console management actions
      createConsole: (fileId: string, filePath: string, sessionId: string) => {
        set(state => {
          const existingConsole = state.consoles[fileId];
          return {
            consoles: {
              ...state.consoles,
              [fileId]: {
                fileId,
                filePath,
                output: [],
                isRunning: true,
                sessionId,
                // Preserve original createdAt if console exists, otherwise use current time
                createdAt: existingConsole?.createdAt ?? Date.now(),
                executionTime: null,
              },
            },
            activeConsoleId: fileId,
          };
        });
      },

      deleteConsole: (fileId: string) => {
        set(state => {
          const newConsoles = { ...state.consoles };
          delete newConsoles[fileId];

          // If deleted console was active, switch to first available or null
          const newActiveId = state.activeConsoleId === fileId
            ? Object.keys(newConsoles)[0] || null
            : state.activeConsoleId;

          return {
            consoles: newConsoles,
            activeConsoleId: newActiveId,
          };
        });
      },

      setActiveConsole: (fileId: string | null) => {
        set({ activeConsoleId: fileId });
      },

      clearConsole: (fileId: string) => {
        set(state => {
          const console = state.consoles[fileId];
          if (!console) return state;

          return {
            consoles: {
              ...state.consoles,
              [fileId]: {
                ...console,
                output: [],
              },
            },
          };
        });
      },

      appendOutputToConsole: (fileId: string, entry: Omit<OutputEntry, 'timestamp'>) => {
        set(state => {
          const console = state.consoles[fileId];
          if (!console) return state;

          let newOutput = [...console.output, { ...entry, timestamp: Date.now() }];
          // Maintain max output entries per console to prevent memory bloat
          // When buffer exceeds limit, discard oldest entries (keep only most recent)
          if (newOutput.length > MAX_OUTPUT_ENTRIES_PER_CONSOLE) {
            newOutput = newOutput.slice(-MAX_OUTPUT_ENTRIES_PER_CONSOLE);
          }

          return {
            consoles: {
              ...state.consoles,
              [fileId]: {
                ...console,
                output: newOutput,
              },
            },
          };
        });
      },

      setConsoleRunning: (fileId: string, running: boolean) => {
        set(state => {
          const console = state.consoles[fileId];
          if (!console) return state;

          return {
            consoles: {
              ...state.consoles,
              [fileId]: {
                ...console,
                isRunning: running,
              },
            },
          };
        });
      },

      setConsoleExecutionTime: (fileId: string, time: number) => {
        set(state => {
          const console = state.consoles[fileId];
          if (!console) return state;

          return {
            consoles: {
              ...state.consoles,
              [fileId]: {
                ...console,
                executionTime: time,
              },
            },
          };
        });
      },

      getConsoleByFileId: (fileId: string) => {
        return get().consoles[fileId];
      },

      // Utility functions
      getFileById: (id: string) => {
        return get().files[id];
      },

      getAllFiles: () => {
        const state = get();
        return Object.values(state.files).filter(f => !f.isFolder);
      },

      getTotalSize: () => {
        const state = get();
        return Object.values(state.files).reduce(
          (total, file) => total + getFileSize(file.content),
          0
        );
      },

      getFilesForExecution: () => {
        const state = get();
        const activeFile = state.activeFileId ? state.files[state.activeFileId] : null;

        return state.selectedFilesForRun
          .map(id => state.files[id])
          .filter((f): f is FileNode => f !== undefined && !f.isFolder)
          .map(f => ({
            name: f.name,
            content: f.content,
            toBeExec: f.id === activeFile?.id,
          }));
      },

      uploadFiles: async (files: File[], parentId: string | null) => {
        console.log('[uploadFiles] Starting upload:', { fileCount: files.length, parentId });

        if (!files || files.length === 0) {
          return { success: false, error: 'No files selected' };
        }

        let totalNewSize = 0;
        const fileDataList: Array<{ path: string; content: string; size: number; isBinary?: boolean }> = [];

        // Read all files and validate sizes
        try {
          console.log('[uploadFiles] Reading files...');
          for (const file of files) {
            console.log('[uploadFiles] Reading file:', { name: file.name, type: file.type, size: file.size });

            // Check file size before reading
            if (file.size > MAX_FILE_SIZE) {
              return { success: false, error: `File "${file.name}" exceeds size limit of ${MAX_FILE_SIZE / 1024}KB` };
            }

            // Determine if file is binary based on type or extension
            const isBinary = file.type.startsWith('image/') ||
              file.type.startsWith('audio/') ||
              file.type.startsWith('video/') ||
              file.type === 'application/octet-stream' ||
              /\.(png|jpg|jpeg|gif|bmp|ico|pdf|zip|tar|gz|exe|dll|so|dylib)$/i.test(file.name);

            let content: string;

            if (isBinary) {
              // Read binary files as data URL (base64)
              content = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string || '');
                reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
                reader.readAsDataURL(file);
              });
            } else {
              // Read text files as text
              content = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string || '');
                reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
                reader.readAsText(file);
              });
            }

            const size = file.size; // Use actual file size instead of content length
            console.log('[uploadFiles] File read:', { name: file.name, size, isBinary, contentLength: content.length });

            totalNewSize += size;

            // Use webkitRelativePath if available (from folder upload), otherwise just the name
            const filePath = (file as any).webkitRelativePath || file.name;
            fileDataList.push({ path: filePath, content, size, isBinary });
          }

          // Check total size
          const currentTotalSize = get().getTotalSize();
          console.log('[uploadFiles] Size check:', { currentTotalSize, totalNewSize, max: MAX_TOTAL_SIZE });

          if (currentTotalSize + totalNewSize > MAX_TOTAL_SIZE) {
            return {
              success: false,
              error: `Upload would exceed workspace size limit of ${MAX_TOTAL_SIZE / (1024 * 1024)}MB`
            };
          }
        } catch (error: any) {
          console.error('[uploadFiles] Error reading files:', error);
          return { success: false, error: error.message };
        }

        // Create folder structure and files
        console.log('[uploadFiles] Creating files in workspace...');
        const folderMap = new Map<string, string>(); // path -> id
        let uploadedCount = 0;

        try {
          for (const fileData of fileDataList) {
            const pathParts = fileData.path.split('/');
            const fileName = pathParts[pathParts.length - 1];

            console.log('[uploadFiles] Processing:', { path: fileData.path, fileName, pathParts });

            // Handle folder structure
            let currentParentId = parentId;
            if (pathParts.length > 1) {
              const folderPaths = pathParts.slice(0, -1);
              let currentPath = '';

              for (const folderName of folderPaths) {
                currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;

                if (!folderMap.has(currentPath)) {
                  // Create folder
                  const currentState = get();
                  const result = currentState.addFolder(folderName, currentParentId);
                  console.log('[uploadFiles] Create folder result:', { folderName, result });

                  if (result.success && result.id) {
                    folderMap.set(currentPath, result.id);
                    currentParentId = result.id;
                  } else if (!result.success && result.error?.includes('already exists')) {
                    // Folder exists, find it
                    const freshState = get();
                    const siblings = currentParentId
                      ? freshState.files[currentParentId]?.children || []
                      : freshState.rootIds;
                    const existingFolder = siblings.find(id => {
                      const node = freshState.files[id];
                      return node?.name === folderName && node?.isFolder;
                    });
                    if (existingFolder) {
                      folderMap.set(currentPath, existingFolder);
                      currentParentId = existingFolder;
                      console.log('[uploadFiles] Found existing folder:', { folderName, id: existingFolder });
                    } else {
                      throw new Error(`Could not find existing folder: ${folderName}`);
                    }
                  } else {
                    throw new Error(result.error || 'Failed to create folder');
                  }
                } else {
                  currentParentId = folderMap.get(currentPath)!;
                }
              }
            }

            // Create the file with content directly
            const currentState = get();
            const fileResult = currentState.addFile(fileName, currentParentId);
            console.log('[uploadFiles] Create file result:', { fileName, result: fileResult });

            if (fileResult.success && fileResult.id) {
              // Update file with both content and binary flag in one operation
              set(state => {
                const file = state.files[fileResult.id!];
                if (!file) return state;

                return {
                  files: {
                    ...state.files,
                    [fileResult.id!]: {
                      ...file,
                      content: fileData.content,
                      isBinary: fileData.isBinary || false,
                    }
                  }
                };
              });

              console.log('[uploadFiles] File updated:', {
                fileName,
                fileId: fileResult.id,
                isBinary: fileData.isBinary,
                contentLength: fileData.content.length,
                contentPreview: fileData.content.substring(0, 50)
              });

              uploadedCount++;
            } else if (!fileResult.success) {
              console.warn(`Failed to create file "${fileName}": ${fileResult.error}`);
            }
          }

          console.log('[uploadFiles] Upload complete:', { uploadedCount });
          return { success: true, uploadedCount };
        } catch (error: any) {
          console.error('[uploadFiles] Error creating files:', error);
          return { success: false, error: error.message, uploadedCount };
        }
      },
    }),
    {
      name: 'code-runner-editor-storage',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        files: state.files,
        rootIds: state.rootIds,
        openTabs: state.openTabs,
        activeFileId: state.activeFileId,
      }),
    }
  )
);
