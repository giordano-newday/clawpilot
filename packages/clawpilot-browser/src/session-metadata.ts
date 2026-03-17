import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const SESSION_METADATA_FILE_NAME = 'session-metadata.json';

const RELEVANT_COOKIE_DOMAINS = [
  'microsoft.com',
  'microsoftonline.com',
  'office.com',
  'office365.com',
  'live.com',
  'sharepoint.com',
] as const;

export type SessionExpirySource = 'cookie-expiry' | 'session-cookie-only' | 'no-relevant-cookies';
export type SessionExpiryConfidence = 'high' | 'medium' | 'unknown';
export type SessionValidationResult = 'valid' | 'invalid' | 'unknown';

export interface SessionCookieLike {
  name?: string;
  domain?: string;
  expires?: number;
}

export interface SessionMetadata {
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  expirySource: SessionExpirySource;
  expiryConfidence: SessionExpiryConfidence;
  lastValidatedAt: string | null;
  lastValidatedResult: SessionValidationResult;
}

export interface SessionMetadataSummary {
  expiresAt: string | null;
  expirySource: SessionExpirySource | null;
  expiryConfidence: SessionExpiryConfidence | null;
  lastValidatedAt: string | null;
  lastValidatedResult: SessionValidationResult | null;
}

export function isPersistedSessionStateFile(fileName: string): boolean {
  return fileName !== SESSION_METADATA_FILE_NAME;
}

function isRelevantCookie(cookie: SessionCookieLike): boolean {
  const domain = (cookie.domain?.toLowerCase() ?? '').replace(/^\.+/, '');
  return RELEVANT_COOKIE_DOMAINS.some(
    (fragment) => domain === fragment || domain.endsWith(`.${fragment}`),
  );
}

function toIsoDate(expiresUnixSeconds: number): string {
  return new Date(expiresUnixSeconds * 1000).toISOString();
}

export function buildSessionMetadataFromCookies(
  cookies: SessionCookieLike[],
  options?: {
    createdAt?: string;
    now?: string;
  },
): SessionMetadata {
  const now = options?.now ?? new Date().toISOString();
  const createdAt = options?.createdAt ?? now;
  const relevantCookies = cookies.filter(isRelevantCookie);
  const finiteExpiries = relevantCookies
    .map((cookie) => cookie.expires)
    .filter(
      (expires): expires is number =>
        typeof expires === 'number' && Number.isFinite(expires) && expires > 0,
    );
  const hasSessionCookies = relevantCookies.some(
    (cookie) =>
      typeof cookie.expires !== 'number' || !Number.isFinite(cookie.expires) || cookie.expires <= 0,
  );

  if (finiteExpiries.length > 0) {
    return {
      createdAt,
      updatedAt: now,
      expiresAt: toIsoDate(Math.min(...finiteExpiries)),
      expirySource: 'cookie-expiry',
      expiryConfidence: hasSessionCookies ? 'medium' : 'high',
      lastValidatedAt: null,
      lastValidatedResult: 'unknown',
    };
  }

  return {
    createdAt,
    updatedAt: now,
    expiresAt: null,
    expirySource: hasSessionCookies ? 'session-cookie-only' : 'no-relevant-cookies',
    expiryConfidence: 'unknown',
    lastValidatedAt: null,
    lastValidatedResult: 'unknown',
  };
}

export function withValidationResult(
  metadata: SessionMetadata,
  options: {
    valid: boolean;
    now?: string;
  },
): SessionMetadata {
  const now = options.now ?? new Date().toISOString();
  return {
    ...metadata,
    updatedAt: now,
    lastValidatedAt: now,
    lastValidatedResult: options.valid ? 'valid' : 'invalid',
  };
}

export function getSessionMetadataPath(stateDir: string): string {
  return join(stateDir, SESSION_METADATA_FILE_NAME);
}

export function readSessionMetadata(stateDir: string): SessionMetadata | null {
  const path = getSessionMetadataPath(stateDir);
  if (!existsSync(path)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(path, 'utf8')) as SessionMetadata;
  } catch {
    return null;
  }
}

export function writeSessionMetadata(stateDir: string, metadata: SessionMetadata): void {
  writeFileSync(getSessionMetadataPath(stateDir), JSON.stringify(metadata, null, 2));
}

export function toSessionMetadataSummary(metadata: SessionMetadata | null): SessionMetadataSummary {
  return {
    expiresAt: metadata?.expiresAt ?? null,
    expirySource: metadata?.expirySource ?? null,
    expiryConfidence: metadata?.expiryConfidence ?? null,
    lastValidatedAt: metadata?.lastValidatedAt ?? null,
    lastValidatedResult: metadata?.lastValidatedResult ?? null,
  };
}
