# Quality Guardrails Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish enterprise-grade quality guardrails (ESLint strict, Prettier, Husky hooks, coverage thresholds, CI, GitHub Pages reports with badges) inspired by NewDayCards/Mobile.Vulcan.

**Architecture:** Root-level tooling config (ESLint flat config, Prettier, Husky) shared across pnpm workspace. CI via GitHub Actions. Coverage reports and badges auto-generated and deployed to GitHub Pages.

**Tech Stack:** ESLint 9 (flat config), typescript-eslint, Prettier, Husky, lint-staged, @vitest/coverage-v8, GitHub Actions, GitHub Pages

---

### Task 1: ESLint + Prettier Config

**Files:**

- Create: `eslint.config.mjs`
- Create: `.prettierrc`
- Create: `.prettierignore`
- Modify: `package.json` (add devDeps + scripts)
- Modify: `packages/clawpilot-browser/package.json` (update lint script)

**Step 1: Install devDependencies at workspace root**

```bash
cd /Users/n45085/Developer/NDC/Clawpilot
pnpm add -Dw eslint @eslint/js typescript-eslint eslint-config-prettier prettier
```

**Step 2: Create `eslint.config.mjs`**

```javascript
// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  prettierConfig,
  {
    ignores: [
      '**/dist/',
      '**/coverage/',
      '**/node_modules/',
      '**/*.config.*',
      '**/*.mjs',
      'docs/',
      'scripts/',
    ],
  },
  {
    files: ['packages/*/src/**/*.ts', 'packages/*/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
```

**Step 3: Create `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

**Step 4: Create `.prettierignore`**

```
dist/
coverage/
node_modules/
pnpm-lock.yaml
docs/reports/
*.svg
```

**Step 5: Update root `package.json` scripts**

Add to scripts:

```json
"lint": "eslint . && pnpm -r lint",
"format": "prettier --write .",
"format:check": "prettier --check ."
```

**Step 6: Update `packages/clawpilot-browser/package.json` lint script**

Change `"lint": "tsc --noEmit"` to `"lint": "tsc --noEmit"` (keep as typecheck — root handles eslint).

Actually add a new `typecheck` script:

```json
"typecheck": "tsc --noEmit",
"lint": "tsc --noEmit"
```

**Step 7: Run lint to see current violations**

```bash
pnpm exec eslint .
```

Fix any issues found. The main ones will be:

- Arrow functions in Commander `.action()` callbacks need return type annotations
- The `async () => {` lambdas in commands/ files — these need `: Promise<void>`

**Step 8: Run prettier to format all files**

```bash
pnpm exec prettier --write .
```

**Step 9: Verify**

```bash
pnpm exec eslint . && pnpm exec prettier --check .
```

**Step 10: Commit**

```bash
git add -A
git commit -m "feat: add ESLint strict + Prettier config

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Fix Existing Code for Strict Lint

**Files:**

- Modify: `packages/clawpilot-browser/src/commands/auth.ts`
- Modify: `packages/clawpilot-browser/src/commands/health.ts`
- Modify: `packages/clawpilot-browser/src/index.ts`
- Modify: any other files with violations

**Step 1: Run ESLint and capture violations**

```bash
pnpm exec eslint . 2>&1
```

**Step 2: Fix each violation**

The main issues to expect:

- Commander `.action(async () => { ... })` — the arrow functions need explicit return type `: Promise<void>`
- Any implicit return types on exported functions (most already have them)
- Possible unused imports

**Step 3: Run tests to ensure nothing broke**

```bash
cd packages/clawpilot-browser && pnpm test
```

**Step 4: Run full lint + format check**

```bash
cd /Users/n45085/Developer/NDC/Clawpilot
pnpm exec eslint . && pnpm exec prettier --check .
```

**Step 5: Commit**

```bash
git add -A
git commit -m "fix: resolve all ESLint strict violations

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: TypeScript Maximum Strictness

**Files:**

- Modify: `tsconfig.base.json`

**Step 1: Update `tsconfig.base.json` to match Vulcan strictness**

Add these compiler options (keeping existing ones):

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
    "rootDir": "src",
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "allowJs": false
  }
}
```

**Step 2: Build to find any new TS errors**

```bash
cd packages/clawpilot-browser && pnpm build
```

Fix any errors. `verbatimModuleSyntax` will require changing `import type` to use `type` keyword explicitly where needed. For example, `import { type CLIResponse }` or separate `import type { X }` statements.

**Step 3: Run tests**

```bash
pnpm test
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: enable maximum TypeScript strictness

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Vitest Coverage Thresholds

**Files:**

- Modify: `packages/clawpilot-browser/vitest.config.ts`
- Modify: `packages/clawpilot-browser/package.json` (add coverage dep + script)

**Step 1: Install coverage provider**

```bash
cd /Users/n45085/Developer/NDC/Clawpilot
pnpm add -D --filter @clawpilot/browser @vitest/coverage-v8
```

**Step 2: Update `packages/clawpilot-browser/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    reporters: ['default', 'json'],
    outputFile: { json: './test-results.json' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/**/types.ts', 'src/index.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
```

**Step 3: Add coverage scripts to `packages/clawpilot-browser/package.json`**

```json
"test:coverage": "vitest run --coverage"
```

**Step 4: Run coverage to verify it works**

```bash
cd packages/clawpilot-browser && pnpm test:coverage
```

Inspect the output. If coverage is below 80% for any metric, we may need to adjust thresholds or add tests. Given the browser.ts module has untestable browser methods, we should exclude it or accept the threshold may need the exclude list adjusted.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Vitest coverage thresholds (80% minimum)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Husky + lint-staged

**Files:**

- Create: `.husky/pre-commit`
- Create: `.husky/pre-push`
- Modify: `package.json` (add husky + lint-staged deps + config)

**Step 1: Install dependencies**

```bash
cd /Users/n45085/Developer/NDC/Clawpilot
pnpm add -Dw husky lint-staged
```

**Step 2: Initialize husky**

```bash
pnpm exec husky init
```

This creates `.husky/` directory.

**Step 3: Create `.husky/pre-commit`**

```bash
npx lint-staged
```

**Step 4: Create `.husky/pre-push`**

```bash
if [ -n "$SKIP_PRE_PUSH_TESTS" ]; then
  echo "SKIP_PRE_PUSH_TESTS is set; skipping test run."
  exit 0
fi

pnpm test
TEST_STATUS=$?

if [ "$TEST_STATUS" -ne 0 ]; then
  echo "Tests failed (exit code $TEST_STATUS). Aborting push."
  exit "$TEST_STATUS"
fi
```

**Step 5: Add lint-staged config to root `package.json`**

```json
"lint-staged": {
  "*.ts": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml,yaml}": ["prettier --write"]
}
```

**Step 6: Add prepare script to root `package.json`**

```json
"prepare": "husky"
```

**Step 7: Test the hooks**

```bash
# Test pre-commit
echo "test" >> packages/clawpilot-browser/src/utils/output.ts
git add packages/clawpilot-browser/src/utils/output.ts
git commit -m "test hook" # Should run lint-staged
git reset HEAD~1 # Undo if it committed
git checkout packages/clawpilot-browser/src/utils/output.ts
```

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Husky git hooks + lint-staged

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: CI Workflow

**Files:**

- Create: `.github/workflows/ci.yml`

**Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  checks:
    name: Checks
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright
        run: pnpm exec playwright install chromium

      - name: Run lint
        run: pnpm exec eslint .

      - name: Run format check
        run: pnpm exec prettier --check .

      - name: Run typecheck
        run: pnpm -r lint

      - name: Run tests
        run: pnpm test

      - name: Run build
        run: pnpm build
```

**Step 2: Commit**

```bash
git add -A
git commit -m "ci: add GitHub Actions CI workflow

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 7: Badge + Report Scripts

**Files:**

- Create: `scripts/generate-report.js`
- Create: `scripts/update-badges.js`
- Create: `scripts/history-utils.js`
- Create: `docs/reports/history/data.json` (seed)

**Step 1: Create `scripts/history-utils.js`**

Adapted from Vulcan:

```javascript
/**
 * Upsert a history run entry into a runs array.
 * If an entry for the same date exists, replace it. Otherwise append.
 * Returns a new array (does not mutate input).
 */
export function upsertHistoryRun(runs, newRun) {
  const existingIndex = runs.findIndex((r) => r.date === newRun.date);
  if (existingIndex !== -1) {
    const updated = [...runs];
    updated[existingIndex] = newRun;
    return updated;
  }
  return [...runs, newRun];
}
```

**Step 2: Create `scripts/update-badges.js`**

Adapted from Vulcan — generates SVG badges from test-results.json and coverage-summary.json. Writes to `docs/reports/badges/`.

**Step 3: Create `scripts/generate-report.js`**

Adapted from Vulcan — generates full HTML dashboard with Chart.js trends, badge JSON/SVG, and historical data. Reads from `packages/clawpilot-browser/test-results.json` and `packages/clawpilot-browser/coverage/coverage-summary.json`. Writes to `docs/reports/`.

Title should say "Clawpilot" not "Vulcan CLI". Link should point to `giordano-newday/clawpilot`.

**Step 4: Seed history**

```bash
mkdir -p docs/reports/history
echo '{"runs":[]}' > docs/reports/history/data.json
mkdir -p docs/reports/badges
```

**Step 5: Test report generation**

```bash
cd packages/clawpilot-browser && pnpm test:coverage
cd /Users/n45085/Developer/NDC/Clawpilot
node scripts/generate-report.js
```

Verify `docs/reports/index.html` and `docs/reports/badges/coverage.svg` exist.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add badge and report generation scripts

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 8: Reports Workflow + GitHub Pages

**Files:**

- Create: `.github/workflows/reports.yml`

**Step 1: Create `.github/workflows/reports.yml`**

Adapted from Vulcan. Uses pnpm instead of npm. Points to correct paths for the pnpm monorepo.

```yaml
name: Reports

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pages: write
      id-token: write
    outputs:
      pages_configured: ${{ steps.setup-pages.outcome == 'success' }}
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright
        run: pnpm exec playwright install chromium

      - name: Run tests with coverage
        run: cd packages/clawpilot-browser && pnpm test:coverage

      - name: Download previous history
        continue-on-error: true
        run: |
          mkdir -p docs/reports/history
          curl -sSL \
            -H "Authorization: Bearer ${{ secrets.GITHUB_TOKEN }}" \
            -H "Accept: application/vnd.github.raw+json" \
            https://api.github.com/repos/${{ github.repository }}/contents/docs/reports/history/data.json \
            -o docs/reports/history/data.json \
            || echo '{"runs":[]}' > docs/reports/history/data.json

      - name: Generate report
        run: node scripts/generate-report.js

      - name: Commit badge and history files
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add docs/reports/badges/ docs/reports/history/data.json
          git diff --cached --quiet || git commit -m "chore: update coverage badges and history [skip ci]"
          git push

      - name: Setup Pages
        id: setup-pages
        continue-on-error: true
        uses: actions/configure-pages@v4

      - name: Upload artifact
        if: steps.setup-pages.outcome == 'success'
        uses: actions/upload-pages-artifact@v3
        with:
          path: 'docs/reports'

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    if: needs.build.outputs.pages_configured == 'true'
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

**Step 2: Enable GitHub Pages for the repo (source: GitHub Actions)**

```bash
gh api repos/giordano-newday/clawpilot/pages -X POST -f build_type=workflow 2>&1 || true
```

**Step 3: Commit**

```bash
git add -A
git commit -m "ci: add reports workflow with GitHub Pages deployment

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 9: README Badges + Node Engine

**Files:**

- Modify: `README.md`
- Modify: `package.json` (add engines)

**Step 1: Add engine constraint to root `package.json`**

```json
"engines": {
  "node": ">=20.0.0"
}
```

**Step 2: Update README.md with badges**

Add badges after the title, before the mascotte image:

```markdown
# 🦀 Clawpilot

[![CI](https://github.com/giordano-newday/clawpilot/actions/workflows/ci.yml/badge.svg)](https://github.com/giordano-newday/clawpilot/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Coverage](./docs/reports/badges/coverage.svg)](https://giordano-newday.github.io/clawpilot/)
[![Tests](./docs/reports/badges/tests.svg)](https://giordano-newday.github.io/clawpilot/)
```

**Step 3: Commit**

```bash
git add -A
git commit -m "docs: add CI, TypeScript, coverage, and tests badges

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 10: Push + Verify CI

**Step 1: Push everything**

```bash
git push origin main
```

**Step 2: Verify CI passes on GitHub**

Check `https://github.com/giordano-newday/clawpilot/actions`

**Step 3: Verify GitHub Pages deploys**

Check `https://giordano-newday.github.io/clawpilot/`

**Step 4: Close issue #11**

```bash
gh issue close 11 --comment "Quality guardrails implemented: ESLint strict, Prettier, Husky hooks, 80% coverage thresholds, CI workflow, GitHub Pages reports with badges."
```
