// src/components/ResponsiveLayout.tsx
import { useState, useEffect } from 'react';
import { Menu, X, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Workspace } from '@/components/Workspace';
import { CodeEditor } from '@/components/CodeEditor';
import { Console } from '@/components/Console';
import { cn } from '@/lib/utils';

interface ResponsiveLayoutProps {
  onRunClick: () => void;
  onStopClick: () => void;
}

type MobileView = 'explorer' | 'editor' | 'console';

export function ResponsiveLayout({ onRunClick, onStopClick }: ResponsiveLayoutProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>('editor');
  const [showSidebar, setShowSidebar] = useState(false);
  const [isConsoleMinimized, setIsConsoleMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    if (!isMobile || !showSidebar) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-sidebar]')) {
        setShowSidebar(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile, showSidebar]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isMobile && showSidebar) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobile, showSidebar]);

  if (isMobile) {
    return (
      <div className="h-full w-full flex flex-col overflow-hidden">
        {/* Mobile Navigation Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-background shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSidebar(!showSidebar)}
            className="h-9 w-9"
          >
            {showSidebar ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant={mobileView === 'explorer' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMobileView('explorer')}
              className="text-xs"
            >
              Files
            </Button>
            <Button
              variant={mobileView === 'editor' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMobileView('editor')}
              className="text-xs"
            >
              Editor
            </Button>
            <Button
              variant={mobileView === 'console' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMobileView('console')}
              className="text-xs"
            >
              Console
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-9 w-9"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>

        {/* Mobile Sidebar Overlay */}
        {showSidebar && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowSidebar(false)}
            />
            <div
              data-sidebar
              className="fixed left-0 top-0 bottom-0 w-72 bg-background z-50 shadow-xl border-r"
            >
              <Workspace />
            </div>
          </>
        )}

        {/* Mobile Content */}
        <div className={cn(
          "flex-1 min-h-0 overflow-hidden",
          isFullscreen && "fixed inset-0 z-30 bg-background"
        )}>
          {mobileView === 'explorer' && (
            <div className="h-full">
              <Workspace />
            </div>
          )}
          {mobileView === 'editor' && (
            <div className="h-full">
              <CodeEditor onRunClick={onRunClick} onStopClick={onStopClick} />
            </div>
          )}
          {mobileView === 'console' && (
            <div className="h-full">
              <Console 
                isMinimized={false} 
                onToggleMinimize={() => {}} 
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className="h-full w-full flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 shrink-0 hidden md:block">
        <Workspace />
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Editor */}
        <div className={cn(
          "flex-1 min-h-0",
          isConsoleMinimized ? "h-full" : "h-3/5"
        )}>
          <CodeEditor onRunClick={onRunClick} onStopClick={onStopClick} />
        </div>

        {/* Console */}
        <div className={cn(
          "border-t transition-all duration-200",
          isConsoleMinimized ? "h-auto" : "h-2/5"
        )}>
          <Console
            isMinimized={isConsoleMinimized}
            onToggleMinimize={() => setIsConsoleMinimized(!isConsoleMinimized)}
          />
        </div>
      </div>
    </div>
  );
}