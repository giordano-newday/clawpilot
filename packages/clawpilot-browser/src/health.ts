import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { success, error, type CLIResponse } from "./utils/output.js";

const execFileAsync = promisify(execFile);

export interface InstallCheckData {
  playwright_installed: boolean;
  browser_binary: string | null;
  browser_version: string | null;
}

export interface SessionCheckData {
  session_exists: boolean;
  session_valid: boolean;
  session_age_hours: number | null;
}

export interface FullHealthData extends InstallCheckData, SessionCheckData {
  teams_accessible: boolean | null;
  outlook_accessible: boolean | null;
}

const DEFAULT_STATE_DIR = `${process.env.HOME}/.clawpilot/state/browser-state`;

export function getStateDir(): string {
  return process.env.CLAWPILOT_BROWSER_STATE_DIR || DEFAULT_STATE_DIR;
}

export async function checkInstall(): Promise<CLIResponse<InstallCheckData>> {
  // Check if playwright can be imported
  let playwrightInstalled = false;
  try {
    await import("playwright");
    playwrightInstalled = true;
  } catch {
    return error(
      "not_installed",
      "Playwright is not installed. Run: npm install playwright && npx playwright install chromium",
    );
  }

  // Check for chromium binary
  let browserBinary: string | null = null;
  let browserVersion: string | null = null;

  try {
    const playwright = await import("playwright");
    browserBinary = playwright.chromium.executablePath();
    if (browserBinary && existsSync(browserBinary)) {
      try {
        const { stdout: versionOutput } = await execFileAsync(browserBinary, [
          "--version",
        ]);
        browserVersion = versionOutput.trim();
      } catch {
        browserVersion = "unknown";
      }
    } else {
      browserBinary = null;
    }
  } catch {
    browserBinary = null;
  }

  if (!browserBinary) {
    return error(
      "browser_not_installed",
      "Playwright is installed but Chromium browser binary is missing. Run: npx playwright install chromium",
    );
  }

  return success<InstallCheckData>({
    playwright_installed: playwrightInstalled,
    browser_binary: browserBinary,
    browser_version: browserVersion,
  });
}
