import { describe, it, expect } from 'vitest';
import { success, error, formatOutput } from '../output.js';

describe('output helpers', () => {
  describe('success', () => {
    it('creates a success response with data', () => {
      const result = success({ greeting: 'hello' });
      expect(result).toEqual({ ok: true, data: { greeting: 'hello' } });
    });

    it('creates a success response without data', () => {
      const result = success();
      expect(result).toEqual({ ok: true });
    });
  });

  describe('error', () => {
    it('creates an error response with type and message', () => {
      const result = error('not_installed', 'Playwright is not installed');
      expect(result).toEqual({
        ok: false,
        error: 'not_installed',
        message: 'Playwright is not installed',
      });
    });
  });

  describe('formatOutput', () => {
    it('serialises response to pretty JSON', () => {
      const result = formatOutput(success({ a: 1 }));
      expect(result).toBe(JSON.stringify({ ok: true, data: { a: 1 } }, null, 2));
    });
  });
});
