import { useState, useCallback, useEffect, useRef } from 'react';
import './App.css';
import { ThemeProvider } from './components/theme-provider';
import { Navbar } from './components/Navbar';
import { Workspace } from './components/Workspace';
import { CodeEditor } from './components/CodeEditor';
import { Console } from './components/Console';
import { useSocket } from './hooks/useSocket';
import { useEditorStore } from './stores/useEditorStore';
import type { EditorState } from './stores/useEditorStore';
import { getLanguageFromExtension, flattenTree, isLanguageSupported, isDataFile } from './lib/file-utils';

function AppContent() {
  const { runCode, disconnect } = useSocket();
  const files = useEditorStore((state: EditorState) => state.files);
  const rootIds = useEditorStore((state: EditorState) => state.rootIds);
  const activeFileId = useEditorStore((state: EditorState) => state.activeFileId);

  // Panel sizing state
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [consoleHeight, setConsoleHeight] = useState(200);
  const [isConsoleMinimized, setIsConsoleMinimized] = useState(false);
  
  // Resize state
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingConsole, setIsResizingConsole] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle run button click - automatically run with all compatible files and data files
  const handleRunClick = useCallback(() => {
    const activeFile = activeFileId ? files[activeFileId] : null;
    if (!activeFile) return;

    const activeLanguage = getLanguageFromExtension(activeFile.name);
    if (!activeLanguage || !isLanguageSupported(activeLanguage)) return;

    // Get all files and filter to compatible ones (same language OR data files)
    const allFiles = flattenTree(files, rootIds);
    const compatibleFiles = allFiles
      .filter(f => {
        // Include source files of the same language
        if (getLanguageFromExtension(f.name) === activeLanguage) {
          return true;
        }
        // Always include data files
        if (isDataFile(f.name)) {
          return true;
        }
        return false;
      })
      .map(f => ({
        name: f.name,
        path: f.path,
        content: f.content,
        toBeExec: f.id === activeFileId,
      }));

    if (compatibleFiles.length > 0) {
      // Expand console when running code
      setIsConsoleMinimized(false);
      runCode(compatibleFiles, activeLanguage);
    }
  }, [activeFileId, files, rootIds, runCode]);

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Handle mouse move for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar) {
        const newWidth = Math.max(200, Math.min(500, e.clientX));
        setSidebarWidth(newWidth);
      }
      if (isResizingConsole && containerRef.current && !isConsoleMinimized) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newHeight = Math.max(150, Math.min(600, containerRect.bottom - e.clientY));
        setConsoleHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      setIsResizingConsole(false);
    };

    if (isResizingSidebar || isResizingConsole) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isResizingSidebar ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingSidebar, isResizingConsole, isConsoleMinimized]);

  // Calculate the actual console height based on minimized state
  const actualConsoleHeight = isConsoleMinimized ? 52 : consoleHeight; // 52px for header only

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <Navbar />
      
      <main ref={containerRef} className="flex-1 flex overflow-hidden min-h-0">
        {/* Sidebar / Workspace */}
        <div 
          className="h-full flex-shrink-0 overflow-hidden"
          style={{ width: sidebarWidth }}
        >
          <Workspace />
        </div>

        {/* Sidebar Resize Handle - Enhanced */}
        <div
          className={`group relative w-1 h-full flex-shrink-0 transition-all cursor-col-resize hover:w-1.5 ${
            isResizingSidebar 
              ? 'bg-primary w-1.5' 
              : 'bg-border hover:bg-primary/60'
          }`}
          onMouseDown={() => setIsResizingSidebar(true)}
        >
          {/* Visual indicator on hover */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="h-full w-full bg-primary/20" />
          </div>
          {/* Center grip indicator */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex flex-col gap-1 p-1 rounded bg-primary/10">
              <div className="w-0.5 h-3 bg-primary/60 rounded-full" />
              <div className="w-0.5 h-3 bg-primary/60 rounded-full" />
            </div>
          </div>
        </div>

        {/* Right side: Editor + Console */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Code Editor */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <CodeEditor 
              onRunClick={handleRunClick}
            />
          </div>

          {/* Console Resize Handle - Only show when not minimized */}
          {!isConsoleMinimized && (
            <div
              className={`group relative h-1 w-full flex-shrink-0 transition-all cursor-row-resize hover:h-1.5 ${
                isResizingConsole 
                  ? 'bg-primary h-1.5' 
                  : 'bg-border hover:bg-primary/60'
              }`}
              onMouseDown={() => setIsResizingConsole(true)}
            >
              {/* Visual indicator on hover */}
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="h-full w-full bg-primary/20" />
              </div>
              {/* Center grip indicator */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex gap-1 p-1 rounded bg-primary/10">
                  <div className="w-3 h-0.5 bg-primary/60 rounded-full" />
                  <div className="w-3 h-0.5 bg-primary/60 rounded-full" />
                </div>
              </div>
            </div>
          )}

          {/* Console */}
          <div 
            className="flex-shrink-0 overflow-hidden transition-all duration-200"
            style={{ height: actualConsoleHeight }}
          >
            <Console 
              isMinimized={isConsoleMinimized}
              onToggleMinimize={() => setIsConsoleMinimized(!isConsoleMinimized)}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AppContent />
    </ThemeProvider>
  );
}

export default App;