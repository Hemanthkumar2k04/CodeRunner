import { useCallback } from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';
import { useTheme } from './theme-provider';
import { useEditorStore } from '@/stores/useEditorStore';
import type { EditorState } from '@/stores/useEditorStore';
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
import { X, Play, Loader2, Code2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CodeEditorProps {
  onRunClick: () => void;
}

export function CodeEditor({ onRunClick }: CodeEditorProps) {
  const { theme } = useTheme();
  const files = useEditorStore((state: EditorState) => state.files);
  const activeFileId = useEditorStore((state: EditorState) => state.activeFileId);
  const openTabs = useEditorStore((state: EditorState) => state.openTabs);
  const isRunning = useEditorStore((state: EditorState) => state.isRunning);
  const setActiveFile = useEditorStore((state: EditorState) => state.setActiveFile);
  const closeTab = useEditorStore((state: EditorState) => state.closeTab);
  const updateContent = useEditorStore((state: EditorState) => state.updateContent);
  const markAsSaved = useEditorStore((state: EditorState) => state.markAsSaved);

  const activeFile = activeFileId ? files[activeFileId] : null;
  const language = activeFile ? getMonacoLanguage(activeFile.name) : 'plaintext';
  const execLanguage = activeFile ? getLanguageFromExtension(activeFile.name) : null;

  const handleEditorWillMount = useCallback((monaco: Monaco) => {
    // Ensure all necessary languages are registered and available
    // This fixes issues with language support like Java syntax highlighting
    const languages = ['java', 'python', 'javascript', 'cpp', 'c'];
    languages.forEach((lang) => {
      if (!monaco.languages.getLanguages().find((l: { id: string }) => l.id === lang)) {
        monaco.languages.register({ id: lang });
      }
    });
  }, []);

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
          console.warn(result.error);
        }
      }
    }, [activeFileId, updateContent]);

  const handleSave = useCallback(() => {
    if (activeFileId) {
      markAsSaved(activeFileId);
    }
  }, [activeFileId, markAsSaved]);

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
      <div className="h-full w-full bg-background flex flex-col items-center justify-center text-muted-foreground p-8">
        <div className="max-w-md text-center space-y-6">
          <div className="inline-flex p-6 rounded-2xl bg-muted/30 border-2 border-dashed border-border">
            <Code2 className="h-16 w-16 opacity-30" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">No file open</h2>
            <p className="text-base">Create a new file to start coding</p>
          </div>
          <div className="flex items-center gap-2 text-sm opacity-70 justify-center">
            <Info className="h-4 w-4" />
            <span>Use the Explorer panel on the left to create files</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="h-full w-full bg-background flex flex-col overflow-hidden" onKeyDown={handleKeyDown}>
        {/* Tab bar - Redesigned */}
        <div className="flex items-stretch border-b bg-muted/20 shrink-0">
          {/* Tabs Section */}
          <ScrollArea className="flex-1 max-w-4xl">
            <div className="flex items-stretch h-12">
              {openTabs.map((tabId: string) => {
                const file = files[tabId];
                if (!file) return null;
                const isActive = tabId === activeFileId;
                return (
                  <div
                    key={tabId}
                    className={cn(
                      'group relative flex items-center gap-2.5 px-4 border-r cursor-pointer transition-all min-w-0',
                      'hover:bg-muted/60',
                      isActive
                        ? 'bg-background shadow-sm'
                        : 'bg-transparent'
                    )}
                    onClick={() => handleTabClick(tabId)}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
                    )}
                    
                    <FileIcon filename={file.name} size={16} className="shrink-0" />
                    <span className={cn(
                      "truncate text-sm max-w-[140px]",
                      isActive ? "font-medium" : "font-normal"
                    )}>
                      {file.name}
                    </span>
                    {file.isModified && (
                      <span className="text-orange-400 text-base leading-none">●</span>
                    )}
                    <button
                      className={cn(
                        'ml-auto p-1 rounded-md hover:bg-muted-foreground/20 transition-opacity',
                        'opacity-0 group-hover:opacity-100',
                        isActive && 'opacity-70 hover:opacity-100'
                      )}
                      onClick={(e) => handleTabClose(tabId, e)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {/* Info and Controls Section */}
          <div className="flex items-center gap-3 px-4 border-l bg-muted/10">
            {activeFile && (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs font-medium px-2 py-0.5">
                    {language}
                  </Badge>
                  <div className="h-4 w-px bg-border" />
                  <span className="text-xs text-muted-foreground font-mono">
                    {formatBytes(getFileSize(activeFile.content))}
                  </span>
                </div>
                <div className="h-4 w-px bg-border" />
              </>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  className={cn(
                    "gap-2 h-8 px-4",
                    isRunning && "animate-pulse"
                  )}
                  onClick={onRunClick}
                  disabled={!activeFile || !execLanguage || isRunning}
                >
                  {isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 fill-current" />
                  )}
                  <span className="font-medium">Run</span>
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
            beforeMount={handleEditorWillMount}
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