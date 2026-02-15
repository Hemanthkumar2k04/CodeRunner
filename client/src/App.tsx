import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useCallback, useEffect, useRef } from 'react';
import './App.css';
import { ThemeProvider } from './components/theme-provider';
import { Toaster } from './components/ui/toaster';
import { HomePage } from './components/HomePage';
import { LabPage } from './components/LabPage';
import { AdminPage } from './components/AdminPage';
import { ResponsiveNavbar } from './components/ResponsiveNavbar';
import { Folder } from 'lucide-react';
import { MobileWorkspace } from './components/MobileWorkspace';
import { Workspace } from './components/Workspace';
import { CodeEditor } from './components/CodeEditor';
import { Console } from './components/Console';
import { useSocket } from './hooks/useSocket';
import { useCopyPasteRestriction } from './hooks/useCopyPasteRestriction';
import { useEditorStore } from './stores/useEditorStore';
import type { EditorState } from './stores/useEditorStore';
import { getLanguageFromExtension, flattenTree, isLanguageSupported, isDataFile } from './lib/file-utils';
import { cn } from './lib/utils';

function EditorPage() {
  const { runCode, stopCode, disconnect } = useSocket();
  const files = useEditorStore((state: EditorState) => state.files);
  const rootIds = useEditorStore((state: EditorState) => state.rootIds);
  const activeFileId = useEditorStore((state: EditorState) => state.activeFileId);

  // Apply global copy-paste restriction
  useCopyPasteRestriction();

  // Responsive state
  const [isMobile, setIsMobile] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  // Panel sizing state (desktop only)
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isConsoleMinimized, setIsConsoleMinimized] = useState(true); // Start closed
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(false);
  
  // Resize state (desktop only)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track if any code is running to auto-expand console
  const consoles = useEditorStore((state: EditorState) => state.consoles);
  const isAnyCodeRunning = Object.values(consoles).some(c => c.isRunning);

  // Auto-expand console when code starts running
  useEffect(() => {
    if (isAnyCodeRunning) {
      setIsConsoleMinimized(false);
    }
  }, [isAnyCodeRunning]);

  // Detect mobile/tablet viewport (< 1024px for sidebar menu)
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      // Close sidebar when viewport becomes desktop
      if (!mobile) {
        setShowSidebar(false);
      }
    };
    
    // Set initial state
    checkMobile();
    
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isMobile && showSidebar) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isMobile, showSidebar]);

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

    if (compatibleFiles.length > 0 && activeFileId) {
      runCode(activeFileId, activeFile.path, compatibleFiles, activeLanguage);
    }
  }, [activeFileId, files, rootIds, runCode]);

  // Handle stop button click
  const handleStopClick = useCallback(() => {
    if (activeFileId) {
      stopCode(activeFileId);
    }
  }, [activeFileId, stopCode]);

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Handle mouse move for resizing (desktop only)
  useEffect(() => {
    if (isMobile) return; // Disable resizing on mobile

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar) {
        const newWidth = Math.max(300, Math.min(500, e.clientX));
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
    };

    if (isResizingSidebar) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingSidebar, isMobile]);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <ResponsiveNavbar 
        onMenuClick={() => setShowSidebar(!showSidebar)}
        isMenuOpen={showSidebar}
      />
      
      <main ref={containerRef} className="flex-1 flex overflow-hidden min-h-0">
        {/* Sidebar - Mobile (Hamburger) or Desktop (Fixed) */}
        {isMobile ? (
          <MobileWorkspace 
            isOpen={showSidebar} 
            onClose={() => setShowSidebar(false)} 
          />
        ) : (
          <>
            {/* Desktop Sidebar */}
            {isWorkspaceCollapsed ? (
              <div className="w-12 shrink-0 border-r flex flex-col items-center py-4 bg-sidebar">
                <div 
                  className="p-1.5 rounded-lg bg-sidebar-accent/50 cursor-pointer hover:bg-sidebar-accent/80 transition-colors"
                  onClick={() => setIsWorkspaceCollapsed(false)}
                  title="Expand sidebar"
                >
                  <Folder className="h-4 w-4 text-sidebar-foreground" />
                </div>
              </div>
            ) : (
              <div 
                className="h-full flex-shrink-0 overflow-hidden"
                style={{ width: sidebarWidth }}
              >
                <Workspace onCollapse={() => setIsWorkspaceCollapsed(true)} />
              </div>
            )}

            {/* Sidebar Resize Handle - Desktop only */}
            {!isWorkspaceCollapsed && (
              <div
                className={cn(
                  "group relative w-1 h-full flex-shrink-0 transition-all cursor-col-resize hover:w-1.5",
                  isResizingSidebar 
                    ? 'bg-primary w-1.5' 
                    : 'bg-border hover:bg-primary/60'
                )}
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
            )}
          </>
        )}

        {/* Right side: Editor + Console */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Code Editor */}
          <div 
            className={cn(
              "min-h-0 overflow-hidden transition-all duration-500 ease-in-out",
              isConsoleMinimized ? "flex-1" : "flex-[2_1_40%]"
            )}
          >
            <CodeEditor 
              onRunClick={handleRunClick}
              onStopClick={handleStopClick}
            />
          </div>

          {/* Console */}
          <div 
            className={cn(
              "border-t overflow-hidden transition-all duration-500 ease-in-out",
              isConsoleMinimized 
                ? "flex-[0_0_2.5rem]" 
                : "flex-[3_1_60%]"
            )}
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
    <Router>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <Toaster />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/lab" element={<LabPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ThemeProvider>
    </Router>
  );
}

export default App;