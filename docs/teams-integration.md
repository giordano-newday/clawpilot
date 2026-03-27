# Teams integration

This document explains how the current Teams integration in `@clawpilot/browser` works.

## What the integration does today

The implemented Teams commands are:

- `clawpilot-browser auth login`
- `clawpilot-browser auth status --validate`
- `clawpilot-browser teams list`
- `clawpilot-browser teams read "<id>"`

`teams list` returns recent chats and channels. `teams read` reads messages for a specific chat or channel id returned by `teams list`.

## High-level runtime model

The integration uses both a browser session and direct Teams HTTP APIs.

The browser is used to:

- launch a persistent signed-in Microsoft 365 session
- reuse stored cookies and browser state from `~/.clawpilot/state/browser-state/`
- inspect Teams web app state
- extract MSAL access tokens from Teams local storage when available

The direct APIs are used to:

- bootstrap the current Teams region and partition
- list chats
- fetch messages for a chat

This hybrid approach keeps login interactive and reliable while making reads much faster than full DOM scraping.

## Browser and session handling

Manual sign-in happens through `auth login`.

- It launches a visible headed browser.
- The user completes Microsoft login and MFA manually.
- The session is saved in `~/.clawpilot/state/browser-state/`.
- A login is considered successful when Teams lands on an authenticated app URL, including both `teams.microsoft.com` and `teams.cloud.microsoft`.

Non-login commands reuse the saved browser state through Playwright persistent contexts. The shared launch helper now uses Playwright's `channel: 'chrome'` so the automation runs against installed Google Chrome instead of Chrome for Testing. That matters because Teams proved more reliable in full Chrome on this machine.

For background work, the window is launched small and offscreen, then minimized where Chromium allows it. `auth login` stays visibly interactive by design.

## Primary data flow

The main implementation lives in `packages/clawpilot-browser/src/teams.ts`.

### 1. Load the Teams shell

`listTeams()` and `readTeams()` open `https://teams.cloud.microsoft`, then fall back to `https://teams.microsoft.com/v2/` if needed.

The code waits briefly for the app shell to render before deciding whether the page is healthy, needs recovery, or requires interactive auth.

### 2. Confirm auth readiness

The runtime accepts both major Teams web origins:

- `https://teams.microsoft.com`
- `https://teams.cloud.microsoft`

If the page is already on the cloud app origin, that is treated as a valid authenticated Teams surface. This avoids forcing unnecessary login loops when Teams has already redirected away from the legacy host.

If the page is not ready, the code can make the window visible and trigger interactive login inside Teams.

### 3. Extract Teams access tokens from MSAL cache

Once the Teams app is loaded, the integration reads local storage and looks for MSAL access token entries. It needs three token audiences:

- `https://api.spaces.skype.com`
- `https://chatsvcagg.teams.microsoft.com`
- `https://ic3.teams.office.com`

If all three are present, the integration uses the direct API path.

### 4. Bootstrap Teams routing information

The first API call is:

- `POST https://teams.microsoft.com/api/authsvc/v1.0/authz`

This returns routing metadata such as the active region and partition, plus a Skype token in the response payload.

### 5. Read chats and messages

After bootstrap:

- `teams list` calls `GET https://teams.cloud.microsoft/api/csa/{region}/api/v1/teams/users/me/groupchats?skipMeetingChats=true`
- `teams read` calls `GET https://teams.cloud.microsoft/api/chatsvc/{region}/v1/users/ME/conversations/{id}/messages?...`

The direct responses are normalized into the CLI's output shapes before being printed as formatted text or JSON.

## Fallback behavior

If token extraction fails or direct API calls fail, the integration falls back to browser-side DOM collection.

That fallback:

- scans the Teams UI for chat and channel nodes
- normalizes links and dataset attributes into stable ids
- opens a target chat when needed
- extracts visible message nodes from the page

This keeps the commands usable even when the token-based fast path is unavailable.

## Error handling and recovery

The code includes explicit handling for a few Teams-specific failure modes:

- login pages and expired sessions
- Teams retry-shell errors
- auth probe timeouts
- empty token cache
- direct API failures
- DOM fallback returning no usable chats or messages

Retry-shell detection is intentionally strict. It now only treats the page as broken when the page looks like the real Teams error shell, not merely because some unrelated `Retry` button exists somewhere in the app DOM.

## Validation and tests

Relevant code and tests:

- `packages/clawpilot-browser/src/teams.ts`
- `packages/clawpilot-browser/src/browser.ts`
- `packages/clawpilot-browser/src/utils/window.ts`
- `packages/clawpilot-browser/src/__tests__/teams.test.ts`
- `packages/clawpilot-browser/src/__tests__/browser.test.ts`
- `packages/clawpilot-browser/src/utils/__tests__/window.test.ts`

Manual verification helpers:

- `node packages/clawpilot-browser/dist/index.js auth status --validate`
- `node packages/clawpilot-browser/dist/index.js teams list --json`
- `node packages/clawpilot-browser/dist/index.js teams read "<id>" --json`
- `packages/clawpilot-browser/scripts/manual-test-teams.sh`

## Current design intent

The integration is optimized around a simple rule:

- use the browser to stay signed in and discover runtime auth state
- use direct Teams APIs when possible
- fall back to DOM interaction only when necessary

That gives the CLI a practical balance of reliability, speed, and debuggability.
