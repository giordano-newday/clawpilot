# 🦀 Clawpilot

[![CI](https://github.com/giordano-newday/clawpilot/actions/workflows/ci.yml/badge.svg)](https://github.com/giordano-newday/clawpilot/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Coverage](./docs/reports/badges/coverage.svg)](https://giordano-newday.github.io/clawpilot/)
[![Tests](./docs/reports/badges/tests.svg)](https://giordano-newday.github.io/clawpilot/)

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

# Prepare the repo-local browser CLI
pnpm browser:install

# Check Playwright installation
pnpm exec clawpilot-browser health check-install

# Check session status
pnpm exec clawpilot-browser health check-session

# Full health check
pnpm exec clawpilot-browser health full

# Login to Office 365 (opens a browser window)
pnpm exec clawpilot-browser auth login

# Verify login
pnpm exec clawpilot-browser auth status

# Clear session
pnpm exec clawpilot-browser auth clear
```

`pnpm browser:install` builds `@clawpilot/browser` and installs the Playwright browser binaries required by the health checks. After that, invoke the repo-local CLI with `pnpm exec clawpilot-browser ...` from the repository root.

## Development

```bash
# Run all tests
pnpm test

# Watch mode
cd packages/clawpilot-browser
pnpm test:watch

# Type check
pnpm lint
```

TypeScript engineering guidance for this repo lives in [`docs/typescript-guidelines.md`](./docs/typescript-guidelines.md).
The pre-commit hook runs `lint-staged` plus a staged-file guideline check for changed `.ts` and `.tsx` files.

## Project-local agent skills

- `.agents/skills/typescript-pro` vendors a strong TypeScript specialist skill into the repo.
- It gives future agent sessions project-local guidance on strict typing, type guards, utility types, tsconfig choices, and type-first API design.
- Upstream source: `Jeffallan/claude-skills` (`skills/typescript-pro`, MIT).

## Browser CLI Commands

```bash
# Search the web using DuckDuckGo
pnpm exec clawpilot-browser web search "your query" [--max-results 5]

# Fetch and extract content from a URL
pnpm exec clawpilot-browser web fetch "https://example.com" [--readability]

# List Teams chats and channels (default page size: 20)
pnpm exec clawpilot-browser teams list [--limit 20] [--offset 0] [--json]

# Read a specific Teams chat/channel by id from `teams list`
pnpm exec clawpilot-browser teams read "<id>" [--limit 20] [--offset 0] [--json]

# Look up a Confluence page by URL or page id
pnpm exec clawpilot-browser confluence page get "<page-id-or-url>" [--json]

# Create a Confluence child page under a parent page
pnpm exec clawpilot-browser confluence page create-child "<parent-page-id-or-url>" --title "Weekly work summary - YYYY-MM-DD" --body "<p>Body</p>" [--json]

# Update a Confluence page title and/or body
pnpm exec clawpilot-browser confluence page update "<page-id-or-url>" [--title "New title"] [--body "<p>Updated body</p>"] [--json]

# Validate whether the saved Office session still works
pnpm exec clawpilot-browser auth status --validate

# Run the end-to-end manual browser QA script
packages/clawpilot-browser/scripts/manual-test-web.sh

# Run the Teams discovery/read manual QA script
packages/clawpilot-browser/scripts/manual-test-teams.sh
```

`auth status`, `auth status --validate`, and `health check-session` now include stored
session expiry hints plus the last live validation timestamp/result. Expiry remains
best-effort because some Microsoft cookies are session-only or can be invalidated
server-side before their cookie expiry.

Confluence commands reuse the existing Atlassian site and token setup from `JIRA_URL`,
`JIRA_API_TOKEN`, and the jira-cli login config by default. Override with
`CONFLUENCE_SITE_URL`, `CONFLUENCE_API_TOKEN`, or `CONFLUENCE_LOGIN` if needed.

## Architecture

See [clawpilot-project.md](./docs/clawpilot-project.md) for the full architecture document.

## License

MIT
