import { useState, useCallback, useEffect } from 'react';
import { useEditorStore, type FileNode } from '@/stores/useEditorStore';
import { useSocket } from '@/hooks/useSocket';
import {
  getLanguageFromExtension,
  formatBytes,
  getFileSize,
  flattenTree,
  isLanguageSupported,
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
import { Play, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DependencyResolverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DependencyResolver({ open, onOpenChange }: DependencyResolverProps) {
  const files = useEditorStore((state) => state.files);
  const rootIds = useEditorStore((state) => state.rootIds);
  const activeFileId = useEditorStore((state) => state.activeFileId);
  const isRunning = useEditorStore((state) => state.isRunning);
  const selectedFilesForRun = useEditorStore((state) => state.selectedFilesForRun);
  const setSelectedFilesForRun = useEditorStore((state) => state.setSelectedFilesForRun);
  const appendOutput = useEditorStore((state) => state.appendOutput);
  const { runCode } = useSocket();

  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set());

  const activeFile = activeFileId ? files[activeFileId] : null;
  const activeLanguage = activeFile ? getLanguageFromExtension(activeFile.name) : null;
  
  // Get all files (non-folders) from the tree
  const allFiles = flattenTree(files, rootIds);
  
  // Filter to files matching the active file's language
  const compatibleFiles = allFiles.filter((f) => {
    const lang = getLanguageFromExtension(f.name);
    return lang === activeLanguage;
  });

  // Initialize selection when dialog opens
  useEffect(() => {
    if (open && activeFileId) {
      // Start with the active file selected
      const initial = new Set<string>([activeFileId]);
      // Add previously selected files that are still compatible
      selectedFilesForRun.forEach((id) => {
        const isCompatible = allFiles.some((f) => f.id === id && getLanguageFromExtension(f.name) === activeLanguage);
        if (isCompatible) {
          initial.add(id);
        }
      });
      setLocalSelected(initial);
    }
  }, [open, activeFileId]);

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
    setLocalSelected(new Set(compatibleFiles.map((f) => f.id)));
  }, [compatibleFiles]);

  const selectNone = useCallback(() => {
    // Keep only the active file selected
    setLocalSelected(new Set(activeFileId ? [activeFileId] : []));
  }, [activeFileId]);

  const handleRun = useCallback(() => {
    if (!activeFile || !activeLanguage || !isLanguageSupported(activeLanguage)) {
      return;
    }

    // Build the files array for execution
    const filesToRun = Array.from(localSelected)
      .map((id) => files[id])
      .filter((f): f is FileNode => f !== undefined && !f.isFolder)
      .map((f) => ({
        name: f.name,
        content: f.content,
        toBeExec: f.id === activeFileId,
      }));

    console.log('[DependencyResolver] Files to run:', filesToRun);

    if (filesToRun.length === 0) {
      appendOutput({ type: 'stderr', data: 'Error: No files selected to run' });
      return;
    }

    // Ensure there's exactly one entry point
    const entryPointCount = filesToRun.filter((f) => f.toBeExec).length;
    console.log('[DependencyResolver] Entry points:', entryPointCount);
    if (entryPointCount !== 1) {
      appendOutput({ type: 'stderr', data: 'Error: Entry point file not found' });
      return;
    }

    // Save selection to store
    setSelectedFilesForRun(Array.from(localSelected));

    // Close dialog and run
    onOpenChange(false);
    runCode(filesToRun, activeLanguage);
  }, [
    activeFile,
    activeFileId,
    activeLanguage,
    localSelected,
    files,
    setSelectedFilesForRun,
    onOpenChange,
    runCode,
    appendOutput,
  ]);

  if (!activeFile || !activeLanguage) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Files to Run</DialogTitle>
          <DialogDescription>
            Choose which files to include when running your code. The entry point
            file is always included.
          </DialogDescription>
        </DialogHeader>

        {compatibleFiles.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No compatible files found</p>
          </div>
        ) : (
          <>
            {/* Quick actions */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {localSelected.size} of {compatibleFiles.length} files selected
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={selectNone}>
                  Select None
                </Button>
              </div>
            </div>

            {/* File list */}
            <ScrollArea className="h-[300px] border rounded-md">
              <div className="p-2 space-y-1">
                {compatibleFiles.map((file) => {
                  const isEntryPoint = file.id === activeFileId;
                  const isSelected = localSelected.has(file.id);
                  const fileSize = getFileSize(file.content);

                  return (
                    <div
                      key={file.id}
                      className={cn(
                        'flex items-center gap-3 p-2 rounded-md transition-colors',
                        'hover:bg-muted/50',
                        isSelected && 'bg-muted'
                      )}
                    >
                      <Checkbox
                        id={file.id}
                        checked={isSelected}
                        disabled={isEntryPoint}
                        onCheckedChange={() => toggleFile(file.id)}
                      />
                      <FileIcon filename={file.name} className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <label
                          htmlFor={file.id}
                          className={cn(
                            'block truncate text-sm cursor-pointer',
                            isEntryPoint && 'font-medium'
                          )}
                        >
                          {file.path}
                        </label>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isEntryPoint && (
                          <Badge variant="secondary" className="text-xs">
                            Entry point
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatBytes(fileSize)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Total size */}
            <div className="text-sm text-muted-foreground text-right">
              Total size: {formatBytes(totalSize)}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleRun}
            disabled={localSelected.size === 0 || isRunning}
            className="gap-2"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Run {activeLanguage}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
