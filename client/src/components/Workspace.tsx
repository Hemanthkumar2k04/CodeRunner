import { useState, useCallback } from 'react';
import {
  Folder,
  FilePlus,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Trash2,
  Pencil,
  MoreVertical,
  FileCode,
} from 'lucide-react';
import { useEditorStore } from '@/stores/useEditorStore';
import { sortFileNodes } from '@/lib/file-utils';
import { FileIcon } from '@/components/FileIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// Dialog types
type DialogType = 'newFile' | 'newFolder' | 'rename' | null;

interface DialogState {
  type: DialogType;
  parentId: string | null;
  targetId?: string;
  initialValue?: string;
}

// File tree node component
interface FileTreeNodeProps {
  nodeId: string;
  depth: number;
  onContextAction: (action: string, nodeId: string, isFolder: boolean) => void;
}

function FileTreeNode({ nodeId, depth, onContextAction }: FileTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const files = useEditorStore((state) => state.files);
  const activeFileId = useEditorStore((state) => state.activeFileId);
  const setActiveFile = useEditorStore((state) => state.setActiveFile);
  const openTab = useEditorStore((state) => state.openTab);
  const node = files[nodeId];

  if (!node) return null;

  const handleClick = () => {
    if (node.isFolder) {
      setIsExpanded(!isExpanded);
    } else {
      setActiveFile(node.id);
      openTab(node.id);
    }
  };

  const isActive = activeFileId === node.id;
  const sortedChildren = sortFileNodes(node.children, files);

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            className={cn(
              'group flex items-center gap-1 text-sm cursor-pointer py-1 px-2 rounded-md transition-colors',
              'hover:bg-sidebar-accent',
              isActive && !node.isFolder && 'bg-sidebar-accent text-sidebar-accent-foreground'
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={handleClick}
          >
            {node.isFolder ? (
              <>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <FileIcon 
                  filename={node.name} 
                  isFolder 
                  isOpen={isExpanded} 
                  className="shrink-0" 
                />
              </>
            ) : (
              <>
                <span className="w-4" /> {/* Spacer for alignment */}
                <FileIcon filename={node.name} className="shrink-0" />
              </>
            )}
            <span className="truncate flex-1">{node.name}</span>
            {node.isModified && !node.isFolder && (
              <span className="text-xs text-orange-400">●</span>
            )}
            {!node.isFolder && (
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <button
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/20 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem
                    onClick={() => onContextAction('rename', node.id, false)}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Rename
                  </ContextMenuItem>
                  <ContextMenuItem
                    className="text-destructive"
                    onClick={() => onContextAction('delete', node.id, false)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {node.isFolder && (
            <>
              <ContextMenuItem
                onClick={() => onContextAction('newFile', node.id, true)}
              >
                <FilePlus className="h-4 w-4 mr-2" />
                New File
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => onContextAction('newFolder', node.id, true)}
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem
            onClick={() => onContextAction('rename', node.id, node.isFolder)}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => onContextAction('delete', node.id, node.isFolder)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Render children if folder is expanded */}
      {node.isFolder && isExpanded && sortedChildren.length > 0 && (
        <div>
          {sortedChildren.map((childId) => (
            <FileTreeNode
              key={childId}
              nodeId={childId}
              depth={depth + 1}
              onContextAction={onContextAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Workspace() {
  const files = useEditorStore((state) => state.files);
  const rootIds = useEditorStore((state) => state.rootIds);
  const addFile = useEditorStore((state) => state.addFile);
  const addFolder = useEditorStore((state) => state.addFolder);
  const deleteNode = useEditorStore((state) => state.deleteNode);
  const renameNode = useEditorStore((state) => state.renameNode);

  const [dialogState, setDialogState] = useState<DialogState>({
    type: null,
    parentId: null,
  });
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
    isFolder: boolean;
  } | null>(null);

  const sortedRootIds = sortFileNodes(rootIds, files);

  const openDialog = useCallback(
    (type: DialogType, parentId: string | null, targetId?: string) => {
      const initialValue = targetId ? files[targetId]?.name || '' : '';
      setDialogState({ type, parentId, targetId, initialValue });
      setInputValue(initialValue);
      setInputError(null);
    },
    [files]
  );

  const closeDialog = useCallback(() => {
    setDialogState({ type: null, parentId: null });
    setInputValue('');
    setInputError(null);
  }, []);

  const handleContextAction = useCallback(
    (action: string, nodeId: string, isFolder: boolean) => {
      switch (action) {
        case 'newFile':
          openDialog('newFile', nodeId);
          break;
        case 'newFolder':
          openDialog('newFolder', nodeId);
          break;
        case 'rename':
          openDialog('rename', null, nodeId);
          break;
        case 'delete':
          const node = files[nodeId];
          if (node) {
            setDeleteConfirm({ id: nodeId, name: node.name, isFolder });
          }
          break;
      }
    },
    [files, openDialog]
  );

  const handleSubmit = useCallback(() => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue) {
      setInputError('Name cannot be empty');
      return;
    }

    let result: { success: boolean; error?: string };

    switch (dialogState.type) {
      case 'newFile':
        result = addFile(trimmedValue, dialogState.parentId);
        break;
      case 'newFolder':
        result = addFolder(trimmedValue, dialogState.parentId);
        break;
      case 'rename':
        if (dialogState.targetId) {
          result = renameNode(dialogState.targetId, trimmedValue);
        } else {
          result = { success: false, error: 'No target selected' };
        }
        break;
      default:
        result = { success: false, error: 'Unknown action' };
    }

    if (result.success) {
      closeDialog();
    } else {
      setInputError(result.error || 'An error occurred');
    }
  }, [
    inputValue,
    dialogState,
    addFile,
    addFolder,
    renameNode,
    closeDialog,
  ]);

  const handleDelete = useCallback(() => {
    if (deleteConfirm) {
      deleteNode(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, deleteNode]);

  const getDialogTitle = () => {
    switch (dialogState.type) {
      case 'newFile':
        return 'New File';
      case 'newFolder':
        return 'New Folder';
      case 'rename':
        return 'Rename';
      default:
        return '';
    }
  };

  const getDialogDescription = () => {
    switch (dialogState.type) {
      case 'newFile':
        return 'Enter a name for the new file';
      case 'newFolder':
        return 'Enter a name for the new folder';
      case 'rename':
        return 'Enter the new name';
      default:
        return '';
    }
  };

  return (
    <TooltipProvider>
      <div className="h-full w-full bg-sidebar flex flex-col border-r overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-sidebar-foreground">
            <Folder className="h-4 w-4" />
            <span>Explorer</span>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => openDialog('newFile', null)}
                >
                  <FilePlus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New File</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => openDialog('newFolder', null)}
                >
                  <FolderPlus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New Folder</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* File Tree */}
        <ScrollArea className="flex-1">
          <div className="py-2">
            {sortedRootIds.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                <FileCode className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No files yet</p>
                <p className="text-xs mt-1">
                  Click the buttons above to create a file or folder
                </p>
              </div>
            ) : (
              sortedRootIds.map((nodeId) => (
                <FileTreeNode
                  key={nodeId}
                  nodeId={nodeId}
                  depth={0}
                  onContextAction={handleContextAction}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* New File/Folder/Rename Dialog */}
        <Dialog open={dialogState.type !== null} onOpenChange={(open) => !open && closeDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{getDialogTitle()}</DialogTitle>
              <DialogDescription>{getDialogDescription()}</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setInputError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder={
                  dialogState.type === 'newFolder'
                    ? 'folder-name'
                    : 'filename.ext'
                }
                autoFocus
              />
              {inputError && (
                <p className="text-sm text-destructive mt-2">{inputError}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>
                {dialogState.type === 'rename' ? 'Rename' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={deleteConfirm !== null}
          onOpenChange={(open) => !open && setDeleteConfirm(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {deleteConfirm?.isFolder ? 'folder' : 'file'}?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deleteConfirm?.name}"?
                {deleteConfirm?.isFolder && ' All contents will be deleted.'}
                {' '}This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
