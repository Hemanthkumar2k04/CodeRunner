import { useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { useTheme } from './theme-provider';
import { useEditorStore } from '@/stores/useEditorStore';
import { getMonacoLanguage, getLanguageFromExtension, formatBytes, getFileSize } from '@/lib/file-utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { FileIcon } from '@/components/FileIcon';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { X, Play, Loader2, Code2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CodeEditorProps {
  onRunClick: () => void;
}

export function CodeEditor({ onRunClick }: CodeEditorProps) {
  const { theme } = useTheme();
  const files = useEditorStore((state) => state.files);
  const activeFileId = useEditorStore((state) => state.activeFileId);
  const openTabs = useEditorStore((state) => state.openTabs);
  const isRunning = useEditorStore((state) => state.isRunning);
  const setActiveFile = useEditorStore((state) => state.setActiveFile);
  const closeTab = useEditorStore((state) => state.closeTab);
  const updateContent = useEditorStore((state) => state.updateContent);
  const markAsSaved = useEditorStore((state) => state.markAsSaved);

  const activeFile = activeFileId ? files[activeFileId] : null;
  const language = activeFile ? getMonacoLanguage(activeFile.name) : 'plaintext';
  const execLanguage = activeFile ? getLanguageFromExtension(activeFile.name) : null;

  const handleTabClick = useCallback((tabId: string) => {
      setActiveFile(tabId);
    }, [setActiveFile]);

  const handleTabClose = useCallback((tabId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      closeTab(tabId);
    },
    [closeTab]
  );

  const handleEditorChange = useCallback((value: string | undefined) => {
      if (activeFileId && value !== undefined) {
        const result = updateContent(activeFileId, value);
        if (!result.success) {
          // Could show a toast here for size limit errors
          console.warn(result.error);
        }
      }
    }, [activeFileId, updateContent]);

  const handleSave = useCallback(() => {
    if (activeFileId) {
      markAsSaved(activeFileId);
    }
  }, [activeFileId, markAsSaved]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (activeFile && execLanguage && !isRunning) {
          onRunClick();
        }
      }
    }, [handleSave, activeFile, execLanguage, isRunning, onRunClick]);

  // Empty state when no file is open
  if (openTabs.length === 0) {
    return (
      <div className="h-full w-full bg-background flex flex-col items-center justify-center text-muted-foreground">
        <Code2 className="h-16 w-16 mb-4 opacity-30" />
        <h2 className="text-xl font-medium mb-2">No file open</h2>
        <p className="text-sm">Create a new file to start coding</p>
        <p className="text-xs mt-2 opacity-70">
          Use the Explorer panel on the left to create files
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="h-full w-full bg-background flex flex-col overflow-hidden" onKeyDown={handleKeyDown}>
        {/* Tab bar */}
        <div className="flex items-center border-b bg-muted/30 shrink-0">
          <ScrollArea className="flex-1">
            <div className="flex">
              {openTabs.map((tabId) => {
                const file = files[tabId];
                if (!file) return null;
                const isActive = tabId === activeFileId;
                return (
                  <div
                    key={tabId}
                    className={cn(
                      'group flex items-center gap-2 px-3 py-2 border-r cursor-pointer transition-colors min-w-0',
                      'hover:bg-muted/50',
                      isActive
                        ? 'bg-background border-b-2 border-b-primary'
                        : 'bg-muted/20'
                    )}
                    onClick={() => handleTabClick(tabId)}
                  >
                    <FileIcon filename={file.name} size={14} className="shrink-0" />
                    <span className="truncate text-sm max-w-[120px]">{file.name}</span>
                    {file.isModified && (
                      <span className="text-orange-400 text-xs">●</span>
                    )}
                    <button
                      className={cn(
                        'ml-1 p-0.5 rounded hover:bg-muted-foreground/20',
                        'opacity-0 group-hover:opacity-100 transition-opacity',
                        isActive && 'opacity-100'
                      )}
                      onClick={(e) => handleTabClose(tabId, e)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {/* Run button and info */}
          <div className="flex items-center gap-2 px-3 border-l">
            {activeFile && (
              <>
                <Badge variant="outline" className="text-xs">
                  {language}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatBytes(getFileSize(activeFile.content))}
                </span>
              </>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  className="gap-1"
                  onClick={onRunClick}
                  disabled={!activeFile || !execLanguage || isRunning}
                >
                  {isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Run
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {!activeFile
                  ? 'Open a file to run'
                  : !execLanguage
                  ? 'Unsupported language'
                  : isRunning
                  ? 'Code is running...'
                  : 'Run code (Ctrl+Enter)'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 min-h-0">
          <Editor
            height="100%"
            language={language}
            value={activeFile?.content ?? ''}
            onChange={handleEditorChange}
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              padding: { top: 16 },
              wordWrap: 'on',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              tabSize: 2,
            }}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
