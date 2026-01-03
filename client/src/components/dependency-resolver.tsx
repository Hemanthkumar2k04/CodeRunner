import { useState, useCallback, useEffect, useMemo } from 'react';
import { useEditorStore, type FileNode } from '@/stores/useEditorStore';
import type { EditorState } from '@/stores/useEditorStore';
import { useSocket } from '@/hooks/useSocket';
import {
  getLanguageFromExtension,
  formatBytes,
  getFileSize,
  flattenTree,
  isLanguageSupported,
  isDataFile,
} from '@/lib/file-utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { FileIcon } from '@/components/FileIcon';
import { Play, Loader2, AlertCircle, CheckCircle2, File, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DependencyResolverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DependencyResolver({ open, onOpenChange }: DependencyResolverProps) {
  const files = useEditorStore((state: EditorState) => state.files);
  const rootIds = useEditorStore((state: EditorState) => state.rootIds);
  const activeFileId = useEditorStore((state: EditorState) => state.activeFileId);
  const consoles = useEditorStore((state: EditorState) => state.consoles);
  const selectedFilesForRun = useEditorStore((state: EditorState) => state.selectedFilesForRun);
  const setSelectedFilesForRun = useEditorStore((state: EditorState) => state.setSelectedFilesForRun);
  const { runCode } = useSocket();

  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set());

  const activeFile = activeFileId ? files[activeFileId] : null;
  const activeConsole = activeFileId ? consoles[activeFileId] : null;
  const isRunning = activeConsole?.isRunning || false;
  const activeLanguage = activeFile ? getLanguageFromExtension(activeFile.name) : null;
  
  // Get all files (non-folders) from the tree
  const allFiles = flattenTree(files, rootIds);
  
  // Filter to files matching the active file's language OR data files
  const compatibleFiles = useMemo(() => {
    return allFiles.filter((f) => {
      // Always include data files
      if (isDataFile(f.name)) {
        return true;
      }
      // Include source files of the same language
      const lang = getLanguageFromExtension(f.name);
      return lang === activeLanguage;
    });
  }, [allFiles, activeLanguage]);

  // Separate data files from source files
  const dataFiles = useMemo(() => compatibleFiles.filter(f => isDataFile(f.name)), [compatibleFiles]);
  const sourceFiles = useMemo(() => compatibleFiles.filter(f => !isDataFile(f.name)), [compatibleFiles]);

  // Initialize selection when dialog opens
  useEffect(() => {
    if (open && activeFileId) {
      // Start with the active file selected
      const initial = new Set<string>([activeFileId]);
      // Always add all data files
      allFiles.forEach((f) => {
        if (isDataFile(f.name)) {
          initial.add(f.id);
        }
      });
      // Add previously selected source files that are still compatible
      selectedFilesForRun.forEach((id: string) => {
        const file = allFiles.find((f) => f.id === id);
        if (file && !isDataFile(file.name) && getLanguageFromExtension(file.name) === activeLanguage) {
          initial.add(id);
        }
      });
      setLocalSelected(initial);
    }
  }, [open, activeFileId, allFiles, selectedFilesForRun, activeLanguage]);

  const toggleFile = useCallback((fileId: string) => {
    // Don't allow deselecting the entry point (active file)
    if (fileId === activeFileId) return;

    setLocalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, [activeFileId]);

  const selectAll = useCallback(() => {
    const ids = compatibleFiles.map((f) => f.id);
    setLocalSelected(new Set(ids));
  }, [compatibleFiles]);

  const selectNone = useCallback(() => {
    // Keep only the active file selected
    setLocalSelected(new Set(activeFileId ? [activeFileId] : []));
  }, [activeFileId]);

  const handleRunWithSelection = useCallback(() => {
    if (!activeFile || !activeLanguage || !isLanguageSupported(activeLanguage) || !activeFileId) {
      return;
    }

    // Build the files array for execution
    const filesToRun = Array.from(localSelected)
      .map((id) => files[id])
      .filter((f): f is FileNode => f !== undefined && !f.isFolder)
      .map((f) => ({
        name: f.name,
        path: f.path,
        content: f.content,
        toBeExec: f.id === activeFileId,
      }));

    if (filesToRun.length === 0) {
      // Console not available here, will show error in console when created
      return;
    }

    // Ensure there's exactly one entry point
    const entryPointCount = filesToRun.filter((f) => f.toBeExec).length;
    if (entryPointCount !== 1) {
      // Console not available here, will show error in console when created
      return;
    }

    // Save selection to store
    setSelectedFilesForRun(Array.from(localSelected));

    // Close dialog and run
    onOpenChange(false);
    runCode(activeFileId, activeFile.path, filesToRun, activeLanguage);
  }, [
    activeFile,
    activeFileId,
    activeLanguage,
    localSelected,
    files,
    setSelectedFilesForRun,
    onOpenChange,
    runCode,
  ]);

  if (!activeFile || !activeLanguage) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cannot Run Code</DialogTitle>
            <DialogDescription>
              Please open a supported file (Python, JavaScript, Java, or C++) to run code.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const totalSize = Array.from(localSelected)
    .map((id) => files[id])
    .filter((f): f is FileNode => f !== undefined)
    .reduce((sum, f) => sum + getFileSize(f.content), 0);

  const selectedCount = localSelected.size;
  const totalCount = compatibleFiles.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Select Files to Run</DialogTitle>
          <DialogDescription className="text-base">
            Choose which files to include when running your code. The entry point file is always included.
          </DialogDescription>
        </DialogHeader>

        {compatibleFiles.length === 0 ? (
          <div className="py-12 text-center space-y-4">
            <div className="inline-flex p-4 rounded-xl bg-muted/30 border-2 border-dashed border-border">
              <AlertCircle className="h-10 w-10 text-muted-foreground opacity-40" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">No compatible files found</p>
              <p className="text-xs text-muted-foreground">Create files with the same language to run them together</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stats and Quick Actions */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <div className="text-sm">
                  <span className="font-semibold">{selectedCount}</span>
                  <span className="text-muted-foreground"> of </span>
                  <span className="font-semibold">{totalCount}</span>
                  <span className="text-muted-foreground"> files selected</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll} className="h-8">
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={selectNone} className="h-8">
                  Clear
                </Button>
              </div>
            </div>

            {/* File Lists */}
            <ScrollArea className="h-[400px] rounded-lg border">
              <div className="p-3 space-y-4">
                {/* Source Files Section */}
                {sourceFiles.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-2 py-1">
                      <File className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Source Files
                      </span>
                    </div>
                    <div className="space-y-1">
                      {sourceFiles.map((file) => {
                        const isEntryPoint = file.id === activeFileId;
                        const isSelected = localSelected.has(file.id);
                        const fileSize = getFileSize(file.content);

                        return (
                          <div
                            key={file.id}
                            className={cn(
                              'flex items-center gap-3 p-3 rounded-md transition-all',
                              'hover:bg-muted/50 border',
                              isSelected ? 'bg-muted border-primary/20' : 'bg-background border-transparent'
                            )}
                          >
                            <Checkbox
                              id={file.id}
                              checked={isSelected}
                              disabled={isEntryPoint}
                              onCheckedChange={() => toggleFile(file.id)}
                              className="shrink-0"
                            />
                            <FileIcon filename={file.name} size={18} className="shrink-0" />
                            <div className="flex-1 min-w-0">
                              <label
                                htmlFor={file.id}
                                className={cn(
                                  'block truncate text-sm cursor-pointer',
                                  isEntryPoint && 'font-semibold'
                                )}
                              >
                                {file.path}
                              </label>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isEntryPoint && (
                                <Badge variant="default" className="text-xs font-medium">
                                  Entry Point
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground font-mono">
                                {formatBytes(fileSize)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Data Files Section */}
                {dataFiles.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-2 py-1">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Data Files
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        Auto-included
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {dataFiles.map((file) => {
                        const isSelected = localSelected.has(file.id);
                        const fileSize = getFileSize(file.content);

                        return (
                          <div
                            key={file.id}
                            className={cn(
                              'flex items-center gap-3 p-3 rounded-md transition-all',
                              'hover:bg-muted/50 border',
                              isSelected ? 'bg-muted border-primary/20' : 'bg-background border-transparent'
                            )}
                          >
                            <Checkbox
                              id={file.id}
                              checked={isSelected}
                              onCheckedChange={() => toggleFile(file.id)}
                              className="shrink-0"
                            />
                            <FileIcon filename={file.name} size={18} className="shrink-0" />
                            <div className="flex-1 min-w-0">
                              <label
                                htmlFor={file.id}
                                className="block truncate text-sm cursor-pointer"
                              >
                                {file.path}
                              </label>
                            </div>
                            <span className="text-xs text-muted-foreground font-mono shrink-0">
                              {formatBytes(fileSize)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Total Size Display */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/20 text-sm">
              <span className="text-muted-foreground">Total size:</span>
              <span className="font-mono font-semibold">{formatBytes(totalSize)}</span>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleRunWithSelection}
            disabled={localSelected.size === 0 || isRunning}
            className="gap-2 min-w-[120px]"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                Run {activeLanguage}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}