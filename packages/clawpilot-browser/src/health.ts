import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readdirSync, statSync } from "node:fs";
import { success, error, type CLIResponse, type ErrorResponse } from "./utils/output.js";

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

export async function checkSession(stateDir?: string): Promise<CLIResponse<SessionCheckData>> {
  const dir = stateDir || getStateDir();

  if (!existsSync(dir)) {
    return success<SessionCheckData>({
      session_exists: false,
      session_valid: false,
      session_age_hours: null,
    });
  }

  const files = readdirSync(dir);
  if (files.length === 0) {
    return success<SessionCheckData>({
      session_exists: false,
      session_valid: false,
      session_age_hours: null,
    });
  }

  // Session directory exists and has files — calculate age
  const stat = statSync(dir);
  const ageMs = Date.now() - stat.mtimeMs;
  const ageHours = Math.round((ageMs / (1000 * 60 * 60)) * 100) / 100;

  return success<SessionCheckData>({
    session_exists: true,
    session_valid: true, // Optimistic — full check does real browser validation
    session_age_hours: ageHours,
  });
}

export async function fullHealthCheck(): Promise<CLIResponse<FullHealthData>> {
  const installResult = await checkInstall();
  if (!installResult.ok) {
    return error(
      (installResult as ErrorResponse).error,
      (installResult as ErrorResponse).message,
    );
  }

  const sessionResult = await checkSession();
  const sessionData: SessionCheckData =
    sessionResult.ok && sessionResult.data
      ? sessionResult.data
      : { session_exists: false, session_valid: false, session_age_hours: null };

  return success<FullHealthData>({
    ...installResult.data!,
    ...sessionData,
    teams_accessible: null,
    outlook_accessible: null,
  });
}
