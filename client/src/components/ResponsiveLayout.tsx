import { useState, useEffect } from 'react';
import { Folder } from 'lucide-react';
import { ResponsiveNavbar } from '@/components/ResponsiveNavbar';
import { MobileWorkspace } from '@/components/MobileWorkspace';
import { Workspace } from '@/components/Workspace';
import { CodeEditor } from '@/components/CodeEditor';
import { Console } from '@/components/Console';
import { useEditorStore } from '@/stores/useEditorStore';
import type { EditorState } from '@/stores/useEditorStore';
import { cn } from '@/lib/utils';

interface ResponsiveLayoutProps {
  onRunClick: () => void;
  onStopClick: () => void;
}

export function ResponsiveLayout({ onRunClick, onStopClick }: ResponsiveLayoutProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(false);
  const [isConsoleMinimized, setIsConsoleMinimized] = useState(true); // Start closed

  // Track if any code is running to auto-expand console
  const consoles = useEditorStore((state: EditorState) => state.consoles);
  const isAnyCodeRunning = Object.values(consoles).some(console => console.isRunning);

  // Auto-expand console when code starts running, collapse when it stops
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

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Navbar */}
      <ResponsiveNavbar 
        onMenuClick={() => setShowSidebar(!showSidebar)}
        isMenuOpen={showSidebar}
      />

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Sidebar - Mobile (Hamburger) or Desktop (Always visible) */}
        {isMobile ? (
          <MobileWorkspace 
            isOpen={showSidebar} 
            onClose={() => setShowSidebar(false)} 
          />
        ) : isWorkspaceCollapsed ? (
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
          <div className="w-64 shrink-0">
            <Workspace onCollapse={() => setIsWorkspaceCollapsed(true)} />
          </div>
        )}

        {/* Editor and Console Area */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Editor */}
          <div 
            className={cn(
              "overflow-hidden transition-all duration-500 ease-in-out",
              isConsoleMinimized ? "flex-1" : "flex-[1_1_40%]"
            )}
          >
            <CodeEditor onRunClick={onRunClick} onStopClick={onStopClick} />
          </div>

          {/* Console */}
          <div 
            className={cn(
              "border-t overflow-hidden transition-all duration-500 ease-in-out",
              isConsoleMinimized ? "flex-[0_0_2.5rem]" : "flex-[1_1_60%]"
            )}
          >
            <Console
              isMinimized={isConsoleMinimized}
              onToggleMinimize={() => setIsConsoleMinimized(!isConsoleMinimized)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}