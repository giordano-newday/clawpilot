import type { Page } from 'playwright';

const BACKGROUND_WINDOW_WIDTH = 480;
const BACKGROUND_WINDOW_HEIGHT = 320;
const BACKGROUND_WINDOW_X = 3000;
const BACKGROUND_WINDOW_Y = 3000;

export function createBackgroundWindowLaunchOptions(): {
  headless: false;
  viewport: null;
  args: string[];
} {
  return {
    headless: false,
    viewport: null,
    args: [
      `--window-size=${BACKGROUND_WINDOW_WIDTH},${BACKGROUND_WINDOW_HEIGHT}`,
      `--window-position=${BACKGROUND_WINDOW_X},${BACKGROUND_WINDOW_Y}`,
    ],
  };
}

export async function makeWindowUnobtrusive(page: Page): Promise<void> {
  try {
    const session = await page.context().newCDPSession(page);
    const window = (await session.send('Browser.getWindowForTarget')) as { windowId?: number };

    if (typeof window.windowId !== 'number') {
      return;
    }

    await session.send('Browser.setWindowBounds', {
      windowId: window.windowId,
      bounds: { windowState: 'minimized' },
    });
  } catch {
    // The offscreen/tiny launch args are already applied. Minimize is best-effort.
  }
}
