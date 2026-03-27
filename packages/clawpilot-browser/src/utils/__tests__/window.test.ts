import { describe, expect, it, vi } from 'vitest';
import type { Page } from 'playwright';
import {
  createBackgroundWindowLaunchOptions,
  makeWindowUnobtrusive,
} from '@clawpilot/browser/utils/window.js';

describe('createBackgroundWindowLaunchOptions', () => {
  it('creates a headed tiny offscreen browser configuration', () => {
    const options = createBackgroundWindowLaunchOptions();

    expect(options.channel).toBe('chrome');
    expect(options.headless).toBe(false);
    expect(options.viewport).toBeNull();
    expect(options.args).toEqual(
      expect.arrayContaining(['--window-size=480,320', '--window-position=3000,3000']),
    );
  });
});

describe('makeWindowUnobtrusive', () => {
  it('minimizes the Chromium window through CDP when available', async () => {
    const send = vi
      .fn<(method: string, params?: unknown) => Promise<unknown>>()
      .mockResolvedValueOnce({ windowId: 7 })
      .mockResolvedValueOnce({});
    const newCDPSession = vi.fn().mockResolvedValue({ send });
    const page = {
      context: () => ({ newCDPSession }),
    } as unknown as Page;

    await makeWindowUnobtrusive(page);

    expect(newCDPSession).toHaveBeenCalledWith(page);
    expect(send).toHaveBeenNthCalledWith(1, 'Browser.getWindowForTarget');
    expect(send).toHaveBeenNthCalledWith(2, 'Browser.setWindowBounds', {
      windowId: 7,
      bounds: { windowState: 'minimized' },
    });
  });

  it('swallows CDP failures and falls back to launch args only', async () => {
    const newCDPSession = vi.fn().mockRejectedValue(new Error('cdp unavailable'));
    const page = {
      context: () => ({ newCDPSession }),
    } as unknown as Page;

    await expect(makeWindowUnobtrusive(page)).resolves.toBeUndefined();
  });
});
