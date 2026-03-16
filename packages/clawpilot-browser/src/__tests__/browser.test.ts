import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BrowserManager } from '../browser.js';

describe('BrowserManager', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('reports hasSession=false for nonexistent state dir', () => {
    const manager = new BrowserManager('/tmp/clawpilot-nonexistent-' + Date.now());
    expect(manager.hasSession()).toBe(false);
  });

  it('reports hasSession=false for empty state dir', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'clawpilot-test-'));
    const manager = new BrowserManager(tempDir);
    expect(manager.hasSession()).toBe(false);
  });

  it('reports hasSession=true when state dir has files', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'clawpilot-test-'));
    writeFileSync(join(tempDir, 'cookies.json'), '{}');
    const manager = new BrowserManager(tempDir);
    expect(manager.hasSession()).toBe(true);
  });

  it('clearSession removes the state directory', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'clawpilot-test-'));
    writeFileSync(join(tempDir, 'cookies.json'), '{}');
    const manager = new BrowserManager(tempDir);
    expect(manager.hasSession()).toBe(true);
    manager.clearSession();
    expect(manager.hasSession()).toBe(false);
    tempDir = undefined; // already cleaned up
  });

  it('clearSession is safe on nonexistent dir', () => {
    const manager = new BrowserManager('/tmp/clawpilot-nonexistent-' + Date.now());
    expect(() => manager.clearSession()).not.toThrow();
  });
});
