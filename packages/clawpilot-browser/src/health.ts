import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readdirSync, statSync } from 'node:fs';
import {
  isPersistedSessionStateFile,
  readSessionMetadata,
  toSessionMetadataSummary,
} from '@clawpilot/browser/session-metadata.js';
import {
  error,
  success,
  type CLIResponse,
  type ErrorResponse,
} from '@clawpilot/browser/utils/output.js';
import { DEFAULT_STATE_DIR } from '@clawpilot/browser/utils/paths.js';

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
  session_expires_at: string | null;
  session_expiry_source: string | null;
  session_expiry_confidence: string | null;
  last_validated_at: string | null;
  last_validated_result: string | null;
}

export interface FullHealthData extends InstallCheckData, SessionCheckData {
  teams_accessible: boolean | null;
  outlook_accessible: boolean | null;
}

export function getStateDir(): string {
  return process.env.CLAWPILOT_BROWSER_STATE_DIR || DEFAULT_STATE_DIR;
}

export async function checkInstall(): Promise<CLIResponse<InstallCheckData>> {
  // Check if playwright can be imported
  try {
    await import('playwright');
  } catch {
    return error(
      'not_installed',
      'Playwright is not installed. Run: npm install playwright && npx playwright install chromium',
    );
  }

  // Check for chromium binary
  let browserBinary: string | null;
  let browserVersion: string | null = null;

  try {
    const playwright = await import('playwright');
    browserBinary = playwright.chromium.executablePath();
    if (browserBinary && existsSync(browserBinary)) {
      try {
        const { stdout: versionOutput } = await execFileAsync(browserBinary, ['--version']);
        browserVersion = versionOutput.trim();
      } catch {
        browserVersion = 'unknown';
      }
    } else {
      browserBinary = null;
    }
  } catch {
    browserBinary = null;
  }

  if (!browserBinary) {
    return error(
      'browser_not_installed',
      'Playwright is installed but Chromium browser binary is missing. Run: npx playwright install chromium',
    );
  }

  return success<InstallCheckData>({
    playwright_installed: true,
    browser_binary: browserBinary,
    browser_version: browserVersion,
  });
}

export async function checkSession(stateDir?: string): Promise<CLIResponse<SessionCheckData>> {
  const dir = stateDir || getStateDir();

  try {
    const metadata = readSessionMetadata(dir);
    const metadataSummary = toSessionMetadataSummary(metadata);
    const files = readdirSync(dir).filter(isPersistedSessionStateFile);
    if (files.length === 0) {
      return success<SessionCheckData>({
        session_exists: false,
        session_valid: false,
        session_age_hours: null,
        session_expires_at: null,
        session_expiry_source: null,
        session_expiry_confidence: null,
        last_validated_at: null,
        last_validated_result: null,
      });
    }

    // Session directory exists and has files — calculate age
    const stat = statSync(dir);
    const sessionCreatedAtMs = metadata?.createdAt ? Date.parse(metadata.createdAt) : NaN;
    const ageMs = Number.isFinite(sessionCreatedAtMs)
      ? Date.now() - sessionCreatedAtMs
      : Date.now() - stat.mtimeMs;
    const ageHours = Math.round((ageMs / (1000 * 60 * 60)) * 100) / 100;

    return success<SessionCheckData>({
      session_exists: true,
      session_valid: true, // Optimistic — full check does real browser validation
      session_age_hours: ageHours,
      session_expires_at: metadataSummary.expiresAt,
      session_expiry_source: metadataSummary.expirySource,
      session_expiry_confidence: metadataSummary.expiryConfidence,
      last_validated_at: metadataSummary.lastValidatedAt,
      last_validated_result: metadataSummary.lastValidatedResult,
    });
  } catch {
    return success<SessionCheckData>({
      session_exists: false,
      session_valid: false,
      session_age_hours: null,
      session_expires_at: null,
      session_expiry_source: null,
      session_expiry_confidence: null,
      last_validated_at: null,
      last_validated_result: null,
    });
  }
}

export async function fullHealthCheck(): Promise<CLIResponse<FullHealthData>> {
  const installResult = await checkInstall();
  if (!installResult.ok) {
    return error((installResult as ErrorResponse).error, (installResult as ErrorResponse).message);
  }

  if (!installResult.data) {
    return error('unexpected_error', 'Install check returned no data');
  }

  const sessionResult = await checkSession();
  const sessionData: SessionCheckData =
    sessionResult.ok && sessionResult.data
      ? sessionResult.data
      : {
          session_exists: false,
          session_valid: false,
          session_age_hours: null,
          session_expires_at: null,
          session_expiry_source: null,
          session_expiry_confidence: null,
          last_validated_at: null,
          last_validated_result: null,
        };

  return success<FullHealthData>({
    ...installResult.data,
    ...sessionData,
    teams_accessible: null,
    outlook_accessible: null,
  });
}
