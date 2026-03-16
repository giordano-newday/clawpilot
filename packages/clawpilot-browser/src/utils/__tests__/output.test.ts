import { describe, it, expect, vi } from 'vitest';
import { success, error, formatOutput, output } from '../output.js';

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

  describe('output', () => {
    it('prints success response and sets exitCode to 0', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const prev = process.exitCode;
      output(success({ status: 'ok' }));
      expect(spy).toHaveBeenCalledWith(formatOutput(success({ status: 'ok' })));
      expect(process.exitCode).toBe(0);
      spy.mockRestore();
      process.exitCode = prev;
    });

    it('prints error response and sets exitCode to 1', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const prev = process.exitCode;
      output(error('fail', 'something broke'));
      expect(spy).toHaveBeenCalledWith(formatOutput(error('fail', 'something broke')));
      expect(process.exitCode).toBe(1);
      spy.mockRestore();
      process.exitCode = prev;
    });
  });
});
