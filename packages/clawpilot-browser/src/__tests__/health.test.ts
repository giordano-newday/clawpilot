import { describe, it, expect, vi } from 'vitest';
import { checkInstall, checkSession } from '../health.js';

describe('checkSession', () => {
  it('returns session_exists:false when state dir does not exist', async () => {
    const result = await checkSession('/tmp/clawpilot-test-nonexistent-' + Date.now());
    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.session_exists).toBe(false);
      expect(result.data.session_valid).toBe(false);
    }
  });

  it('returns session_exists:false when state dir is empty', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(`${tmpdir()}/clawpilot-test-`);
    try {
      const result = await checkSession(dir);
      expect(result.ok).toBe(true);
      if (result.ok && result.data) {
        expect(result.data.session_exists).toBe(false);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns session_exists:true when state dir has files', async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(`${tmpdir()}/clawpilot-test-`);
    writeFileSync(join(dir, 'cookie-data'), 'test');
    try {
      const result = await checkSession(dir);
      expect(result.ok).toBe(true);
      if (result.ok && result.data) {
        expect(result.data.session_exists).toBe(true);
        expect(result.data.session_age_hours).toBeTypeOf('number');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns stored session expiry metadata when present', async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(`${tmpdir()}/clawpilot-test-`);
    writeFileSync(join(dir, 'cookie-data'), 'test');
    writeFileSync(
      join(dir, 'session-metadata.json'),
      JSON.stringify({
        createdAt: '2026-03-17T12:00:00.000Z',
        updatedAt: '2026-03-17T12:30:00.000Z',
        expiresAt: '2026-03-18T09:00:00.000Z',
        expirySource: 'cookie-expiry',
        expiryConfidence: 'high',
        lastValidatedAt: '2026-03-17T12:45:00.000Z',
        lastValidatedResult: 'valid',
      }),
    );
    try {
      const result = await checkSession(dir);
      expect(result.ok).toBe(true);
      if (result.ok && result.data) {
        expect(result.data.session_expires_at).toBe('2026-03-18T09:00:00.000Z');
        expect(result.data.session_expiry_source).toBe('cookie-expiry');
        expect(result.data.session_expiry_confidence).toBe('high');
        expect(result.data.last_validated_at).toBe('2026-03-17T12:45:00.000Z');
        expect(result.data.last_validated_result).toBe('valid');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('uses stored session creation time for session age when metadata exists', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-17T15:00:00.000Z'));

    const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(`${tmpdir()}/clawpilot-test-`);
    writeFileSync(join(dir, 'cookie-data'), 'test');
    writeFileSync(
      join(dir, 'session-metadata.json'),
      JSON.stringify({
        createdAt: '2026-03-17T12:00:00.000Z',
        updatedAt: '2026-03-17T14:30:00.000Z',
        expiresAt: '2026-03-18T09:00:00.000Z',
        expirySource: 'cookie-expiry',
        expiryConfidence: 'high',
        lastValidatedAt: '2026-03-17T14:30:00.000Z',
        lastValidatedResult: 'valid',
      }),
    );

    try {
      const result = await checkSession(dir);
      expect(result.ok).toBe(true);
      if (result.ok && result.data) {
        expect(result.data.session_age_hours).toBe(3);
      }
    } finally {
      vi.useRealTimers();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('checkInstall', () => {
  it('returns install info when playwright is available', async () => {
    const result = await checkInstall();
    // Playwright IS in our dependencies, so this should succeed
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty('playwright_installed');
      expect(result.data).toHaveProperty('browser_binary');
    }
  });
});
