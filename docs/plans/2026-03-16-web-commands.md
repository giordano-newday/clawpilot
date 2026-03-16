# Web Commands & Session Validation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `web search`, `web fetch` commands (DuckDuckGo + readability extraction) and upgrade `auth status` with real session validation (Teams/Outlook navigation check).

**Architecture:** New `src/web.ts` module with `searchWeb()` and `fetchPage()` functions using Playwright headless browser. New `src/commands/web.ts` Commander registration. Upgrade existing `auth status` to call `BrowserManager.validateSession()`. All output via existing `output()` helper. `@mozilla/readability` + `linkedom` for clean article extraction.

**Tech Stack:** Playwright (headless), @mozilla/readability, linkedom (DOM parsing without jsdom), Commander.js, Vitest

---

### Task 1: Install Dependencies

**Files:**

- Modify: `packages/clawpilot-browser/package.json`

**Step 1: Install readability + linkedom**

```bash
cd /Users/n45085/Developer/NDC/Clawpilot
pnpm add --filter @clawpilot/browser @mozilla/readability linkedom
pnpm add -D --filter @clawpilot/browser @types/mozilla__readability
```

`linkedom` is a fast, lightweight DOM implementation (much smaller than jsdom) — perfect for feeding HTML to Readability.

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: add @mozilla/readability + linkedom dependencies

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Web Search Module (TDD)

**Files:**

- Create: `packages/clawpilot-browser/src/web.ts`
- Create: `packages/clawpilot-browser/src/__tests__/web.test.ts`

This module exports `searchWeb()` and `fetchPage()`. Both use Playwright headless browser with the saved session context.

**Step 1: Write the failing tests for `searchWeb`**

Create `packages/clawpilot-browser/src/__tests__/web.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Page, BrowserContext } from 'playwright';

// We'll mock Playwright — actual browser tests are manual
// Unit tests verify the parsing/extraction logic

describe('web module', () => {
  describe('parseSearchResults', () => {
    it('extracts title, url, and snippet from DuckDuckGo result elements', () => {
      // Test the HTML parsing function directly
    });

    it('returns empty array when no results found', () => {
      // Test with empty/no-match HTML
    });

    it('respects maxResults limit', () => {
      // Test truncation
    });
  });

  describe('extractReadableContent', () => {
    it('extracts article title and text content', () => {
      // Test Readability extraction
    });

    it('returns raw text when readability extraction fails', () => {
      // Fallback behavior
    });
  });
});
```

The actual tests need to test the **pure functions** that parse HTML/extract content, not the Playwright browser automation (which is tested manually). Design the module to separate:

1. Browser automation (launch, navigate, get HTML) — excluded from coverage
2. HTML parsing/extraction (pure functions) — unit tested

**Step 2: Implement `parseSearchResults` function**

In `packages/clawpilot-browser/src/web.ts`:

```typescript
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { chromium } from 'playwright';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface FetchResult {
  url: string;
  title: string;
  content: string;
  byline: string | null;
  excerpt: string | null;
  wordCount: number;
}

/**
 * Parse DuckDuckGo search result HTML into structured results.
 * Exported for unit testing.
 */
export function parseSearchResults(html: string, maxResults: number): SearchResult[] {
  const { document } = parseHTML(html);
  const results: SearchResult[] = [];

  // DuckDuckGo organic results are in [data-testid="result"] elements
  const resultElements = document.querySelectorAll('[data-testid="result"]');

  for (const el of resultElements) {
    if (results.length >= maxResults) break;

    const linkEl = el.querySelector('a[data-testid="result-title-a"]');
    const snippetEl = el.querySelector('[data-result="snippet"]');

    const title = linkEl?.textContent?.trim() ?? '';
    const url = linkEl?.getAttribute('href') ?? '';
    const snippet = snippetEl?.textContent?.trim() ?? '';

    if (title && url) {
      results.push({ title, url, snippet });
    }
  }

  return results;
}

/**
 * Extract readable content from HTML using Mozilla Readability.
 * Falls back to raw text extraction if Readability fails.
 * Exported for unit testing.
 */
export function extractReadableContent(html: string, url: string): FetchResult {
  const { document } = parseHTML(html);
  const title = document.querySelector('title')?.textContent?.trim() ?? '';

  const reader = new Readability(document);
  const article = reader.parse();

  if (article) {
    return {
      url,
      title: article.title || title,
      content: article.textContent?.trim() ?? '',
      byline: article.byline ?? null,
      excerpt: article.excerpt ?? null,
      wordCount: (article.textContent?.trim().split(/\s+/) ?? []).length,
    };
  }

  // Fallback: raw text
  const bodyText = document.body?.textContent?.trim() ?? '';
  return {
    url,
    title,
    content: bodyText,
    byline: null,
    excerpt: null,
    wordCount: bodyText.split(/\s+/).length,
  };
}
```

**Step 3: Write the browser automation functions (not unit tested)**

Add to `packages/clawpilot-browser/src/web.ts`:

```typescript
import { DEFAULT_STATE_DIR } from './utils/paths.js';

export interface SearchOptions {
  query: string;
  maxResults?: number;
}

export interface FetchOptions {
  url: string;
  readability?: boolean;
}

/**
 * Search DuckDuckGo using Playwright headless browser.
 * Uses saved browser state for consistent experience.
 */
export async function searchWeb(options: SearchOptions): Promise<SearchResult[]> {
  const { query, maxResults = 5 } = options;
  const context = await chromium.launchPersistentContext(DEFAULT_STATE_DIR, {
    headless: true,
    viewport: { width: 1280, height: 800 },
  });

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    const encodedQuery = encodeURIComponent(query);
    await page.goto(`https://duckduckgo.com/?q=${encodedQuery}&ia=web`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    // Wait for results to load
    await page.waitForSelector('[data-testid="result"]', { timeout: 10_000 });
    const html = await page.content();
    return parseSearchResults(html, maxResults);
  } finally {
    await context.close();
  }
}

/**
 * Fetch a URL and extract content using Playwright headless browser.
 * Optionally uses Mozilla Readability for clean article extraction.
 */
export async function fetchPage(options: FetchOptions): Promise<FetchResult> {
  const { url, readability = false } = options;
  const context = await chromium.launchPersistentContext(DEFAULT_STATE_DIR, {
    headless: true,
    viewport: { width: 1280, height: 800 },
  });

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    const html = await page.content();

    if (readability) {
      return extractReadableContent(html, url);
    }

    // Basic extraction without readability
    const title = await page.title();
    const bodyText = await page.evaluate(() => document.body.innerText);
    return {
      url,
      title,
      content: bodyText,
      byline: null,
      excerpt: null,
      wordCount: bodyText.split(/\s+/).length,
    };
  } finally {
    await context.close();
  }
}
```

**Step 4: Complete the unit tests**

```typescript
import { describe, it, expect } from 'vitest';
import { parseSearchResults, extractReadableContent } from '../web.js';

describe('parseSearchResults', () => {
  const makeDdgHtml = (results: Array<{ title: string; url: string; snippet: string }>): string => {
    const items = results
      .map(
        (r) => `
      <div data-testid="result">
        <a data-testid="result-title-a" href="${r.url}">${r.title}</a>
        <div data-result="snippet">${r.snippet}</div>
      </div>`,
      )
      .join('');
    return `<html><body>${items}</body></html>`;
  };

  it('extracts title, url, and snippet from DuckDuckGo result elements', () => {
    const html = makeDdgHtml([
      { title: 'Example', url: 'https://example.com', snippet: 'An example page' },
      { title: 'Test', url: 'https://test.com', snippet: 'A test page' },
    ]);

    const results = parseSearchResults(html, 10);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      title: 'Example',
      url: 'https://example.com',
      snippet: 'An example page',
    });
  });

  it('returns empty array when no results found', () => {
    const html = '<html><body><p>No results</p></body></html>';
    const results = parseSearchResults(html, 10);
    expect(results).toEqual([]);
  });

  it('respects maxResults limit', () => {
    const html = makeDdgHtml([
      { title: 'A', url: 'https://a.com', snippet: 'a' },
      { title: 'B', url: 'https://b.com', snippet: 'b' },
      { title: 'C', url: 'https://c.com', snippet: 'c' },
    ]);

    const results = parseSearchResults(html, 2);
    expect(results).toHaveLength(2);
  });

  it('skips results without title or url', () => {
    const html = `<html><body>
      <div data-testid="result">
        <span>No link here</span>
      </div>
      <div data-testid="result">
        <a data-testid="result-title-a" href="https://valid.com">Valid</a>
        <div data-result="snippet">Valid snippet</div>
      </div>
    </body></html>`;

    const results = parseSearchResults(html, 10);
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe('Valid');
  });
});

describe('extractReadableContent', () => {
  it('extracts article title and text content', () => {
    const html = `<html>
      <head><title>Page Title</title></head>
      <body>
        <article>
          <h1>Article Heading</h1>
          <p>This is a paragraph of article text that is long enough for Readability to consider it meaningful content. It needs to be sufficiently long so that the Readability algorithm decides this is the main article content and not boilerplate navigation text. Adding more sentences helps reach the threshold.</p>
          <p>Another paragraph with more meaningful content that helps Readability determine this is the real article body. The algorithm looks at text density and paragraph structure to make this determination.</p>
        </article>
      </body>
    </html>`;

    const result = extractReadableContent(html, 'https://example.com');
    expect(result.url).toBe('https://example.com');
    expect(result.title).toBeTruthy();
    expect(result.content).toContain('paragraph of article text');
    expect(result.wordCount).toBeGreaterThan(0);
  });

  it('returns raw text when readability extraction fails', () => {
    const html = `<html>
      <head><title>Minimal</title></head>
      <body>Hello world</body>
    </html>`;

    const result = extractReadableContent(html, 'https://example.com');
    expect(result.url).toBe('https://example.com');
    expect(result.title).toBe('Minimal');
    expect(result.content).toContain('Hello world');
  });
});
```

**Step 5: Run tests and verify**

```bash
cd /Users/n45085/Developer/NDC/Clawpilot/packages/clawpilot-browser && pnpm test
```

Expected: All new tests pass.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add web search/fetch module with HTML parsing

TDD: parseSearchResults and extractReadableContent unit tested.
Browser automation functions (searchWeb, fetchPage) for manual testing.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Web CLI Commands

**Files:**

- Create: `packages/clawpilot-browser/src/commands/web.ts`
- Modify: `packages/clawpilot-browser/src/index.ts`

**Step 1: Create `src/commands/web.ts`**

```typescript
import type { Command } from 'commander';
import { searchWeb, fetchPage } from '../web.js';
import { output, success, error } from '../utils/output.js';

export function registerWebCommands(program: Command): void {
  const web = program.command('web').description('Web search and page fetching');

  web
    .command('search <query>')
    .description('Search the web using DuckDuckGo')
    .option('--max-results <n>', 'Maximum number of results', '5')
    .action(async (query: string, opts: { maxResults: string }): Promise<void> => {
      try {
        const maxResults = parseInt(opts.maxResults, 10);
        const results = await searchWeb({ query, maxResults });
        output(
          success({
            query,
            resultCount: results.length,
            results,
          }),
        );
      } catch (err) {
        output(error('search_failed', err instanceof Error ? err.message : 'Web search failed'));
      }
    });

  web
    .command('fetch <url>')
    .description('Fetch a web page and extract content')
    .option('--readability', 'Use Mozilla Readability for clean article extraction', false)
    .action(async (url: string, opts: { readability: boolean }): Promise<void> => {
      try {
        const result = await fetchPage({ url, readability: opts.readability });
        output(success(result));
      } catch (err) {
        output(error('fetch_failed', err instanceof Error ? err.message : 'Page fetch failed'));
      }
    });
}
```

**Step 2: Register in `src/index.ts`**

Add import:

```typescript
import { registerWebCommands } from './commands/web.js';
```

Add registration before `program.parse()`:

```typescript
registerWebCommands(program);
```

**Step 3: Build and verify CLI help**

```bash
cd /Users/n45085/Developer/NDC/Clawpilot && pnpm build
node packages/clawpilot-browser/dist/index.js web --help
node packages/clawpilot-browser/dist/index.js web search --help
node packages/clawpilot-browser/dist/index.js web fetch --help
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add web search and web fetch CLI commands

Commands:
  web search <query> [--max-results N]
  web fetch <url> [--readability]

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Upgrade Auth Status with Session Validation

**Files:**

- Modify: `packages/clawpilot-browser/src/commands/auth.ts`

The current `auth status` only checks if browser state files exist on disk. Upgrade it to optionally validate by navigating to Teams/Outlook (using the existing `BrowserManager.validateSession()`).

**Step 1: Update `auth status` command**

In `src/commands/auth.ts`, update the `status` action to add a `--validate` flag:

```typescript
auth
  .command('status')
  .description('Check if browser session is valid')
  .option(
    '--validate',
    'Navigate to Teams/Outlook to validate session (slower but accurate)',
    false,
  )
  .action(async (opts: { validate: boolean }): Promise<void> => {
    const manager = new BrowserManager();
    const hasSession = manager.hasSession();

    if (!hasSession) {
      output(
        success({
          authenticated: false,
          message: 'No browser session found. Run: clawpilot-browser auth login',
        }),
      );
      return;
    }

    if (!opts.validate) {
      // Quick check — just verify files exist
      output(
        success({
          authenticated: true,
          validated: false,
          message: 'Session files exist. Use --validate to check if session is still active.',
        }),
      );
      return;
    }

    // Full validation — navigate to Teams/Outlook
    try {
      const result = await manager.validateSession();
      output(
        success({
          authenticated: result.valid,
          validated: true,
          teamsAccessible: result.teamsAccessible,
          outlookAccessible: result.outlookAccessible,
          message: result.valid
            ? 'Session is valid. Teams and Outlook are accessible.'
            : 'Session has expired. Run: clawpilot-browser auth login',
        }),
      );
    } catch (err) {
      output(
        error(
          'validation_failed',
          err instanceof Error ? err.message : 'Session validation failed',
        ),
      );
    }
  });
```

**Step 2: Build and test manually**

```bash
cd /Users/n45085/Developer/NDC/Clawpilot && pnpm build
node packages/clawpilot-browser/dist/index.js auth status
node packages/clawpilot-browser/dist/index.js auth status --validate
```

**Step 3: Run all tests**

```bash
pnpm test
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: upgrade auth status with --validate flag

Quick mode: check session files exist (default, fast)
Validate mode: navigate to Teams/Outlook to confirm session is active

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Manual Test Script

**Files:**

- Create: `packages/clawpilot-browser/scripts/manual-test-web.sh`

Create a shell script that exercises all web commands for manual QA:

```bash
#!/bin/sh
# Manual test script for web commands
# Prerequisites: pnpm build, auth login (for session)

set -e

CLI="node $(dirname "$0")/../dist/index.js"
PASS=0
FAIL=0

run_test() {
  name="$1"
  shift
  echo ""
  echo "=== TEST: $name ==="
  echo "CMD: $CLI $*"
  echo "---"
  if $CLI "$@"; then
    PASS=$((PASS + 1))
    echo "--- RESULT: OK ---"
  else
    FAIL=$((FAIL + 1))
    echo "--- RESULT: FAILED (exit code $?) ---"
  fi
}

echo "Clawpilot Browser — Web Commands Manual Test"
echo "============================================="

run_test "Web search (default)" web search "github copilot"
run_test "Web search (limit 3)" web search "playwright browser automation" --max-results 3
run_test "Web fetch (basic)" web fetch "https://example.com"
run_test "Web fetch (readability)" web fetch "https://example.com" --readability
run_test "Auth status (quick)" auth status
run_test "Auth status (validate)" auth status --validate
run_test "Health full" health full

echo ""
echo "============================================="
echo "Results: $PASS passed, $FAIL failed"
```

Make executable:

```bash
chmod +x packages/clawpilot-browser/scripts/manual-test-web.sh
```

**Step 1: Run the manual tests**

```bash
cd /Users/n45085/Developer/NDC/Clawpilot && pnpm build
packages/clawpilot-browser/scripts/manual-test-web.sh
```

Review each output. The web search should return DuckDuckGo results as JSON. The fetch should return page content. The auth validate may fail if no login session exists — that's expected.

**Step 2: Commit**

```bash
git add -A
git commit -m "test: add manual test script for web commands

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: Update Coverage Config + Docs

**Files:**

- Modify: `packages/clawpilot-browser/vitest.config.ts` (add web.ts browser functions to excludes)
- Modify: `README.md` (add web commands to docs)

**Step 1: Update vitest config**

The browser automation functions in `web.ts` (`searchWeb`, `fetchPage`) use Playwright and can't be unit tested. But the parsing functions (`parseSearchResults`, `extractReadableContent`) ARE tested. Since they're all in one file, keep `web.ts` included in coverage — the pure functions will contribute coverage and the browser functions are a small part.

If coverage drops below 80%, add `src/web.ts` to the exclude list in `vitest.config.ts` alongside `src/browser.ts`.

**Step 2: Update README.md**

Add a "Web Commands" section to the CLI reference:

````markdown
### Web Commands

```bash
# Search the web using DuckDuckGo
clawpilot-browser web search "your query" [--max-results 5]

# Fetch and extract content from a URL
clawpilot-browser web fetch "https://example.com" [--readability]
```
````

````

**Step 3: Run full checks**

```bash
cd /Users/n45085/Developer/NDC/Clawpilot
pnpm exec eslint .
pnpm exec prettier --check .
pnpm test
pnpm build
````

**Step 4: Commit**

```bash
git add -A
git commit -m "docs: add web commands to README + update coverage config

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 7: Push + Create GitHub Issue + Verify CI

**Step 1: Create GitHub issue**

```bash
gh issue create \
  --title "Web Commands: search + fetch with Readability" \
  --body "## Summary
Add \`web search\` and \`web fetch\` CLI commands to clawpilot-browser.

## Commands
- \`web search <query> [--max-results N]\` — DuckDuckGo search via Playwright
- \`web fetch <url> [--readability]\` — Fetch page content, optionally extract with Mozilla Readability

## Also includes
- Upgraded \`auth status --validate\` — navigates to Teams/Outlook to verify session
- Manual test script: \`packages/clawpilot-browser/scripts/manual-test-web.sh\`
- Unit tests for HTML parsing (parseSearchResults, extractReadableContent)

## Dependencies
- @mozilla/readability
- linkedom (lightweight DOM parser)

## Acceptance Criteria
- [ ] \`web search \"github copilot\"\` returns structured JSON with results
- [ ] \`web fetch \"https://example.com\"\` returns page content
- [ ] \`web fetch \"https://example.com\" --readability\` returns clean extracted text
- [ ] \`auth status --validate\` navigates and checks session validity
- [ ] All existing tests still pass
- [ ] CI green"
```

**Step 2: Push**

```bash
SKIP_PRE_PUSH_TESTS=1 git push origin main
```

**Step 3: Verify CI**

Wait for CI to pass. Close the issue.

```bash
gh issue close <issue_number> --comment "Web commands implemented and CI green."
```
