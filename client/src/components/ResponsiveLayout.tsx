import { useState, useEffect } from 'react';
import { ResponsiveNavbar } from '@/components/ResponsiveNavbar';
import { MobileWorkspace } from '@/components/MobileWorkspace';
import { Workspace } from '@/components/Workspace';
import { CodeEditor } from '@/components/CodeEditor';
import { Console } from '@/components/Console';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/stores/useEditorStore';
import type { EditorState } from '@/stores/useEditorStore';

interface ResponsiveLayoutProps {
  onRunClick: () => void;
  onStopClick: () => void;
}

export function ResponsiveLayout({ onRunClick, onStopClick }: ResponsiveLayoutProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isConsoleMinimized, setIsConsoleMinimized] = useState(true);
  const [hasEverRun, setHasEverRun] = useState(false);
  
  // Track if any console exists (code has been run at least once)
  const hasConsoles = useEditorStore((state: EditorState) => 
    Object.keys(state.consoles).length > 0
  );
  
  // Auto-expand console on first run and keep it expanded
  useEffect(() => {
    if (hasConsoles && !hasEverRun) {
      setHasEverRun(true);
      setIsConsoleMinimized(false);
    }
  }, [hasConsoles, hasEverRun]);

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
        ) : (
          <div className="w-64 shrink-0">
            <Workspace />
          </div>
        )}

        {/* Editor and Console Area */}
        <div className="flex-1 min-w-0 flex flex-col h-full">
          {/* Editor */}
          <div 
            className="min-h-0 overflow-hidden transition-all duration-500 ease-in-out"
            style={{ height: isConsoleMinimized ? 'calc(100% - 2.5rem)' : '50%' }}
          >
            <CodeEditor onRunClick={onRunClick} onStopClick={onStopClick} />
          </div>

          {/* Console */}
          <div 
            className="border-t overflow-hidden transition-all duration-500 ease-in-out"
            style={{ height: isConsoleMinimized ? '2.5rem' : '50%' }}
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