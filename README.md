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

# Install Playwright browser
npx playwright install chromium

# Build browser CLI
cd packages/clawpilot-browser
pnpm build

# Check Playwright installation
node dist/index.js health check-install

# Check session status
node dist/index.js health check-session

# Full health check
node dist/index.js health full

# Login to Office 365 (opens a browser window)
node dist/index.js auth login

# Verify login
node dist/index.js auth status

# Clear session
node dist/index.js auth clear
```

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

## Project-local agent skills

- `.agents/skills/typescript-pro` vendors a strong TypeScript specialist skill into the repo.
- It gives future agent sessions project-local guidance on strict typing, type guards, utility types, tsconfig choices, and type-first API design.
- Upstream source: `Jeffallan/claude-skills` (`skills/typescript-pro`, MIT).

## Browser CLI Commands

```bash
# Search the web using DuckDuckGo
node packages/clawpilot-browser/dist/index.js web search "your query" [--max-results 5]

# Fetch and extract content from a URL
node packages/clawpilot-browser/dist/index.js web fetch "https://example.com" [--readability]

# List Teams chats and channels (default page size: 20)
node packages/clawpilot-browser/dist/index.js teams list [--limit 20] [--offset 0] [--json]

# Read a specific Teams chat/channel by id from `teams list`
node packages/clawpilot-browser/dist/index.js teams read "<id>" [--limit 20] [--offset 0] [--json]

# Validate whether the saved Office session still works
node packages/clawpilot-browser/dist/index.js auth status --validate

# Run the end-to-end manual browser QA script
packages/clawpilot-browser/scripts/manual-test-web.sh

# Run the Teams discovery/read manual QA script
packages/clawpilot-browser/scripts/manual-test-teams.sh
```

`auth status`, `auth status --validate`, and `health check-session` now include stored
session expiry hints plus the last live validation timestamp/result. Expiry remains
best-effort because some Microsoft cookies are session-only or can be invalidated
server-side before their cookie expiry.

## Architecture

See [clawpilot-project.md](./docs/clawpilot-project.md) for the full architecture document.

## License

MIT
