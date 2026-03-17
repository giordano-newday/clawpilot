import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import type { BrowserContext } from 'playwright';
import {
  buildSessionMetadataFromCookies,
  isPersistedSessionStateFile,
  readSessionMetadata,
  toSessionMetadataSummary,
  withValidationResult,
  writeSessionMetadata,
  type SessionMetadataSummary,
} from '@clawpilot/browser/session-metadata.js';
import { DEFAULT_STATE_DIR } from '@clawpilot/browser/utils/paths.js';
import {
  createBackgroundWindowLaunchOptions,
  makeWindowUnobtrusive,
} from '@clawpilot/browser/utils/window.js';
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/** URL patterns that indicate successful Teams authentication */
const TEAMS_AUTHENTICATED_PATTERNS = [
  /teams\.microsoft\.com\/_#/,
  /teams\.microsoft\.com\/v2/,
  /teams\.microsoft\.com\/\?/,
];

/** URL patterns that indicate a login page (session expired) */
const LOGIN_PAGE_PATTERNS = [/login\.microsoftonline\.com/, /login\.live\.com/, /adfs\./];

export class BrowserManager {
  readonly stateDir: string;

  constructor(stateDir?: string) {
    this.stateDir = stateDir || process.env.CLAWPILOT_BROWSER_STATE_DIR || DEFAULT_STATE_DIR;
  }

  /** Check if a saved session exists on disk */
  hasSession(): boolean {
    try {
      const files = readdirSync(this.stateDir).filter(isPersistedSessionStateFile);
      return files.length > 0;
    } catch {
      return false;
    }
  }

  getSessionMetadata(): SessionMetadataSummary {
    return toSessionMetadataSummary(readSessionMetadata(this.stateDir));
  }

  /** Clear the saved session */
  clearSession(): void {
    if (existsSync(this.stateDir)) {
      rmSync(this.stateDir, { recursive: true, force: true });
    }
  }

  /** Launch a headed browser for manual login */
  async login(): Promise<{ success: boolean; message: string }> {
    mkdirSync(this.stateDir, { recursive: true, mode: 0o700 });

    const { chromium } = await import('playwright');

    const context = await chromium.launchPersistentContext(this.stateDir, {
      headless: false,
      viewport: { width: 1280, height: 800 },
    });

    try {
      const page = context.pages()[0] || (await context.newPage());
      await page.goto('https://teams.microsoft.com');
      await page.waitForURL((url) => TEAMS_AUTHENTICATED_PATTERNS.some((p) => p.test(url.href)), {
        timeout: LOGIN_TIMEOUT_MS,
      });
      const existingMetadata = readSessionMetadata(this.stateDir);
      const metadata = buildSessionMetadataFromCookies(await context.cookies(), {
        createdAt: existingMetadata?.createdAt,
      });
      writeSessionMetadata(this.stateDir, metadata);
      return { success: true, message: 'Logged in successfully. Session saved.' };
    } catch {
      return { success: false, message: 'Login timed out after 5 minutes.' };
    } finally {
      await context.close();
    }
  }

  /** Validate current session by launching headless and checking navigation */
  async validateSession(): Promise<{
    valid: boolean;
    teamsAccessible: boolean;
    outlookAccessible: boolean;
    expiresAt: string | null;
    expirySource: string | null;
    expiryConfidence: string | null;
    lastValidatedAt: string | null;
    lastValidatedResult: string | null;
  }> {
    if (!this.hasSession()) {
      return {
        valid: false,
        teamsAccessible: false,
        outlookAccessible: false,
        ...this.getSessionMetadata(),
      };
    }

    const { chromium } = await import('playwright');

    let context: BrowserContext | null = null;
    try {
      context = await chromium.launchPersistentContext(
        this.stateDir,
        createBackgroundWindowLaunchOptions(),
      );

      const page = context.pages()[0] || (await context.newPage());
      await makeWindowUnobtrusive(page);

      let teamsOk = false;
      try {
        await page.goto('https://teams.microsoft.com', { timeout: 15000 });
        const url = page.url();
        teamsOk = !LOGIN_PAGE_PATTERNS.some((p) => p.test(url));
      } catch {
        teamsOk = false;
      }

      let outlookOk = false;
      try {
        await page.goto('https://outlook.office365.com', { timeout: 15000 });
        const url = page.url();
        outlookOk = !LOGIN_PAGE_PATTERNS.some((p) => p.test(url));
      } catch {
        outlookOk = false;
      }

      const existingMetadata = readSessionMetadata(this.stateDir);
      const metadata = withValidationResult(
        buildSessionMetadataFromCookies(await context.cookies(), {
          createdAt: existingMetadata?.createdAt,
        }),
        {
          valid: teamsOk || outlookOk,
        },
      );
      writeSessionMetadata(this.stateDir, metadata);
      await context.close();
      return {
        valid: teamsOk || outlookOk,
        teamsAccessible: teamsOk,
        outlookAccessible: outlookOk,
        ...toSessionMetadataSummary(metadata),
      };
    } catch {
      if (context) await context.close();
      return {
        valid: false,
        teamsAccessible: false,
        outlookAccessible: false,
        ...this.getSessionMetadata(),
      };
    }
  }
}
