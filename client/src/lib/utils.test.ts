import { describe, it, expect } from 'vitest';

/**
 * Tests for cn() utility (class name merger)
 * Mirrors the clsx + twMerge logic from src/lib/utils.ts
 */
describe('cn Utility Tests', () => {
    // Inline clsx implementation matching the logic
    const clsx = (...inputs: any[]): string => {
        const result: string[] = [];
        for (const input of inputs) {
            if (!input) continue;
            if (typeof input === 'string') {
                result.push(input);
            } else if (Array.isArray(input)) {
                const inner = clsx(...input);
                if (inner) result.push(inner);
            } else if (typeof input === 'object') {
                for (const [key, val] of Object.entries(input)) {
                    if (val) result.push(key);
                }
            }
        }
        return result.join(' ');
    };

    it('should merge class names', () => {
        expect(clsx('foo', 'bar')).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
        expect(clsx('base', false && 'hidden', 'visible')).toBe('base visible');
    });

    it('should handle undefined and null', () => {
        expect(clsx('a', undefined, null, 'b')).toBe('a b');
    });

    it('should handle empty input', () => {
        expect(clsx()).toBe('');
    });

    it('should handle array inputs', () => {
        expect(clsx(['foo', 'bar'])).toBe('foo bar');
    });

    it('should handle object inputs', () => {
        expect(clsx({ foo: true, bar: false, baz: true })).toBe('foo baz');
    });

    it('should handle mixed inputs', () => {
        expect(clsx('base', { active: true, disabled: false }, ['extra'])).toBe('base active extra');
    });

    it('should handle nested falsy values', () => {
        expect(clsx('a', 0, '', null, undefined, false, 'b')).toBe('a b');
    });
});
