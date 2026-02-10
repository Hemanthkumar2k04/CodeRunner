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
import type { EditorState } from '@/stores/useEditorStore';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type DialogType = 'newFile' | 'newFolder' | 'rename' | null;

interface DialogState {
  type: DialogType;
  parentId: string | null;
  targetId?: string;
  initialValue?: string;
}

interface MobileWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FileTreeNodeProps {
  nodeId: string;
  depth: number;
  onContextAction: (action: string, nodeId: string, isFolder: boolean) => void;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onFileSelect: () => void;
}

function FileTreeNode({ 
  nodeId, 
  depth, 
  onContextAction,
  selectedNodeId, 
  onSelectNode,
  onFileSelect
}: FileTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const files = useEditorStore((state: EditorState) => state.files);
  const activeFileId = useEditorStore((state: EditorState) => state.activeFileId);
  const setActiveFile = useEditorStore((state: EditorState) => state.setActiveFile);
  const openTab = useEditorStore((state: EditorState) => state.openTab);
  const node = files[nodeId];

  if (!node) return null;

  const handleClick = () => {
    onSelectNode(nodeId);
    
    if (node.isFolder) {
      setIsExpanded(!isExpanded);
    } else {
      setActiveFile(node.id);
      openTab(node.id);
      // Close sidebar on mobile when file is selected
      onFileSelect();
    }
  };

  const isActive = activeFileId === node.id;
  const sortedChildren = sortFileNodes(node.children, files);

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-2 text-sm cursor-pointer transition-all',
          'py-2.5 px-2 rounded-md touch-manipulation',
          'active:scale-[0.98] active:bg-sidebar-accent/80',
          'hover:bg-sidebar-accent/70',
          selectedNodeId === node.id
            ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
            : !selectedNodeId && isActive && !node.isFolder && 'bg-sidebar-accent/50 text-sidebar-accent-foreground'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        {node.isFolder ? (
          <>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
            )}
            <FileIcon 
              filename={node.name} 
              isFolder 
              isOpen={isExpanded} 
              size={18}
              className="shrink-0" 
            />
          </>
        ) : (
          <>
            <span className="w-4 shrink-0" />
            <FileIcon filename={node.name} size={18} className="shrink-0" />
          </>
        )}
        <span className="truncate flex-1 font-medium">{node.name}</span>
        {/* Three-dot menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "p-1.5 rounded opacity-0 group-hover:opacity-100",
                "hover:bg-sidebar-accent transition-opacity",
                "active:bg-sidebar-accent/80"
              )}
              onClick={(e) => e.stopPropagation()}
              title={node.isFolder ? 'Folder options' : 'File options'}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {node.isFolder && (
              <>
                <DropdownMenuItem
                  onClick={() => onContextAction('newFile', node.id, true)}
                >
                  <FilePlus className="h-4 w-4 mr-2" />
                  New File
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onContextAction('newFolder', node.id, true)}
                >
                  <FolderPlus className="h-4 w-4 mr-2" />
                  New Folder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              onClick={() => onContextAction('rename', node.id, node.isFolder)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
              onClick={() => onContextAction('delete', node.id, node.isFolder)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {node.isFolder && isExpanded && sortedChildren.length > 0 && (
        <div>
          {sortedChildren.map((childId) => (
            <FileTreeNode
              key={childId}
              nodeId={childId}
              depth={depth + 1}
              onContextAction={onContextAction}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
              onFileSelect={onFileSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function MobileWorkspace({ isOpen, onClose }: MobileWorkspaceProps) {
  const files = useEditorStore((state: EditorState) => state.files);
  const rootIds = useEditorStore((state: EditorState) => state.rootIds);
  const addFile = useEditorStore((state: EditorState) => state.addFile);
  const addFolder = useEditorStore((state: EditorState) => state.addFolder);
  const deleteNode = useEditorStore((state: EditorState) => state.deleteNode);
  const renameNode = useEditorStore((state: EditorState) => state.renameNode);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
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

  const getParentIdForNewItem = useCallback(() => {
    if (!selectedNodeId) return null;
    const selectedNode = files[selectedNodeId];
    if (!selectedNode) return null;
    return selectedNode.isFolder ? selectedNodeId : selectedNode.parentId || null;
  }, [selectedNodeId, files]);

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
      const node = files[nodeId];
      if (!node) return;

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
        case 'delete': {
          setDeleteConfirm({ id: nodeId, name: node.name, isFolder });
          break;
        }
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
  }, [inputValue, dialogState, addFile, addFolder, renameNode, closeDialog]);

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
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed lg:relative top-0 left-0 bottom-0 z-50",
          "w-72 sm:w-80 lg:w-64",
          "bg-sidebar flex flex-col border-r overflow-hidden",
          "transition-transform duration-300 ease-in-out",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-4 border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sidebar-accent/50">
              <Folder className="h-4 w-4 text-sidebar-foreground" />
            </div>
            <span className="text-sm font-semibold text-sidebar-foreground">Explorer</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 hover:bg-sidebar-accent touch-manipulation"
              onClick={() => openDialog('newFile', getParentIdForNewItem())}
            >
              <FilePlus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 hover:bg-sidebar-accent touch-manipulation"
              onClick={() => openDialog('newFolder', getParentIdForNewItem())}
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* File Tree */}
        <ScrollArea className="flex-1">
          <div className="py-2 sm:py-3 px-2">
            {sortedRootIds.length === 0 ? (
              <div className="px-3 py-12 text-center space-y-4">
                <div className="inline-flex p-4 rounded-xl bg-sidebar-accent/30 border-2 border-dashed border-sidebar-border">
                  <FileCode className="h-10 w-10 text-muted-foreground opacity-40" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-sidebar-foreground">No files yet</p>
                  <p className="text-xs text-muted-foreground">
                    Tap the buttons above to create files
                  </p>
                </div>
              </div>
            ) : (
              sortedRootIds.map((nodeId) => (
                <FileTreeNode
                  key={nodeId}
                  nodeId={nodeId}
                  depth={0}
                  onContextAction={handleContextAction}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                  onFileSelect={onClose}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Create/Rename Dialog */}
        <Dialog open={dialogState.type !== null} onOpenChange={(open) => !open && closeDialog()}>
          <DialogContent className="max-w-[90vw] sm:max-w-lg">
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
                  dialogState.type === 'newFolder' ? 'folder-name' : 'filename.ext'
                }
                className="h-12 text-base"
                autoFocus
              />
              {inputError && (
                <p className="text-sm text-destructive mt-2">{inputError}</p>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={closeDialog} className="h-11 touch-manipulation">
                Cancel
              </Button>
              <Button onClick={handleSubmit} className="h-11 touch-manipulation">
                {dialogState.type === 'rename' ? 'Rename' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog
          open={deleteConfirm !== null}
          onOpenChange={(open) => !open && setDeleteConfirm(null)}
        >
          <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {deleteConfirm?.isFolder ? 'folder' : 'file'}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deleteConfirm?.name}"?
                {deleteConfirm?.isFolder && ' All contents will be deleted.'}
                {' '}This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-0">
              <AlertDialogCancel className="h-11 touch-manipulation">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="h-11 touch-manipulation bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}