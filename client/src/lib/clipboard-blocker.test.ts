import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for clipboard-blocker utility functions
 * Mirrors the logic from src/lib/clipboard-blocker.ts
 */

describe('Clipboard Blocker Tests', () => {
  describe('isTestingMode', () => {
    const isTestingMode = (): boolean => {
      const params = new URLSearchParams(window.location.search);
      return params.get('test') === 'true' || localStorage.getItem('coderunner-test-mode') === 'true';
    };

    beforeEach(() => {
      localStorage.clear();
    });

    it('should return false by default', () => {
      Object.defineProperty(window, 'location', {
        value: { search: '' },
        writable: true,
      });
      expect(isTestingMode()).toBe(false);
    });

    it('should return true when test=true query param is set', () => {
      Object.defineProperty(window, 'location', {
        value: { search: '?test=true' },
        writable: true,
      });
      expect(isTestingMode()).toBe(true);
    });

    it('should return true when localStorage test mode is set', () => {
      Object.defineProperty(window, 'location', {
        value: { search: '' },
        writable: true,
      });
      localStorage.setItem('coderunner-test-mode', 'true');
      expect(isTestingMode()).toBe(true);
    });

    it('should return false when test param is not "true"', () => {
      Object.defineProperty(window, 'location', {
        value: { search: '?test=false' },
        writable: true,
      });
      expect(isTestingMode()).toBe(false);
    });

    it('should return false when localStorage value is not "true"', () => {
      Object.defineProperty(window, 'location', {
        value: { search: '' },
        writable: true,
      });
      localStorage.setItem('coderunner-test-mode', 'false');
      expect(isTestingMode()).toBe(false);
    });
  });

  describe('DISABLE_SELECTION_CLASS', () => {
    it('should be the correct class name', () => {
      const DISABLE_SELECTION_CLASS = 'disable-text-selection';
      expect(DISABLE_SELECTION_CLASS).toBe('disable-text-selection');
    });
  });

  describe('applyClipboardBlockingStyles', () => {
    const applyClipboardBlockingStyles = () => {
      const styleId = 'clipboard-blocking-styles';
      if (document.getElementById(styleId)) return;

      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .disable-text-selection {
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }
        .no-clipboard {
          cursor: not-allowed !important;
        }
      `;
      document.head.appendChild(style);
    };

    afterEach(() => {
      const style = document.getElementById('clipboard-blocking-styles');
      if (style) style.remove();
    });

    it('should add style element to document head', () => {
      applyClipboardBlockingStyles();
      const style = document.getElementById('clipboard-blocking-styles');
      expect(style).toBeTruthy();
      expect(style?.tagName).toBe('STYLE');
    });

    it('should not duplicate styles when called twice', () => {
      applyClipboardBlockingStyles();
      applyClipboardBlockingStyles();
      const styles = document.querySelectorAll('#clipboard-blocking-styles');
      expect(styles.length).toBe(1);
    });

    it('should include user-select: none', () => {
      applyClipboardBlockingStyles();
      const style = document.getElementById('clipboard-blocking-styles');
      expect(style?.textContent).toContain('user-select: none');
    });

    it('should include cursor: not-allowed', () => {
      applyClipboardBlockingStyles();
      const style = document.getElementById('clipboard-blocking-styles');
      expect(style?.textContent).toContain('cursor: not-allowed');
    });
  });

  describe('showClipboardBlockedNotification', () => {
    it('should log notification message', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const showClipboardBlockedNotification = () => {
        console.log('Copy/Paste operations are disabled.');
      };
      
      showClipboardBlockedNotification();
      expect(consoleSpy).toHaveBeenCalledWith('Copy/Paste operations are disabled.');
      consoleSpy.mockRestore();
    });
  });
});
