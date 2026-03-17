import { describe, expect, it } from 'vitest';
import { buildSessionMetadataFromCookies } from '@clawpilot/browser/session-metadata.js';

describe('buildSessionMetadataFromCookies', () => {
  it('stores the earliest relevant finite cookie expiry conservatively', () => {
    const metadata = buildSessionMetadataFromCookies(
      [
        {
          name: 'ESTSAUTHPERSISTENT',
          domain: '.login.microsoftonline.com',
          expires: 1_763_734_800,
        },
        {
          name: 'rtFa',
          domain: '.office.com',
          expires: 1_763_738_400,
        },
        {
          name: 'session-cookie',
          domain: '.teams.microsoft.com',
          expires: -1,
        },
        {
          name: 'irrelevant',
          domain: '.example.com',
          expires: 1_999_999_999,
        },
      ],
      {
        createdAt: '2026-03-17T12:00:00.000Z',
        now: '2026-03-17T12:00:00.000Z',
      },
    );

    expect(metadata).toMatchObject({
      createdAt: '2026-03-17T12:00:00.000Z',
      updatedAt: '2026-03-17T12:00:00.000Z',
      expiresAt: '2025-11-21T14:20:00.000Z',
      expirySource: 'cookie-expiry',
      expiryConfidence: 'medium',
      lastValidatedAt: null,
      lastValidatedResult: 'unknown',
    });
  });

  it('stores unknown expiry when only relevant session cookies exist', () => {
    const metadata = buildSessionMetadataFromCookies(
      [
        {
          name: 'session-cookie',
          domain: '.teams.microsoft.com',
          expires: -1,
        },
      ],
      {
        createdAt: '2026-03-17T12:00:00.000Z',
        now: '2026-03-17T12:30:00.000Z',
      },
    );

    expect(metadata).toMatchObject({
      createdAt: '2026-03-17T12:00:00.000Z',
      updatedAt: '2026-03-17T12:30:00.000Z',
      expiresAt: null,
      expirySource: 'session-cookie-only',
      expiryConfidence: 'unknown',
      lastValidatedAt: null,
      lastValidatedResult: 'unknown',
    });
  });
});
