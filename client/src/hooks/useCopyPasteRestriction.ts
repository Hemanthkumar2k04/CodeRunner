// client/src/hooks/useCopyPasteRestriction.ts
import { useEffect } from 'react';
import { toast } from 'sonner';
import { isTestingMode } from '@/lib/clipboard-blocker';

/**
 * Custom hook to disable copy, paste, and cut operations globally
 * This prevents students from copying/pasting code during testing
 * Can be disabled by enabling testing mode (add ?test=true to URL or set localStorage key)
 */
export function useCopyPasteRestriction() {
  useEffect(() => {
    // Skip restriction if in testing mode (allows paste for testing)
    if (isTestingMode()) return;

    // Track if we've shown a recent notification to avoid spam
    let lastPasteWarningTime = 0;
    const WARNING_COOLDOWN = 1000; // 1 second cooldown between warnings

    // Prevent copy, cut, paste events
    const preventClipboard = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Show notification only for paste events and with cooldown
      if (e.type === 'paste') {
        const now = Date.now();
        if (now - lastPasteWarningTime > WARNING_COOLDOWN) {
          toast.error('Pasting is not allowed', {
            description: 'This action is disabled.',
            duration: 3000,
          });
          lastPasteWarningTime = now;
        }
      }
      
      return false;
    };

    // Prevent keyboard shortcuts for copy/paste/cut
    const preventKeyboardShortcuts = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifierKey = isMac ? e.metaKey : e.ctrlKey;

      // Block Ctrl+C, Ctrl+V, Ctrl+X (and Cmd equivalents on Mac)
      if (modifierKey && (e.key === 'c' || e.key === 'v' || e.key === 'x')) {
        e.preventDefault();
        e.stopPropagation();
        
        // Show notification only for paste and with cooldown
        if (e.key === 'v') {
          const now = Date.now();
          if (now - lastPasteWarningTime > WARNING_COOLDOWN) {
            toast.error('Pasting is not allowed', {
              description: 'This action is disabled.',
              duration: 3000,
            });
            lastPasteWarningTime = now;
          }
        }
        if (e.key === 'c') {
          const now = Date.now();
          if (now - lastPasteWarningTime > WARNING_COOLDOWN) {
            toast.error('Copying is not allowed', {
              description: 'This action is disabled.',
              duration: 3000,
            });
            lastPasteWarningTime = now;
          }
        }
        
        return false;
      }

      // Block Shift+Insert (paste) and Ctrl+Insert (copy)
      if (e.key === 'Insert' && (e.shiftKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        
        // Show notification only for paste (Shift+Insert) and with cooldown
        if (e.shiftKey) {
          const now = Date.now();
          if (now - lastPasteWarningTime > WARNING_COOLDOWN) {
            toast.error('Pasting is not allowed', {
              description: 'This action is disabled.',
              duration: 3000,
            });
            lastPasteWarningTime = now;
          }
        }
        
        return false;
      }
    };

    // Prevent right-click context menu
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // Prevent drag and drop
    const preventDragDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // Add event listeners with capture phase to catch events early
    document.addEventListener('copy', preventClipboard, { capture: true });
    document.addEventListener('cut', preventClipboard, { capture: true });
    document.addEventListener('paste', preventClipboard, { capture: true });
    document.addEventListener('keydown', preventKeyboardShortcuts, { capture: true });
    document.addEventListener('contextmenu', preventContextMenu, { capture: true });
    document.addEventListener('drop', preventDragDrop, { capture: true });
    document.addEventListener('dragover', preventDragDrop, { capture: true });

    // Cleanup on unmount
    return () => {
      document.removeEventListener('copy', preventClipboard, { capture: true });
      document.removeEventListener('cut', preventClipboard, { capture: true });
      document.removeEventListener('paste', preventClipboard, { capture: true });
      document.removeEventListener('keydown', preventKeyboardShortcuts, { capture: true });
      document.removeEventListener('contextmenu', preventContextMenu, { capture: true });
      document.removeEventListener('drop', preventDragDrop, { capture: true });
      document.removeEventListener('dragover', preventDragDrop, { capture: true });
    };
  }, []);
}
