//client/src/components/Workspace.tsx
import { useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
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
  Home,
  Upload,
  FolderUp,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

function FileTreeNode({ nodeId, depth, onContextAction, selectedNodeId, onSelectNode }: FileTreeNodeProps) {
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
    }
  };

  const isActive = activeFileId === node.id;
  const sortedChildren = sortFileNodes(node.children, files);

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-2 text-sm cursor-pointer py-1.5 px-2 rounded-md transition-all',
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
              className="shrink-0" 
            />
          </>
        ) : (
          <>
            <span className="w-4 shrink-0" />
            <FileIcon filename={node.name} className="shrink-0" />
          </>
        )}
        <span className="truncate flex-1 font-medium">{node.name}</span>
        {/* Three-dot menu - small popup on hover */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-sidebar-accent/80 transition-opacity ml-1"
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

      {/* Render children if folder is expanded */}
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Workspace() {
  const location = useLocation();
  const files = useEditorStore((state: EditorState) => state.files);
  const rootIds = useEditorStore((state: EditorState) => state.rootIds);
  const addFile = useEditorStore((state: EditorState) => state.addFile);
  const addFolder = useEditorStore((state: EditorState) => state.addFolder);
  const deleteNode = useEditorStore((state: EditorState) => state.deleteNode);
  const renameNode = useEditorStore((state: EditorState) => state.renameNode);
  const uploadFiles = useEditorStore((state: EditorState) => state.uploadFiles);

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
          const node = files[nodeId];
          if (node) {
            setDeleteConfirm({ id: nodeId, name: node.name, isFolder });
          }
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

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const filesArray = Array.from(fileList);
    const parentId = getParentIdForNewItem();

    console.log(`Uploading ${filesArray.length} file(s)...`);

    try {
      const result = await uploadFiles(filesArray, parentId);
      if (result.success) {
        console.log(`Successfully uploaded ${result.uploadedCount} file(s)`);
        // Show success feedback if needed
      } else {
        console.error('Upload failed:', result.error);
        alert(`Upload failed: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(`Upload error: ${error.message || 'Upload failed'}`);
    }

    // Reset input
    event.target.value = '';
  }, [uploadFiles, getParentIdForNewItem]);

  const handleFolderUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const filesArray = Array.from(fileList);
    const parentId = getParentIdForNewItem();

    console.log(`Uploading folder with ${filesArray.length} file(s)...`);

    try {
      const result = await uploadFiles(filesArray, parentId);
      if (result.success) {
        console.log(`Successfully uploaded folder with ${result.uploadedCount} file(s)`);
      } else {
        console.error('Folder upload failed:', result.error);
        alert(`Folder upload failed: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Folder upload error:', error);
      alert(`Folder upload error: ${error.message || 'Upload failed'}`);
    }

    // Reset input
    event.target.value = '';
  }, [uploadFiles, getParentIdForNewItem]);

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
        {/* Header - Redesigned */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sidebar-accent/50">
              <Folder className="h-4 w-4 text-sidebar-foreground" />
            </div>
            <span className="text-sm font-semibold text-sidebar-foreground">Explorer</span>
          </div>
          <div className="flex items-center gap-1">
            {location.pathname !== "/" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-sidebar-accent"
                    onClick={() => window.location.href = "/"}
                    title="Go to home"
                  >
                    <Home className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Go to home</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-sidebar-accent"
                  onClick={() => openDialog('newFile', getParentIdForNewItem())}
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
                  className="h-8 w-8 hover:bg-sidebar-accent"
                  onClick={() => openDialog('newFolder', getParentIdForNewItem())}
                >
                  <FolderPlus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New Folder</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-sidebar-accent"
                  onClick={() => document.getElementById('file-upload-input')?.click()}
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Upload Files</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-sidebar-accent"
                  onClick={() => document.getElementById('folder-upload-input')?.click()}
                >
                  <FolderUp className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Upload Folder</TooltipContent>
            </Tooltip>
            <input
              id="file-upload-input"
              type="file"
              multiple
              accept="*/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              aria-label="Upload files"
            />
            <input
              id="folder-upload-input"
              type="file"
              {...({ webkitdirectory: '', directory: '' } as any)}
              onChange={handleFolderUpload}
              style={{ display: 'none' }}
              aria-label="Upload folder"
            />
          </div>
        </div>

        {/* File Tree */}
        <ScrollArea className="flex-1">
          <div className="py-3 px-2">
            {sortedRootIds.length === 0 ? (
              <div className="px-3 py-12 text-center space-y-4">
                <div className="inline-flex p-4 rounded-xl bg-sidebar-accent/30 border-2 border-dashed border-sidebar-border">
                  <FileCode className="h-10 w-10 text-muted-foreground opacity-40" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-sidebar-foreground">No files yet</p>
                  <p className="text-xs text-muted-foreground">
                    Click the buttons above to create files
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
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* New File/Folder/Rename Dialog */}
        <Dialog open={dialogState.type !== null} onOpenChange={(open: boolean) => !open && closeDialog()}>
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
          onOpenChange={(open: boolean) => !open && setDeleteConfirm(null)}
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