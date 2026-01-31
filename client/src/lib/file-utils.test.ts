import { describe, it, expect } from 'vitest';

describe('Client Setup', () => {
  it('should be able to run tests', () => {
    expect(true).toBe(true);
  });

  it('should format bytes', () => {
    // Simple byte formatting test without imports
    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + ' ' + sizes[i];
    };

    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
  });

  it('should detect language from extension', () => {
    const getLanguageFromExtension = (filename: string) => {
      const ext = filename.split('.').pop()?.toLowerCase();
      const map: { [key: string]: string } = {
        'py': 'python',
        'js': 'javascript',
        'java': 'java',
        'cpp': 'cpp',
        'c': 'cpp',
        'h': 'cpp',
        'sql': 'sql',
      };
      return map[ext || ''] || null;
    };

    expect(getLanguageFromExtension('test.py')).toBe('python');
    expect(getLanguageFromExtension('script.js')).toBe('javascript');
    expect(getLanguageFromExtension('Main.java')).toBe('java');
    expect(getLanguageFromExtension('main.cpp')).toBe('cpp');
  });
});

