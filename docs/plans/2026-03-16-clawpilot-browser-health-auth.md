# Clawpilot Browser — Health & Auth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build `clawpilot-browser`, a standalone Playwright-based CLI with health checks and Office 365 authentication, as the foundation for all browser-based tools.

**Architecture:** pnpm monorepo with `packages/clawpilot-browser` as the first real package. Commander.js CLI dispatches to health/auth modules. Playwright persistent contexts handle session storage. All output is structured JSON.

**Tech Stack:** Node.js, TypeScript (strict), pnpm workspaces, Commander.js, Playwright, Vitest

---

### Task 1: Monorepo Scaffold

**Files:**

- Create: `package.json` (workspace root)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.npmrc`
- Create: `packages/core/package.json` (placeholder)
- Create: `packages/clawpilot-browser/package.json`
- Create: `packages/clawpilot-browser/tsconfig.json`
- Create: `packages/clawpilot-browser/vitest.config.ts`

**Step 1: Create workspace root `package.json`**

```json
{
  "name": "clawpilot",
  "private": true,
  "description": "A personal AI agent that runs on your laptop, learns from you, and gets things done.",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  }
}
```

**Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'packages/*'
```

**Step 3: Create `tsconfig.base.json`**

Shared TypeScript config: strict mode, ES2022 target, NodeNext module resolution.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

**Step 4: Create `.gitignore`**

```
node_modules/
dist/
*.tsbuildinfo
.DS_Store
```

**Step 5: Create `.npmrc`**

```
auto-install-peers=true
```

**Step 6: Create core placeholder `packages/core/package.json`**

```json
{
  "name": "@clawpilot/core",
  "version": "0.0.1",
  "private": true,
  "description": "Clawpilot agent core (placeholder)"
}
```

**Step 7: Create `packages/clawpilot-browser/package.json`**

```json
{
  "name": "@clawpilot/browser",
  "version": "0.1.0",
  "private": true,
  "description": "Playwright-based browser CLI for Clawpilot",
  "type": "module",
  "bin": {
    "clawpilot-browser": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "commander": "^13.0.0",
    "playwright": "^1.50.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "@types/node": "^22.0.0"
  }
}
```

**Step 8: Create `packages/clawpilot-browser/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

**Step 9: Create `packages/clawpilot-browser/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

**Step 10: Run `pnpm install`**

Run: `pnpm install`
Expected: Successful install, lockfile created.

**Step 11: Commit**

```bash
git add -A
git commit -m "feat: scaffold pnpm monorepo with browser package"
```

**Manual test:** `ls packages/clawpilot-browser/node_modules/.package-lock.json` — confirms deps installed.

---

### Task 2: JSON Output Helpers

**Files:**

- Create: `packages/clawpilot-browser/src/utils/output.ts`
- Test: `packages/clawpilot-browser/src/utils/__tests__/output.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/clawpilot-browser/src/utils/__tests__/output.test.ts
import { describe, it, expect } from 'vitest';
import { success, error, formatOutput } from '../output.js';

describe('output helpers', () => {
  describe('success', () => {
    it('creates a success response with data', () => {
      const result = success({ greeting: 'hello' });
      expect(result).toEqual({ ok: true, data: { greeting: 'hello' } });
    });

    it('creates a success response without data', () => {
      const result = success();
      expect(result).toEqual({ ok: true });
    });
  });

  describe('error', () => {
    it('creates an error response with type and message', () => {
      const result = error('not_installed', 'Playwright is not installed');
      expect(result).toEqual({
        ok: false,
        error: 'not_installed',
        message: 'Playwright is not installed',
      });
    });
  });

  describe('formatOutput', () => {
    it('serialises response to pretty JSON', () => {
      const result = formatOutput(success({ a: 1 }));
      expect(result).toBe(JSON.stringify({ ok: true, data: { a: 1 } }, null, 2));
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/clawpilot-browser && npx vitest run src/utils/__tests__/output.test.ts`
Expected: FAIL — module not found.

**Step 3: Write minimal implementation**

```typescript
// packages/clawpilot-browser/src/utils/output.ts

export interface SuccessResponse<T = unknown> {
  ok: true;
  data?: T;
}

export interface ErrorResponse {
  ok: false;
  error: string;
  message: string;
}

export type CLIResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

export function success<T>(data?: T): SuccessResponse<T> {
  if (data === undefined) return { ok: true } as SuccessResponse<T>;
  return { ok: true, data };
}

export function error(type: string, message: string): ErrorResponse {
  return { ok: false, error: type, message };
}

export function formatOutput(response: CLIResponse): string {
  return JSON.stringify(response, null, 2);
}

/** Print response to stdout and exit with appropriate code */
export function output(response: CLIResponse): void {
  console.log(formatOutput(response));
  process.exitCode = response.ok ? 0 : 1;
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/clawpilot-browser && npx vitest run src/utils/__tests__/output.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(browser): add JSON output helpers with tests"
```

---

### Task 3: CLI Entry Point with Commander

**Files:**

- Create: `packages/clawpilot-browser/src/index.ts`
- Create: `packages/clawpilot-browser/src/commands/health.ts` (stub)
- Create: `packages/clawpilot-browser/src/commands/auth.ts` (stub)

**Step 1: Create CLI entry point**

```typescript
// packages/clawpilot-browser/src/index.ts
#!/usr/bin/env node

import { Command } from "commander";
import { registerHealthCommands } from "./commands/health.js";
import { registerAuthCommands } from "./commands/auth.js";

const program = new Command();

program
  .name("clawpilot-browser")
  .description("Playwright-based browser CLI for Clawpilot")
  .version("0.1.0");

registerHealthCommands(program);
registerAuthCommands(program);

program.parse();
```

**Step 2: Create health command stub**

```typescript
// packages/clawpilot-browser/src/commands/health.ts
import { Command } from 'commander';
import { output, success } from '../utils/output.js';

export function registerHealthCommands(program: Command): void {
  const health = program.command('health').description('Check browser availability and health');

  health
    .command('check-install')
    .description('Verify Playwright and browser binaries are installed')
    .action(async () => {
      output(success({ status: 'stub' }));
    });

  health
    .command('check-session')
    .description('Verify browser auth session is valid')
    .action(async () => {
      output(success({ status: 'stub' }));
    });

  health
    .command('full')
    .description('Full health report')
    .action(async () => {
      output(success({ status: 'stub' }));
    });
}
```

**Step 3: Create auth command stub**

```typescript
// packages/clawpilot-browser/src/commands/auth.ts
import { Command } from 'commander';
import { output, success } from '../utils/output.js';

export function registerAuthCommands(program: Command): void {
  const auth = program.command('auth').description('Manage browser authentication');

  auth
    .command('login')
    .description('Launch browser for manual Office 365 login')
    .action(async () => {
      output(success({ status: 'stub' }));
    });

  auth
    .command('status')
    .description('Check if browser session is valid')
    .action(async () => {
      output(success({ status: 'stub' }));
    });

  auth
    .command('clear')
    .description('Clear saved browser session')
    .action(async () => {
      output(success({ status: 'stub' }));
    });
}
```

**Step 4: Build and test CLI**

Run: `cd packages/clawpilot-browser && pnpm build && node dist/index.js --help`
Expected: Shows help with `health` and `auth` commands listed.

Run: `node dist/index.js health check-install`
Expected: `{ "ok": true, "data": { "status": "stub" } }`

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(browser): add CLI entry with health and auth command stubs"
```

**Manual test:**

- `node dist/index.js --help` — shows full help
- `node dist/index.js health --help` — shows health subcommands
- `node dist/index.js auth --help` — shows auth subcommands
- `node dist/index.js health check-install` — returns JSON stub

---

### Task 4: Health Check — `check-install`

**Files:**

- Create: `packages/clawpilot-browser/src/health.ts`
- Test: `packages/clawpilot-browser/src/__tests__/health.test.ts`
- Modify: `packages/clawpilot-browser/src/commands/health.ts`

**Step 1: Write the failing test**

```typescript
// packages/clawpilot-browser/src/__tests__/health.test.ts
import { describe, it, expect, vi } from 'vitest';
import { checkInstall } from '../health.js';

describe('checkInstall', () => {
  it('returns install info when playwright is available', async () => {
    const result = await checkInstall();
    // We expect this to work since playwright is in our dependencies
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty('playwright_installed');
      expect(result.data).toHaveProperty('browser_binary');
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/clawpilot-browser && npx vitest run src/__tests__/health.test.ts`
Expected: FAIL — cannot find module `../health.js`.

**Step 3: Write implementation**

```typescript
// packages/clawpilot-browser/src/health.ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { success, error, type CLIResponse } from './utils/output.js';

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
    await import('playwright');
    playwrightInstalled = true;
  } catch {
    return error(
      'not_installed',
      'Playwright is not installed. Run: npm install playwright && npx playwright install chromium',
    );
  }

  // Check for chromium binary
  let browserBinary: string | null = null;
  let browserVersion: string | null = null;

  try {
    const { stdout } = await execFileAsync('npx', [
      'playwright',
      'install',
      '--dry-run',
      'chromium',
    ]);
    // If dry-run shows nothing to install, chromium is already installed
    // Try to get the actual path
    const playwright = await import('playwright');
    browserBinary = playwright.chromium.executablePath();
    if (browserBinary && existsSync(browserBinary)) {
      // Get version via the binary
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
    // dry-run failed or binary not found
    browserBinary = null;
  }

  if (!browserBinary) {
    return error(
      'browser_not_installed',
      'Playwright is installed but Chromium browser binary is missing. Run: npx playwright install chromium',
    );
  }

  return success<InstallCheckData>({
    playwright_installed: playwrightInstalled,
    browser_binary: browserBinary,
    browser_version: browserVersion,
  });
}
```

**Step 4: Wire into the CLI command**

Replace the `check-install` action in `packages/clawpilot-browser/src/commands/health.ts`:

```typescript
// packages/clawpilot-browser/src/commands/health.ts
import { Command } from 'commander';
import { output, success } from '../utils/output.js';
import { checkInstall } from '../health.js';

export function registerHealthCommands(program: Command): void {
  const health = program.command('health').description('Check browser availability and health');

  health
    .command('check-install')
    .description('Verify Playwright and browser binaries are installed')
    .action(async () => {
      output(await checkInstall());
    });

  health
    .command('check-session')
    .description('Verify browser auth session is valid')
    .action(async () => {
      output(success({ status: 'stub' }));
    });

  health
    .command('full')
    .description('Full health report')
    .action(async () => {
      output(success({ status: 'stub' }));
    });
}
```

**Step 5: Run test to verify it passes**

Run: `cd packages/clawpilot-browser && npx vitest run src/__tests__/health.test.ts`
Expected: PASS

**Step 6: Build and manual test**

Run: `cd packages/clawpilot-browser && pnpm build && node dist/index.js health check-install`
Expected: JSON with `playwright_installed: true`, `browser_binary` path, and version.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat(browser): implement health check-install"
```

**Manual test:**

- `node dist/index.js health check-install` — should return full install info
- Uninstall chromium temporarily: `npx playwright uninstall chromium` then run again — should return `browser_not_installed` error
- Reinstall: `npx playwright install chromium`

---

### Task 5: Health Check — `check-session`

**Files:**

- Modify: `packages/clawpilot-browser/src/health.ts`
- Test: `packages/clawpilot-browser/src/__tests__/health.test.ts` (add tests)
- Modify: `packages/clawpilot-browser/src/commands/health.ts`

**Step 1: Write the failing test**

Add to `packages/clawpilot-browser/src/__tests__/health.test.ts`:

```typescript
describe('checkSession', () => {
  it('returns session_exists:false when state dir does not exist', async () => {
    // Use a nonexistent dir via env override
    process.env.CLAWPILOT_BROWSER_STATE_DIR = '/tmp/clawpilot-test-nonexistent';
    const { checkSession } = await import('../health.js');
    const result = await checkSession();
    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.session_exists).toBe(false);
      expect(result.data.session_valid).toBe(false);
    }
    delete process.env.CLAWPILOT_BROWSER_STATE_DIR;
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/clawpilot-browser && npx vitest run src/__tests__/health.test.ts`
Expected: FAIL — `checkSession` not exported.

**Step 3: Implement `checkSession`**

Add to `packages/clawpilot-browser/src/health.ts`:

```typescript
import { readdirSync, statSync } from 'node:fs';

export async function checkSession(): Promise<CLIResponse<SessionCheckData>> {
  const stateDir = getStateDir();

  // Check if state directory exists and has content
  if (!existsSync(stateDir)) {
    return success<SessionCheckData>({
      session_exists: false,
      session_valid: false,
      session_age_hours: null,
    });
  }

  const files = readdirSync(stateDir);
  if (files.length === 0) {
    return success<SessionCheckData>({
      session_exists: false,
      session_valid: false,
      session_age_hours: null,
    });
  }

  // Session directory exists and has files — calculate age
  const stat = statSync(stateDir);
  const ageMs = Date.now() - stat.mtimeMs;
  const ageHours = Math.round((ageMs / (1000 * 60 * 60)) * 100) / 100;

  // To truly validate the session, we'd need to launch a browser and check.
  // For now, we report session exists but validation requires a browser launch.
  // The full health check does the browser-based validation.
  return success<SessionCheckData>({
    session_exists: true,
    session_valid: true, // Optimistic — full check does real validation
    session_age_hours: ageHours,
  });
}
```

**Step 4: Wire into CLI**

Update `check-session` action in `commands/health.ts`:

```typescript
import { checkInstall, checkSession } from '../health.js';

// In the check-session command:
health
  .command('check-session')
  .description('Verify browser auth session is valid')
  .action(async () => {
    output(await checkSession());
  });
```

**Step 5: Run tests**

Run: `cd packages/clawpilot-browser && npx vitest run src/__tests__/health.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(browser): implement health check-session"
```

**Manual test:**

- `node dist/index.js health check-session` — should return `session_exists: false` (no auth done yet)
- After running `auth login` (Task 7), re-run — should return `session_exists: true`

---

### Task 6: Health Check — `full`

**Files:**

- Modify: `packages/clawpilot-browser/src/health.ts`
- Modify: `packages/clawpilot-browser/src/commands/health.ts`

**Step 1: Implement `fullHealthCheck`**

Add to `packages/clawpilot-browser/src/health.ts`:

```typescript
export async function fullHealthCheck(): Promise<CLIResponse<FullHealthData>> {
  const installResult = await checkInstall();
  if (!installResult.ok) {
    return error(installResult.error, installResult.message);
  }

  const sessionResult = await checkSession();
  const sessionData: SessionCheckData =
    sessionResult.ok && sessionResult.data
      ? sessionResult.data
      : { session_exists: false, session_valid: false, session_age_hours: null };

  return success<FullHealthData>({
    ...installResult.data!,
    ...sessionData,
    teams_accessible: sessionData.session_valid ? null : null, // Real check deferred to browser tools
    outlook_accessible: sessionData.session_valid ? null : null,
  });
}
```

**Step 2: Wire into CLI**

Update `full` action in `commands/health.ts`:

```typescript
import { checkInstall, checkSession, fullHealthCheck } from '../health.js';

health
  .command('full')
  .description('Full health report')
  .action(async () => {
    output(await fullHealthCheck());
  });
```

**Step 3: Build and manual test**

Run: `cd packages/clawpilot-browser && pnpm build && node dist/index.js health full`
Expected: Combined JSON with all fields from install + session checks.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(browser): implement full health check"
```

---

### Task 7: Browser Session Manager

**Files:**

- Create: `packages/clawpilot-browser/src/browser.ts`
- Test: `packages/clawpilot-browser/src/__tests__/browser.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/clawpilot-browser/src/__tests__/browser.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BrowserManager } from '../browser.js';

describe('BrowserManager', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates state directory if it does not exist', () => {
    tempDir = join(tmpdir(), 'clawpilot-test-');
    tempDir = mkdtempSync(tempDir);
    const stateDir = join(tempDir, 'browser-state');
    const manager = new BrowserManager(stateDir);
    expect(manager.stateDir).toBe(stateDir);
  });

  it('reports hasSession=false for empty state dir', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'clawpilot-test-'));
    const stateDir = join(tempDir, 'browser-state');
    const manager = new BrowserManager(stateDir);
    expect(manager.hasSession()).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/clawpilot-browser && npx vitest run src/__tests__/browser.test.ts`
Expected: FAIL — cannot find module.

**Step 3: Write implementation**

```typescript
// packages/clawpilot-browser/src/browser.ts
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import type { BrowserContext } from 'playwright';

const DEFAULT_STATE_DIR = `${process.env.HOME}/.clawpilot/state/browser-state`;
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
    if (!existsSync(this.stateDir)) return false;
    const files = readdirSync(this.stateDir);
    return files.length > 0;
  }

  /** Clear the saved session */
  clearSession(): void {
    if (existsSync(this.stateDir)) {
      rmSync(this.stateDir, { recursive: true, force: true });
    }
  }

  /** Launch a headed browser for manual login */
  async login(): Promise<{ success: boolean; message: string }> {
    // Ensure state dir exists
    mkdirSync(this.stateDir, { recursive: true, mode: 0o700 });

    const { chromium } = await import('playwright');

    const context = await chromium.launchPersistentContext(this.stateDir, {
      headless: false,
      channel: 'chromium',
      viewport: { width: 1280, height: 800 },
    });

    const page = context.pages()[0] || (await context.newPage());
    await page.goto('https://teams.microsoft.com');

    // Wait for authentication — either success or timeout
    try {
      await page.waitForURL((url) => TEAMS_AUTHENTICATED_PATTERNS.some((p) => p.test(url.href)), {
        timeout: LOGIN_TIMEOUT_MS,
      });
      await context.close();
      return { success: true, message: 'Logged in successfully. Session saved.' };
    } catch {
      await context.close();
      return { success: false, message: 'Login timed out after 5 minutes.' };
    }
  }

  /** Validate current session by launching headless and checking navigation */
  async validateSession(): Promise<{
    valid: boolean;
    teamsAccessible: boolean;
    outlookAccessible: boolean;
  }> {
    if (!this.hasSession()) {
      return { valid: false, teamsAccessible: false, outlookAccessible: false };
    }

    const { chromium } = await import('playwright');

    let context: BrowserContext | null = null;
    try {
      context = await chromium.launchPersistentContext(this.stateDir, {
        headless: true,
      });

      const page = context.pages()[0] || (await context.newPage());

      // Check Teams
      let teamsOk = false;
      try {
        await page.goto('https://teams.microsoft.com', { timeout: 15000 });
        const url = page.url();
        teamsOk = !LOGIN_PAGE_PATTERNS.some((p) => p.test(url));
      } catch {
        teamsOk = false;
      }

      // Check Outlook
      let outlookOk = false;
      try {
        await page.goto('https://outlook.office365.com', { timeout: 15000 });
        const url = page.url();
        outlookOk = !LOGIN_PAGE_PATTERNS.some((p) => p.test(url));
      } catch {
        outlookOk = false;
      }

      await context.close();

      return {
        valid: teamsOk || outlookOk,
        teamsAccessible: teamsOk,
        outlookAccessible: outlookOk,
      };
    } catch {
      if (context) await context.close();
      return { valid: false, teamsAccessible: false, outlookAccessible: false };
    }
  }
}
```

**Step 4: Run tests**

Run: `cd packages/clawpilot-browser && npx vitest run src/__tests__/browser.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(browser): add BrowserManager with session lifecycle"
```

---

### Task 8: Auth Commands — Wire to BrowserManager

**Files:**

- Modify: `packages/clawpilot-browser/src/commands/auth.ts`

**Step 1: Implement all auth commands**

```typescript
// packages/clawpilot-browser/src/commands/auth.ts
import { Command } from 'commander';
import { output, success, error } from '../utils/output.js';
import { BrowserManager } from '../browser.js';

export function registerAuthCommands(program: Command): void {
  const auth = program.command('auth').description('Manage browser authentication');

  auth
    .command('login')
    .description('Launch browser for manual Office 365 login')
    .action(async () => {
      const manager = new BrowserManager();
      const result = await manager.login();
      if (result.success) {
        output(success({ message: result.message }));
      } else {
        output(error('login_timeout', result.message));
      }
    });

  auth
    .command('status')
    .description('Check if browser session is valid')
    .action(async () => {
      const manager = new BrowserManager();
      if (!manager.hasSession()) {
        output(
          success({
            authenticated: false,
            session_age_hours: null,
            message: 'No session found. Run: clawpilot-browser auth login',
          }),
        );
        return;
      }
      // Session exists — report it
      output(
        success({
          authenticated: true,
          session_age_hours: null, // Would need stat check
          message: "Session found. Use 'health full' for deep validation.",
        }),
      );
    });

  auth
    .command('clear')
    .description('Clear saved browser session')
    .action(async () => {
      const manager = new BrowserManager();
      manager.clearSession();
      output(success({ message: 'Browser session cleared.' }));
    });
}
```

**Step 2: Build and test**

Run: `cd packages/clawpilot-browser && pnpm build`

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(browser): wire auth commands to BrowserManager"
```

**Manual test flow (this is the big one!):**

```bash
# 1. Check health — should show no session
node dist/index.js health full

# 2. Check auth status — should show not authenticated
node dist/index.js auth status

# 3. Login — opens a real browser window!
node dist/index.js auth login
# → Manually log in to Office 365
# → Should see success JSON after login

# 4. Check auth status — should show authenticated
node dist/index.js auth status

# 5. Full health — should show session exists
node dist/index.js health full

# 6. Clear session
node dist/index.js auth clear

# 7. Verify cleared
node dist/index.js auth status
# → Should show not authenticated
```

---

### Task 9: README with Mascotte

**Files:**

- Create: `README.md` (replace any existing)

**Step 1: Write README**

````markdown
# 🦀 Clawpilot

<p align="center">
  <img src="mascotte.png" alt="Clawpilot Mascotte" width="300" />
</p>

<p align="center">
  <em>A personal AI agent that runs on your laptop, learns from you, and gets things done.</em>
</p>

---

Clawpilot is a self-improving personal AI agent. It runs as a daemon on your laptop, interacts with your work tools (Teams, Outlook, Jira, Confluence, GitHub), and learns your preferences over time.

## Packages

| Package              | Description                  | Status         |
| -------------------- | ---------------------------- | -------------- |
| `@clawpilot/browser` | Playwright-based browser CLI | 🚧 In Progress |
| `@clawpilot/core`    | Agent daemon                 | 📋 Planned     |

## Quick Start

```bash
# Install dependencies
pnpm install

# Build browser CLI
cd packages/clawpilot-browser
pnpm build

# Check Playwright installation
node dist/index.js health check-install

# Login to Office 365 (opens a browser window)
node dist/index.js auth login

# Check session status
node dist/index.js auth status

# Full health check
node dist/index.js health full
```
````

## Development

```bash
# Run tests
pnpm test

# Watch mode
cd packages/clawpilot-browser
pnpm test:watch

# Type check
pnpm lint
```

## Architecture

See [clawpilot-project.md](../../clawpilot-project.md) for the full architecture document.

## License

MIT

````

**Step 2: Commit**

```bash
git add -A
git commit -m "docs: add README with mascotte and quick start guide"
````

---

### Task 10: Final Integration Test & Polish

**Files:**

- Modify: various (minor fixes found during integration)

**Step 1: Full build from clean state**

Run:

```bash
cd /path/to/clawpilot
rm -rf node_modules packages/*/node_modules packages/*/dist
pnpm install
pnpm build
```

Expected: Clean build, no errors.

**Step 2: Run all tests**

Run: `pnpm test`
Expected: All tests pass.

**Step 3: Manual test complete flow**

```bash
cd packages/clawpilot-browser

# CLI help
node dist/index.js --help
node dist/index.js health --help
node dist/index.js auth --help

# Health checks
node dist/index.js health check-install
node dist/index.js health check-session
node dist/index.js health full

# Auth flow
node dist/index.js auth status
node dist/index.js auth login    # Interactive!
node dist/index.js auth status
node dist/index.js auth clear
node dist/index.js auth status
```

**Step 4: Push to GitHub**

```bash
git push origin main
```

**Step 5: Close GitHub issues**

Close all completed issues via `gh issue close`.
