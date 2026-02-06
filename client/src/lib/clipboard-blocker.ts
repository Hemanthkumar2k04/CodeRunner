// client/src/lib/clipboard-blocker.ts
import * as monaco from 'monaco-editor';
import type { editor } from 'monaco-editor';

/**
 * Configure Monaco Editor to disable copy/paste/cut operations
 * @param editor Monaco editor instance
 */
export function disableMonacoClipboard(editor: editor.IStandaloneCodeEditor | null) {
  if (!editor) return;

  // Get the DOM node of the editor
  const editorDomNode = editor.getDomNode();
  if (!editorDomNode) return;

  // Prevent clipboard events on editor
  const preventClipboard = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  editorDomNode.addEventListener('copy', preventClipboard, { capture: true });
  editorDomNode.addEventListener('cut', preventClipboard, { capture: true });
  editorDomNode.addEventListener('paste', preventClipboard, { capture: true });

  // Override Monaco's built-in clipboard commands
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC, () => {
    // Do nothing - block copy
  });

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => {
    // Do nothing - block paste
  });

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX, () => {
    // Do nothing - block cut
  });

  // Block Shift+Insert (paste) and Ctrl+Insert (copy)
  editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Insert, () => {
    // Do nothing - block paste
  });

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Insert, () => {
    // Do nothing - block copy
  });
}

/**
 * CSS to disable text selection (optional - for enhanced UX)
 * Add this class to elements where you want to prevent selection
 */
export const DISABLE_SELECTION_CLASS = 'disable-text-selection';

/**
 * Apply global clipboard blocking styles
 */
export function applyClipboardBlockingStyles() {
  const styleId = 'clipboard-blocking-styles';
  
  // Check if styles already exist
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    /* Prevent text selection globally - optional */
    .disable-text-selection {
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }

    /* Custom cursor for disabled copy/paste areas */
    .no-clipboard {
      cursor: not-allowed !important;
    }
  `;
  
  document.head.appendChild(style);
}

/**
 * Show a toast/notification when copy/paste is attempted
 * You can integrate this with your notification system
 */
export function showClipboardBlockedNotification() {
  // Optional: Add a subtle notification
  // For now, just log to console
  console.log('Copy/Paste operations are disabled during testing');
}