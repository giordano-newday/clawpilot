# ClawPilot

> A personal AI agent that runs on your laptop, learns from you, and gets things done.

## 1. Vision & Overview

ClawPilot is a self-improving personal AI agent built on the GitHub Copilot SDK. It runs as a daemon on your laptop, interacts with your work tools (Teams, Outlook, Jira, Confluence, GitHub), and learns your preferences over time.

It is inspired by [pi](https://github.com/badlogic/pi-mono) (the minimal agent framework behind OpenClaw) in philosophy: small core, aggressive extensibility, skills over hardcoded features. But where pi is a coding agent, ClawPilot is a **work agent** — it manages your day, prepares for your meetings, searches your channels, and adapts to how you work.

### Core Principles

- **Self-contained**: No third-party API dependencies beyond the Copilot SDK. Web search uses DuckDuckGo via Playwright. Office integration uses browser automation. Everything runs locally.
- **Self-improving**: ClawPilot learns from every interaction. It stores history, extracts patterns, and adapts its behaviour based on your corrections and preferences.
- **Extensible via skills and workflows**: The agent's capabilities are defined by markdown files, not code. Skills teach it how to use CLI tools. Workflows define scheduled or triggered sequences. Both can be created, edited, and managed by the agent itself.
- **Resilient**: Designed for laptops that close. On restart, it catches up on what it missed — runs missed jobs, checks for updates, and summarises the gap.
- **Personality-driven**: A configurable "soul" defines how ClawPilot communicates — tone, proactiveness, summary style, boundaries. The soul evolves as the agent learns your preferences.
- **Graceful degradation**: ClawPilot detects whether Playwright is available and whether browser sessions are valid. When browser tools aren't available, it continues working with non-browser tools (CLI skills, file system, bash) and clearly reports what's degraded.

### What It Does (Day in the Life)

1. You open your laptop at 8am. ClawPilot starts, runs the morning briefing workflow: checks your Outlook calendar, queries your Jira board, searches Teams channels for overnight activity, and presents a briefing via desktop notification and the REPL log.
2. At 9:20am, you have a 9:30 standup. The meeting-prep workflow fires: it pulls what you committed yesterday (via `gh`), your in-progress Jira tickets, and any blockers mentioned in the mobile-dev Teams channel.
3. At 13:50, ten minutes before a cross-team sync, ClawPilot queries the meeting invite for attendees, searches its own history for past context with those people, pulls relevant Confluence pages, and shows preparation notes.
4. You want to know what happened in a Teams channel: `clawpilot send "search the mobile-dev channel for messages about the release since Monday"` — ClawPilot queries Teams via Playwright and returns a summary.
5. At 17:00 on Friday, a weekly summary workflow fires: key conversations found via Teams/Outlook search, tickets moved, PRs merged.

---

## 2. Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────┐
│                     ClawPilot Core                       │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐             │
│  │  Copilot  │  │   Soul   │  │ Scheduler │             │
│  │   SDK     │  │  System  │  │ + Catchup │             │
│  └────┬─────┘  └──────────┘  └───────────┘             │
│       │                                                  │
│  ┌────┴─────┐  ┌──────────┐  ┌───────────┐             │
│  │  Tools   │  │  SQLite  │  │  Health   │             │
│  │ Registry │  │  Memory  │  │  Monitor  │             │
│  └────┬─────┘  └──────────┘  └───────────┘             │
│       │                                                  │
│  ┌────┴─────────────────────────────────────┐           │
│  │            Local HTTP API                 │           │
│  └───────────────────────────────────────────┘           │
└──────────────┬──────────────────────┬───────────────────┘
               │                      │
     ┌─────────┴─────────┐   ┌───────┴────────┐
     │ clawpilot-browser  │   │  Menubar App   │
     │                    │   │  (macOS/Swift)  │
     │  Playwright CLI    │   │                 │
     │  Teams │ Outlook   │   │  Status/Control │
     │  Web Search│Fetch  │   │  Presence Detect│
     └────────────────────┘   └────────────────┘
               │
     ┌─────────┴─────────┐
     │  Skills (via bash) │
     │                    │
     │  jira-cli │ gh     │
     │  confluence-cli    │
     │  any CLI tool      │
     └────────────────────┘
```

### Data Flow

```
User Input Channels:
  Terminal REPL ──────────────→ Agent ──→ Response to stdout
  CLI one-shot ───────────────→ Agent ──→ Response to stdout
  Cron trigger ───────────────→ Agent ──→ Desktop notification + log

Future (not in v1):
  Teams self-chat ──→ Watcher ──→ Agent ──→ Response via Teams

Agent Processing:
  Input → Load relevant skills → Load soul + learnings → Copilot SDK session
    → Tool calls (browser CLI, bash, skills) → Response → Save to history
    → Periodic: reflect on history → extract learnings → save to SQLite
```

### Package Structure

```
clawpilot/
├── package.json                        # Bun workspace root
├── ecosystem.config.cjs                # pm2 daemon config
├── README.md
│
├── packages/
│   ├── core/                           # The agent daemon
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts                # Entry point, startup sequence
│   │       ├── agent.ts                # Copilot SDK session management
│   │       ├── soul.ts                 # Soul loader + learnings injection
│   │       ├── skills.ts               # Skill discovery, registry, management
│   │       ├── workflows.ts            # Workflow loading + execution
│   │       ├── scheduler/
│   │       │   ├── cron.ts             # Job scheduling (node-cron)
│   │       │   └── catchup.ts          # Missed job recovery on restart
│   │       ├── state/
│   │       │   ├── db.ts               # SQLite setup + migrations
│   │       │   ├── history.ts          # Conversation history storage
│   │       │   ├── learnings.ts        # Self-improvement data
│   │       │   └── watermarks.ts       # Last-seen tracking per source
│   │       ├── health.ts               # Playwright & browser health checks
│   │       ├── server.ts               # Local HTTP API (localhost only)
│   │       ├── tools/
│   │       │   ├── registry.ts         # Tool registration + dynamic loading
│   │       │   ├── browser.ts          # Wraps clawpilot-browser CLI calls
│   │       │   ├── skill-mgmt.ts       # Skill CRUD tools for the agent
│   │       │   ├── workflow-mgmt.ts    # Workflow CRUD tools for the agent
│   │       │   ├── history-search.ts   # Search past conversations
│   │       │   ├── learnings.ts        # Read/write learnings
│   │       │   ├── notify.ts           # Desktop notifications
│   │       │   └── internal.ts         # Schedule, presence, status
│   │       ├── cli/
│   │       │   ├── index.ts            # CLI entry (commander)
│   │       │   ├── repl.ts             # Interactive REPL mode
│   │       │   └── commands.ts         # daemon, auth, status, send, skill, etc.
│   │       └── config/
│   │           ├── schema.ts           # Typed config with validation
│   │           └── defaults.ts         # Default configuration values
│   │
│   ├── clawpilot-browser/              # Playwright-based browser CLI
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts                # CLI entry (commander)
│   │       ├── browser.ts              # Playwright lifecycle + session persist
│   │       ├── auth.ts                 # Manual auth flow
│   │       ├── health.ts               # Verify Playwright installed + session valid
│   │       ├── pages/
│   │       │   ├── teams.ts            # Teams page interactions + search
│   │       │   ├── outlook.ts          # Outlook page interactions + search
│   │       │   ├── duckduckgo.ts       # Web search scraping
│   │       │   └── reader.ts           # Generic page → readable text
│   │       └── utils/
│   │           ├── selectors.ts        # CSS/aria selectors for Office pages
│   │           └── parsers.ts          # HTML → structured data
│   │
│   └── menubar/                        # macOS menubar app (phase 2)
│       ├── ClawPilot/
│       │   ├── ClawPilotApp.swift
│       │   ├── StatusViewModel.swift
│       │   ├── PresenceDetector.swift
│       │   └── Assets.xcassets/
│       └── Package.swift
│
├── souls/                              # Soul definitions (shipped defaults)
│   ├── jarvis.md
│   ├── professional.md
│   └── casual.md
│
└── config/
    └── clawpilot.example.yaml          # Example configuration
```

### Runtime File Layout

```
~/.clawpilot/                           # ClawPilot-specific data
├── config.yaml                         # User configuration
├── soul.md                             # Active soul (or symlink to souls/)
├── state/
│   ├── clawpilot.db                    # SQLite: history, learnings, watermarks
│   └── browser-state/                  # Playwright persistent context (cookies etc.)
├── skills-manifest.yaml                # Enable/disable skills in ~/.agents/skills/
├── workflows-manifest.yaml             # Enable/disable workflows in ~/.agents/workflows/
├── logs/
│   └── clawpilot.log                   # Daemon log (rotated by pm2)
└── sessions/                           # Raw JSONL session backups

~/.agents/                              # Agent-agnostic shared directory
├── skills/                             # Skill markdown files
│   ├── jira.md
│   ├── confluence.md
│   ├── gh.md
│   └── npm.md                          # Created by the agent on request
└── workflows/                          # Workflow markdown files
    ├── morning-briefing.md
    ├── meeting-prep.md
    ├── standup-prep.md
    └── weekly-summary.md
```

---

## 3. Packages

### 3.1 Core (`packages/core`)

The brain of ClawPilot. A TypeScript/Bun application that orchestrates everything.

**Responsibilities:**

- Manages the Copilot SDK client and session lifecycle
- Loads and injects the soul + learnings into every session
- Discovers and registers tools (built-in + skill-derived)
- Runs the cron scheduler with catch-up on restart
- Exposes a local HTTP API for the menubar app and external tools
- Provides an interactive REPL and non-interactive CLI
- Manages SQLite database for history, learnings, and watermarks
- Monitors health of browser tools and degrades gracefully

**Key Module Details:**

#### `agent.ts` — Copilot SDK Wrapper

Manages the CopilotClient lifecycle. Creates sessions with the appropriate model, system prompt (soul + learnings + relevant skills), and tool set. Handles streaming responses, multi-turn conversations, and session cleanup.

Each interaction (whether from REPL, CLI, or cron) creates a session, processes the request, saves the conversation to history, and closes the session. The system prompt is assembled dynamically per session:

```
System Prompt = Soul file
             + Relevant learnings from SQLite
             + Active skill descriptions (loaded on-demand)
             + Current context (time, day, browser availability, recent activity)
             + Tool availability report (which tools are healthy/degraded)
```

#### `health.ts` — Health Monitor

Checks the availability of browser tools on startup and periodically:

1. **Playwright installed?** — runs `clawpilot-browser health check-install` to verify Playwright and its browser binaries are present
2. **Browser session valid?** — runs `clawpilot-browser auth status` to check if the persistent session is still authenticated
3. **Session expired?** — if a browser command returns `session_expired` error, marks browser tools as degraded and notifies the user

Health states:

| State             | Meaning                               | Agent Behaviour                                                  |
| ----------------- | ------------------------------------- | ---------------------------------------------------------------- |
| `healthy`         | Playwright installed, session valid   | All tools available                                              |
| `no_session`      | Playwright installed, no auth session | Browser tools unavailable, agent suggests `clawpilot auth login` |
| `session_expired` | Playwright installed, session expired | Browser tools unavailable, agent suggests re-auth                |
| `not_installed`   | Playwright not installed              | Browser tools unavailable, agent suggests installation           |

The agent is always informed of the current health state via the system prompt, so it can communicate clearly to the user: "I can't check Teams right now because the browser session has expired. Run `clawpilot auth login` to fix this."

#### `server.ts` — Local HTTP API

A minimal HTTP server bound to `127.0.0.1` only. Endpoints:

```
GET  /status            → { state, uptime, browser_health, last_activity, soul }
GET  /health            → { playwright_installed, session_valid, details }
GET  /logs?n=50         → last N log lines
POST /restart           → restart the agent (pm2 restart)
POST /catch-up          → force a catch-up check now
POST /soul/:name        → switch active soul
GET  /skills            → list all skills with enabled/disabled status
POST /skill/:name/toggle → enable/disable a skill
GET  /workflows         → list all workflows with status
POST /workflow/:name/toggle → enable/disable a workflow
GET  /jobs              → list cron jobs + last run times
GET  /presence          → current presence state (phase 2)
POST /presence/:state   → set presence (phase 2)
```

#### `cli/` — User-Facing Commands

```bash
# Daemon management
clawpilot daemon start          # Start as background daemon (pm2)
clawpilot daemon stop           # Stop daemon
clawpilot daemon restart        # Restart daemon
clawpilot daemon logs           # Tail daemon logs

# Interactive
clawpilot repl                  # Interactive REPL session
clawpilot send "message"        # Send one-shot message, get response

# Auth & Health
clawpilot auth login            # Launch browser for Office auth
clawpilot auth status           # Check browser session validity
clawpilot health                # Full health check (Playwright, session, tools)

# Skills
clawpilot skill list            # List all skills + status
clawpilot skill enable <name>   # Enable a skill
clawpilot skill disable <name>  # Disable a skill

# Workflows
clawpilot workflow list         # List all workflows + status
clawpilot workflow enable <name>
clawpilot workflow disable <name>
clawpilot workflow run <name>   # Manually trigger a workflow

# Soul
clawpilot soul list             # List available souls
clawpilot soul use <name>       # Switch active soul

# Status
clawpilot status                # Overall system status
clawpilot catch-up              # Force catch-up now
```

### 3.2 ClawPilot Browser (`packages/clawpilot-browser`)

A standalone Playwright-based CLI that handles all browser interactions. Called by the core agent as a bash tool. Self-manages its Chrome session with built-in health verification.

**Responsibilities:**

- Manage a persistent Playwright browser context (cookies, localStorage)
- Provide CLI commands for Teams, Outlook, web search, and web fetch
- **Search and query** Teams channels, chats, and Outlook mail/calendar
- Handle authentication flow (launch visible browser for manual login)
- Detect session expiry and report it clearly
- Verify its own installation health (Playwright binaries present, session valid)

**CLI Commands:**

```bash
# Health & availability
clawpilot-browser health check-install    # Verify Playwright + browsers installed
clawpilot-browser health check-session    # Verify auth session is still valid
clawpilot-browser health full             # Full health report (JSON)

# Auth
clawpilot-browser auth login              # Launch visible browser for manual login
clawpilot-browser auth status             # Check if session is valid
clawpilot-browser auth clear              # Clear saved session

# Teams — Query & Search
clawpilot-browser teams search --channel "Mobile Dev" --query "release" [--since "1w ago"]
clawpilot-browser teams search --chat "John Smith" --query "deployment" [--since "2d ago"]
clawpilot-browser teams messages --channel "Mobile Dev" --since "4h ago" [--limit 20]
clawpilot-browser teams messages --chat self --since "1d ago"
clawpilot-browser teams channels                    # List joined channels
clawpilot-browser teams chats                       # List recent chats
clawpilot-browser teams send --chat self --message "..."

# Outlook — Query & Search
clawpilot-browser outlook search --query "quarterly report" [--since "1w ago"] [--limit 10]
clawpilot-browser outlook calendar --date today
clawpilot-browser outlook calendar --date tomorrow
clawpilot-browser outlook calendar --range "2026-03-15" "2026-03-21"
clawpilot-browser outlook mail --unread [--since "4h ago"] [--limit 10]
clawpilot-browser outlook mail --from "john@company.com" [--since "1w ago"]
clawpilot-browser outlook send --to self --subject "Note" --body "..."

# Web — Search & Fetch
clawpilot-browser web search "query" [--max-results 5]
clawpilot-browser web fetch "https://..." [--readability]
```

**Search Capabilities:**

The search commands are first-class features, not afterthoughts. They allow the agent to find specific information across tools:

| Command                                    | What it does                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| `teams search --channel "X" --query "Y"`   | Searches a Teams channel for messages matching a query, using Teams' built-in search |
| `teams search --chat "Person" --query "Y"` | Searches a specific chat for messages matching a query                               |
| `teams messages --channel "X" --since "Z"` | Gets recent messages from a channel (chronological, no keyword filter)               |
| `outlook search --query "Y"`               | Searches Outlook mail using Outlook's search functionality                           |
| `outlook mail --from "X"`                  | Filters mail by sender                                                               |
| `outlook calendar --date/--range`          | Queries calendar for a specific date or range                                        |

The search commands use the native search functionality built into Teams and Outlook web apps (via Playwright interaction with their search bars), rather than scraping all content and filtering locally. This is more efficient and leverages Microsoft's own search indexing.

**Browser Session Management:**

- Browser state persisted to `~/.clawpilot/state/browser-state/`
- On first use: `clawpilot-browser auth login` launches visible Chromium, user authenticates manually (including MFA), session saved on successful login
- On subsequent use: Playwright launches with saved context, window minimised (headed but hidden)
- Session expiry detection: if a page navigation lands on a login URL, CLI exits with a specific error code and message
- Browser mode is **on-demand** by default: launch Chromium when a command is called, do the work, close. Configurable to **persistent** mode for lower latency

**Health Check System:**

The `health` commands verify the full stack is operational:

```bash
$ clawpilot-browser health full
{
  "ok": true,
  "playwright_installed": true,
  "browser_binary": "/path/to/chromium",
  "browser_version": "126.0.6478.126",
  "session_exists": true,
  "session_valid": true,
  "session_age_hours": 12.5,
  "teams_accessible": true,
  "outlook_accessible": true
}
```

The `check-install` command verifies:

1. Playwright npm package is installed
2. Browser binaries are downloaded (`npx playwright install chromium`)
3. Required system dependencies are present

The `check-session` command verifies:

1. A browser state directory exists at `~/.clawpilot/state/browser-state/`
2. Quick navigation to Teams/Outlook — does it land on the app or a login page?

If installation is missing, ClawPilot provides clear instructions:

```
Playwright is not installed. To set up browser tools:
  1. cd packages/clawpilot-browser && bun install
  2. npx playwright install chromium
  3. clawpilot auth login
```

**Output Format:**

All commands output structured JSON to stdout:

```json
{
  "ok": true,
  "data": {
    "messages": [
      {
        "from": "John Smith",
        "timestamp": "2026-03-15T09:30:00Z",
        "content": "Has anyone reviewed the PR for the login flow?",
        "channel": "Mobile Dev"
      }
    ]
  }
}
```

Error responses include the error type for programmatic handling:

```json
{
  "ok": false,
  "error": "session_expired",
  "message": "Browser session has expired. Run: clawpilot auth login"
}
```

```json
{
  "ok": false,
  "error": "not_installed",
  "message": "Playwright is not installed. Run: npx playwright install chromium"
}
```

### 3.3 Menubar App (`packages/menubar`) — Phase 2

A native macOS SwiftUI app using `MenuBarExtra`. Tiny memory footprint, lives in the system menu bar.

**Responsibilities:**

- Show ClawPilot status (running/degraded/stopped) via icon colour
- Display last activity timestamp and browser health
- Quick actions: restart, re-auth, open REPL, open logs
- Presence detection via screen lock events (phase 2)

**Presence Detection (Phase 2):**

Listens for macOS distributed notifications:

- `com.apple.screenIsLocked` → POST `/presence/away` (after debounce)
- `com.apple.screenIsUnlocked` → POST `/presence/active`

Debounce: only transition to "away" after screen locked for 2 minutes (configurable). Transition back to "active" is immediate on unlock.

**Communication:** Polls `GET /status` on the local HTTP API every 5 seconds. Sends commands via POST endpoints.

---

## 4. Skill System

Skills are markdown files that teach ClawPilot how to use external tools. They live in `~/.agents/skills/` (agent-agnostic, shareable across agents) and are managed via a ClawPilot-specific manifest at `~/.clawpilot/skills-manifest.yaml`.

### Skill File Format

```markdown
# Skill: Jira

## Description

Interact with Jira for ticket management, sprint tracking, and board views.

## Prerequisites

- jira-cli installed: `brew install ankitpokhrel/jira-cli/jira`
- Authenticated: `jira init`

## Commands

### List my in-progress tickets

`jira issue list -a$(jira me) -s"In Progress"`

### View the sprint board

`jira sprint list --board <board-id> --current`

### View a specific ticket

`jira issue view <ticket-key>`
Returns: summary, status, assignee, description, comments.

### Add a comment to a ticket

`jira issue comment add <ticket-key> "<comment>"`

### Transition a ticket

`jira issue move <ticket-key> "<status>"`
Common statuses: "In Progress", "In Review", "Done"

### Search tickets

`jira issue list -q"<JQL query>"`

## When to Use

- Morning briefing: check in-progress and recently updated tickets
- Standup prep: tickets moved since yesterday
- Meeting prep: search for tickets mentioned in agenda
- When user asks about tickets, sprints, or the board

## Notes

- Board ID can be found with `jira board list`
- Default project is configured in jira-cli init
```

### Manifest Format

```yaml
# ~/.clawpilot/skills-manifest.yaml
skills:
  jira:
    enabled: true
    file: jira.md
    added: '2026-03-15'
    added_by: user # or "agent"

  confluence:
    enabled: true
    file: confluence.md
    added: '2026-03-15'
    added_by: user

  gh:
    enabled: true
    file: gh.md
    added: '2026-03-15'
    added_by: user

  npm:
    enabled: false
    file: npm.md
    added: '2026-03-20'
    added_by: agent # Created by the agent
```

### Skill Loading Strategy

Skills are NOT all loaded into every agent session — that would bloat the context window. Instead:

1. On startup, ClawPilot reads all enabled skill files and builds a **skill index**: name, description (first paragraph), and trigger keywords.
2. The skill index (just names + descriptions) is always included in the system prompt.
3. When the agent determines it needs a skill, it calls an internal tool to load the full skill content into the current session context.

This is progressive disclosure — the agent knows what skills exist, but only loads the full instructions when needed.

### Agent-Managed Skills

The agent has built-in tools for skill management:

- `skill_list` — returns the skill index with enabled/disabled status
- `skill_read` — reads the full content of a skill file
- `skill_create` — writes a new skill markdown file + adds to manifest
- `skill_update` — edits an existing skill file
- `skill_enable` / `skill_disable` — toggles in manifest
- `skill_delete` — removes file and manifest entry

The agent understands the skill format (via a meta-instruction in the system prompt) and can create well-structured skills on request:

> "Add a skill for managing Docker containers"

The agent generates the skill file, writes it to `~/.agents/skills/docker.md`, registers it in the manifest as enabled, and optionally tests a basic command to verify Docker is installed.

### Skill Validation

When the agent first uses a skill, it checks prerequisites:

- Runs a simple command (e.g., `jira --version`) to verify the CLI is installed
- If the command fails, the agent reports: "The Jira skill requires jira-cli. Install with: `brew install ankitpokhrel/jira-cli/jira`"
- Validation results are cached so the check only happens once per session

### Default Skills

ClawPilot ships with these skill files (copied to `~/.agents/skills/` on first run if not present):

| Skill           | CLI              | Purpose                                      |
| --------------- | ---------------- | -------------------------------------------- |
| `jira.md`       | `jira-cli`       | Ticket management, sprint boards, JQL search |
| `confluence.md` | `confluence-cli` | Read/search/create Confluence pages          |
| `gh.md`         | `gh`             | GitHub PRs, issues, actions, repo management |

---

## 5. Soul System

The soul defines ClawPilot's personality, communication style, and behavioural boundaries. It's a markdown file that gets injected into every agent session's system prompt.

### Soul File Format

```markdown
# Soul: Jarvis

## Identity

You are ClawPilot, a personal work assistant. Your communication style
is dry, concise, and occasionally witty. You address the user by name
when it adds warmth, but don't overdo it. British-inflected tone.

## Communication

- Lead with facts, then context
- When delivering bad news, be direct but not blunt
- Use short paragraphs, not walls of text
- Bullet points for lists of 3+ items
- No emoji unless the user uses them first

## Proactiveness

- Flag meeting conflicts immediately
- If you notice a pattern the user keeps asking about, offer to
  create a workflow for it
- Suggest preparation notes before important meetings

## Summaries

- Lead with what needs action
- Group by priority, not chronology
- Keep morning briefings to 5-7 bullet points max
- Meeting prep: attendees, agenda, relevant context, suggested talking points

## Boundaries

- Never send messages on behalf of the user without explicit confirmation
- Never decline or accept meetings automatically
- Never modify Jira tickets without confirmation
- Always show drafts before sending anything
- When unsure, ask rather than assume

## Tool Awareness

- When browser tools are unavailable, say so clearly and suggest fixes
- Don't attempt browser operations if health check reports degraded state
- Offer to use non-browser alternatives when possible

## Self-Improvement

- After each interaction, consider: did I give the user what they needed?
- If corrected, extract the learning and remember it
- Periodically review learnings and update behaviour accordingly
```

### Soul Selection

- Active soul: `~/.clawpilot/soul.md` (either a file or symlink)
- Available souls: `souls/` directory in the project + any custom files
- Switch via CLI: `clawpilot soul use jarvis`
- Switch via agent: "Switch to professional mode"

### Self-Improvement Layer

The soul sets baseline personality, but the **learnings** system evolves behaviour over time. See section 9 (Storage) for the learnings schema.

The agent periodically (e.g., every 10 interactions, or on a daily cron) reflects on recent conversations and extracts learnings:

- "User prefers bullet points over prose in briefings"
- "User always asks for Jira ticket numbers in standup prep — include them by default"
- "When user says 'prep me' before a meeting, they want attendees + agenda + context"
- "User prefers calendar times in 24h format"

Learnings are stored in SQLite and injected into the system prompt alongside the soul. They act as an evolving personalisation layer.

The agent can also **update its own soul file** when a learning is significant enough to become a permanent behaviour change. This requires user confirmation: "I've noticed you always want ticket numbers in standups. Should I make this a permanent part of my behaviour?"

---

## 6. Workflow System

Workflows are scheduled or triggered sequences that combine multiple skills and tools. Like skills, they live as markdown files in `~/.agents/workflows/` and are managed via a manifest at `~/.clawpilot/workflows-manifest.yaml`.

### Workflow File Format

```markdown
# Workflow: Morning Briefing

## Description

Daily morning briefing covering calendar, Jira, and Teams activity.

## Trigger

cron: "0 8 \* \* 1-5"

## Catch-Up Policy

if_within: 2h

## Skills Required

- outlook (calendar)
- jira (my tickets)

## Tools Required

- clawpilot-browser (teams search, outlook calendar, outlook mail)

## Output

desktop_notification + log

## Instructions

When this workflow runs:

1. Get today's calendar from Outlook. List all meetings with times, attendees,
   and whether they have a Teams link.
2. Get my in-progress Jira tickets. Note any that were updated since yesterday.
3. Search Teams monitored channels for messages since last briefing.
   Summarise only the important ones.
4. Check unread Outlook mail since last briefing. Flag anything that needs action.
5. Compose a briefing following this structure:

   **Good morning [name]**

   **Today's Schedule:**
   [meetings with times]

   **Jira Board:**
   [in-progress tickets, any updates]

   **Teams Highlights:**
   [important messages, skip noise]

   **Mail:**
   [actionable emails only]

   **Suggested Focus:**
   [based on calendar gaps and ticket priorities, suggest what to work on]

6. Send as desktop notification (summary) and full detail to log.
```

### Workflow Manifest

```yaml
# ~/.clawpilot/workflows-manifest.yaml
workflows:
  morning-briefing:
    enabled: true
    file: morning-briefing.md
    added: '2026-03-15'
    added_by: user

  meeting-prep:
    enabled: true
    file: meeting-prep.md
    added: '2026-03-15'
    added_by: agent

  standup-prep:
    enabled: true
    file: standup-prep.md
    added: '2026-03-16'
    added_by: agent

  weekly-summary:
    enabled: false
    file: weekly-summary.md
    added: '2026-03-20'
    added_by: user
```

### Trigger Types

- **cron**: Standard cron expression, executed by the scheduler
- **event**: Triggered by internal events (e.g., `before_meeting(10m)`, `on_catch_up`)
- **manual**: No automatic trigger, run via `clawpilot workflow run <name>` or by asking the agent

### Catch-Up Policies

When ClawPilot restarts and finds missed workflow runs:

| Policy                  | Behaviour                                                       |
| ----------------------- | --------------------------------------------------------------- |
| `always`                | Run the workflow regardless of how late                         |
| `if_within: <duration>` | Run only if missed by less than the specified duration          |
| `skip`                  | Never run if missed, just log it                                |
| `merge`                 | If multiple runs were missed, run once covering the full period |

### Workflow Output

Workflow outputs go to:

- **desktop_notification**: macOS notification via `node-notifier` (summary only)
- **log**: Full output written to the ClawPilot log and stored in conversation history
- **stdout**: If ClawPilot is running in REPL mode, output streams to the terminal
- **file**: Optional, write output to a specified file path

The output destination is configurable per workflow in the `## Output` section.

### Agent-Managed Workflows

The agent has built-in tools for workflow management, mirroring the skill management tools:

- `workflow_list` — list all workflows with status and schedules
- `workflow_read` — read full workflow content
- `workflow_create` — create a new workflow file + manifest entry
- `workflow_update` — edit an existing workflow
- `workflow_enable` / `workflow_disable` — toggle in manifest
- `workflow_delete` — remove file and manifest entry
- `workflow_run` — manually trigger a workflow

Users create workflows conversationally:

> "Create a workflow that runs 10 minutes before every meeting and prepares notes with attendee info and relevant context"

The agent writes the workflow file, registers it, and the scheduler picks it up.

### Event-Triggered Workflows

Some workflows don't run on a fixed schedule but react to events:

```markdown
## Trigger

event: before_meeting(10m)
```

The scheduler evaluates event triggers by checking conditions periodically:

- `before_meeting(Xm)`: Checks the calendar and fires X minutes before any meeting
- `on_catch_up`: Fires during the catch-up phase after a restart

### Default Workflows

| Workflow              | Trigger                      | Purpose                                 |
| --------------------- | ---------------------------- | --------------------------------------- |
| `morning-briefing.md` | `cron: "0 8 * * 1-5"`        | Calendar + Jira + Teams + mail overview |
| `meeting-prep.md`     | `event: before_meeting(10m)` | Prep notes for upcoming meetings        |
| `standup-prep.md`     | `cron: "30 9 * * 1-5"`       | Git + Jira summary for standup          |
| `weekly-summary.md`   | `cron: "0 17 * * 5"`         | Week in review                          |

---

## 7. Scheduler & Catch-Up

### Cron Scheduler

Uses `node-cron` (or Bun-compatible equivalent) to run workflows on schedule. Each job:

1. Checks browser health (if workflow requires browser tools)
2. Loads the workflow file
3. Creates a Copilot SDK session with appropriate skills and tools
4. Sends the workflow instructions as a prompt
5. Streams the response, executing tool calls as needed
6. Sends output to configured destination (notification, log, stdout, file)
7. Updates the watermark for `last_cron_run` in SQLite
8. Saves the full conversation to history

If browser tools are required but unavailable, the job runs with degraded output: it skips browser-dependent steps and notes what was missed.

### Catch-Up on Restart

Startup sequence (in `catchup.ts`):

```
1. Run health checks (Playwright installed? Session valid?)
2. Read all workflow cron schedules + last run times from SQLite
3. For each enabled workflow with a cron trigger:
   a. Calculate the most recent scheduled run time
   b. Compare against last_cron_run
   c. If missed:
      - Check catch-up policy (always / if_within / skip / merge)
      - If eligible: add to catch-up queue
4. Run eligible catch-up workflows
5. Send catch-up summary to configured output
6. Update all watermarks
```

### Event Trigger Evaluation

A secondary loop (every 60 seconds) evaluates event-based triggers:

- Fetches today's calendar (if browser available)
- Checks each event trigger condition
- Fires workflows whose conditions are met (with dedup — don't fire twice for the same meeting)

---

## 8. Presence Engine (Phase 2)

### States

| State        |    Cron     | Notifications | Entry Condition      |
| ------------ | :---------: | :-----------: | -------------------- |
| **Active**   |     On      |    Desktop    | Screen unlocked      |
| **Away**     |     On      |    Desktop    | Screen locked > 2min |
| **Sleeping** |     Off     |     None      | Outside work hours   |
| **DND**      | On (queued) |    Queued     | Manual toggle        |

### Configuration

```yaml
# In ~/.clawpilot/config.yaml
presence:
  work_hours:
    start: '07:30'
    end: '22:00'
    timezone: 'Europe/London'

  away_debounce_minutes: 2
```

### DND Behaviour

When DND is active, workflows still run but output is queued (not sent as notifications). When DND is deactivated, the agent sends a batched summary of everything that was queued.

---

## 9. Interaction Model

### Primary: Terminal REPL

Launch with `clawpilot repl`. Provides a direct conversational interface with the agent. Responses stream to stdout in real-time.

The REPL supports slash commands:

```
/status         — Show system status (including browser health)
/health         — Full health check
/soul <name>    — Switch soul
/skill <cmd>    — Skill management
/workflow <cmd> — Workflow management
/history <q>    — Search conversation history
/catch-up       — Force catch-up
/quit           — Exit REPL
```

Example session:

```
$ clawpilot repl
🤖 ClawPilot (jarvis) ready. Browser: healthy. 3 skills active.

> What's on my calendar today?
[agent queries Outlook calendar via clawpilot-browser]
You have four meetings today:
- 09:30 Daily Standup (15m, Teams)
- 11:00 1:1 with Sarah (30m, Teams)
- 14:00 Sprint Review (1h, Teams)
- 16:00 Architecture Discussion (45m, Room 3A)

Gap from 11:30-14:00 — solid block for focused work.

> Search the mobile-dev channel for messages about the API migration
[agent runs: clawpilot-browser teams search --channel "Mobile Dev" --query "API migration"]
Found 7 messages since Monday:
- James (Mon 10:15): Started the endpoint migration, v2 routes are live
- Priya (Mon 14:30): Tests passing for the auth endpoints, payments still WIP
- James (Tue 09:00): Payments endpoint migrated, needs review
- ...

> Find emails from Sarah about the budget
[agent runs: clawpilot-browser outlook search --query "budget" --from "sarah"]
Found 3 emails:
- Mar 12: "Q2 Budget Draft" — attached spreadsheet, asked for your review
- Mar 10: "Budget Meeting Follow-up" — action items from Monday's meeting
- Mar 5: "Initial Budget Proposal" — first draft

> Create a workflow that reminds me to review PRs every day at 11
[agent creates workflow file and registers it]
Created workflow "pr-review-reminder" at ~/.agents/workflows/pr-review-reminder.md
Trigger: cron "0 11 * * 1-5"
It will check for PRs awaiting your review via `gh` and notify you.
```

### Secondary: Non-Interactive CLI

For scripting, one-off commands, and integration with other tools:

```bash
# Send a message and get the response
clawpilot send "What's on my calendar today?"

# Search Teams
clawpilot send "Search the engineering channel for messages about the outage"

# Query Outlook
clawpilot send "Find emails from Sarah about the budget proposal"

# Use from Alfred/Raycast/keyboard shortcuts
clawpilot send "What are my in-progress Jira tickets?"
```

The response is printed to stdout. The full conversation is saved to history.

### Tertiary: Menubar App (Phase 2)

Status indicator and controls. Not a chat interface — just operational management.

### Future: Teams Self-Chat (Not in v1)

A future enhancement could add a Teams self-chat watcher that polls for messages and allows interaction from mobile/phone. This is explicitly deferred to keep v1 focused and avoid the complexity of message loop management.

---

## 10. Storage

### SQLite Schema

A single SQLite database at `~/.clawpilot/state/clawpilot.db`.

#### `conversations` Table

Stores every agent interaction.

```sql
CREATE TABLE conversations (
    id          TEXT PRIMARY KEY,                    -- UUID
    source      TEXT NOT NULL,                       -- 'repl' | 'cli' | 'workflow' | 'catch-up'
    started_at  TEXT NOT NULL,                       -- ISO 8601
    ended_at    TEXT,                                -- ISO 8601
    soul        TEXT NOT NULL,                       -- soul name used
    skills_used TEXT,                                -- JSON array of skill names
    workflow    TEXT,                                -- workflow name if triggered by one
    summary     TEXT,                                -- agent-generated summary of the conversation
    messages    TEXT NOT NULL                        -- JSON array of message objects
);

CREATE INDEX idx_conversations_started ON conversations(started_at);
CREATE INDEX idx_conversations_source ON conversations(source);
CREATE INDEX idx_conversations_workflow ON conversations(workflow);
```

#### `learnings` Table

Self-improvement data extracted by the agent from its interactions.

```sql
CREATE TABLE learnings (
    id          TEXT PRIMARY KEY,                    -- UUID
    created_at  TEXT NOT NULL,                       -- ISO 8601
    updated_at  TEXT NOT NULL,                       -- ISO 8601
    category    TEXT NOT NULL,                       -- 'preference' | 'correction' | 'pattern' | 'behaviour'
    content     TEXT NOT NULL,                       -- The learning itself
    confidence  REAL DEFAULT 0.5,                    -- 0.0-1.0, increases with reinforcement
    source_ids  TEXT,                                -- JSON array of conversation IDs that led to this
    active      INTEGER DEFAULT 1                   -- 1 = included in prompts, 0 = retired
);

CREATE INDEX idx_learnings_category ON learnings(category);
CREATE INDEX idx_learnings_active ON learnings(active);
```

**Learning Categories:**

| Category     | Example                                                    |
| ------------ | ---------------------------------------------------------- |
| `preference` | "User prefers 24h time format"                             |
| `correction` | "Standup is at 10:00, not 9:30"                            |
| `pattern`    | "User always asks about PRs on Monday mornings"            |
| `behaviour`  | "User wants ticket numbers included in all Jira summaries" |

**Confidence Scoring:**

- New learnings start at 0.5
- Reinforced (user behaviour confirms): +0.1 per confirmation, max 1.0
- Contradicted (user corrects): -0.2 per contradiction
- Below 0.2: learning is marked inactive and excluded from prompts
- Agent periodically reviews low-confidence learnings and may retire or update them

#### `watermarks` Table

Tracks the last-seen timestamp for each data source.

```sql
CREATE TABLE watermarks (
    source      TEXT PRIMARY KEY,                    -- e.g. 'teams:mobile-dev', 'outlook:inbox'
    last_seen   TEXT NOT NULL,                       -- ISO 8601
    updated_at  TEXT NOT NULL                        -- ISO 8601
);
```

#### `cron_runs` Table

Tracks when each scheduled job last ran.

```sql
CREATE TABLE cron_runs (
    workflow    TEXT PRIMARY KEY,                    -- workflow name
    last_run    TEXT NOT NULL,                       -- ISO 8601
    status      TEXT NOT NULL,                       -- 'success' | 'failed' | 'skipped'
    updated_at  TEXT NOT NULL                        -- ISO 8601
);
```

#### `browser_health` Table

Tracks browser health state for monitoring and reporting.

```sql
CREATE TABLE browser_health (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    checked_at      TEXT NOT NULL,                   -- ISO 8601
    playwright_ok   INTEGER NOT NULL,                -- 1/0
    session_ok      INTEGER NOT NULL,                -- 1/0
    teams_ok        INTEGER NOT NULL,                -- 1/0
    outlook_ok      INTEGER NOT NULL,                -- 1/0
    error_message   TEXT                             -- If any check failed
);

-- Keep only last 100 health checks
CREATE TRIGGER cleanup_health AFTER INSERT ON browser_health
BEGIN
    DELETE FROM browser_health WHERE id NOT IN (
        SELECT id FROM browser_health ORDER BY checked_at DESC LIMIT 100
    );
END;
```

### Watermark Management

Watermarks are updated after each successful data fetch. On startup, the catch-up system reads watermarks to determine what was missed.

```
Source Key Format:
  teams:<channel-name>  — Channel messages
  outlook:inbox         — Unread inbox mail
  outlook:calendar      — Calendar sync point
```

---

## 11. Configuration

### Main Config File

```yaml
# ~/.clawpilot/config.yaml

# Agent identity
name: 'Giordano' # How the agent addresses you
soul: 'jarvis' # Active soul name

# Browser
browser:
  mode: 'on_demand' # 'on_demand' or 'persistent'
  state_dir: '~/.clawpilot/state/browser-state'
  timeout_seconds: 30
  health_check_interval_minutes: 30 # How often to re-verify browser health

# Channels to query (used by workflows for search queries)
teams_channels:
  - 'Mobile Dev'
  - 'Engineering'
  - 'General'

# Copilot SDK
copilot:
  model: 'claude-sonnet-4' # Or any Copilot-supported model
  # BYOK config if not using Copilot subscription:
  # byok:
  #   provider: "anthropic"
  #   api_key: "${ANTHROPIC_API_KEY}"

# Local HTTP API
api:
  host: '127.0.0.1'
  port: 7777

# Logging
log:
  level: 'info' # debug | info | warn | error
  file: '~/.clawpilot/logs/clawpilot.log'

# Self-improvement
learning:
  enabled: true
  reflect_every_n_interactions: 10 # Reflect and extract learnings
  max_active_learnings: 50 # Cap to avoid prompt bloat


# Presence (phase 2)
# presence:
#   work_hours:
#     start: "07:30"
#     end: "22:00"
#     timezone: "Europe/London"
#   away_debounce_minutes: 2
```

---

## 12. Security Considerations

### Browser State

- `~/.clawpilot/state/browser-state/` contains authenticated sessions (cookies, localStorage). Directory permissions must be `700` (owner only).
- The browser context includes your Office 365 session — treat it as a credential.

### SQLite Database

- `~/.clawpilot/state/clawpilot.db` contains conversation history, which may include sensitive work data (meeting notes, ticket details, Teams messages). Directory permissions `700`.

### Local HTTP API

- Bound to `127.0.0.1` only — not accessible from the network.
- No authentication (it's localhost-only on your own machine).
- If port 7777 conflicts, configurable in `config.yaml`.

### Copilot SDK

- Uses your GitHub Copilot subscription authentication.
- Conversations are sent to GitHub's servers for LLM processing.
- BYOK mode available if you prefer to use your own API keys.

### Skills and Workflows

- Skills and workflows created by the agent are markdown files — review them before enabling if security-sensitive.
- The agent can execute bash commands via skills. The soul should define boundaries for what it can do autonomously vs. what requires confirmation.

### pm2 Daemon

- Runs under your user account with your permissions.
- Log files may contain sensitive data — same directory protections apply.

---

## 13. Tool Inventory

Complete list of tools available to the ClawPilot agent:

### Browser Tools (via `clawpilot-browser` CLI)

| Tool               | Command                                        | Description                                  |
| ------------------ | ---------------------------------------------- | -------------------------------------------- |
| `teams_search`     | `clawpilot-browser teams search ...`           | Search Teams channels or chats by keyword    |
| `teams_messages`   | `clawpilot-browser teams messages ...`         | Read recent messages from a channel or chat  |
| `teams_channels`   | `clawpilot-browser teams channels`             | List joined Teams channels                   |
| `teams_send`       | `clawpilot-browser teams send ...`             | Send a message (e.g. to self-chat)           |
| `outlook_search`   | `clawpilot-browser outlook search ...`         | Search Outlook mail by keyword, sender, date |
| `outlook_calendar` | `clawpilot-browser outlook calendar ...`       | Get calendar events for a date/range         |
| `outlook_mail`     | `clawpilot-browser outlook mail ...`           | Read mail (unread, by sender, by date)       |
| `outlook_send`     | `clawpilot-browser outlook send --to self ...` | Send email to self                           |
| `web_search`       | `clawpilot-browser web search ...`             | Search DuckDuckGo                            |
| `web_fetch`        | `clawpilot-browser web fetch ...`              | Fetch and extract page content               |
| `browser_health`   | `clawpilot-browser health full`                | Check browser availability and session       |

### System Tools (built-in, native)

| Tool             | Description                               |
| ---------------- | ----------------------------------------- |
| `read_file`      | Read a local file                         |
| `write_file`     | Write/create a local file                 |
| `run_command`    | Execute a bash command (used by skills)   |
| `desktop_notify` | Send a macOS/Windows desktop notification |

### Internal Tools (ClawPilot state)

| Tool              | Description                                         |
| ----------------- | --------------------------------------------------- |
| `search_history`  | Search past conversations in SQLite                 |
| `get_learnings`   | Read current active learnings                       |
| `save_learning`   | Write a new learning                                |
| `update_learning` | Modify an existing learning's content or confidence |
| `get_schedule`    | List cron jobs and their last run times             |
| `check_health`    | Get current browser and tool health status          |

### Skill Management Tools

| Tool            | Description                                    |
| --------------- | ---------------------------------------------- |
| `skill_list`    | List all skills with enabled/disabled status   |
| `skill_read`    | Read the full content of a skill file          |
| `skill_create`  | Create a new skill file + register in manifest |
| `skill_update`  | Edit an existing skill file                    |
| `skill_enable`  | Enable a skill in the manifest                 |
| `skill_disable` | Disable a skill in the manifest                |
| `skill_delete`  | Remove a skill file and manifest entry         |

### Workflow Management Tools

| Tool               | Description                                       |
| ------------------ | ------------------------------------------------- |
| `workflow_list`    | List all workflows with status and schedules      |
| `workflow_read`    | Read full workflow content                        |
| `workflow_create`  | Create a new workflow file + register in manifest |
| `workflow_update`  | Edit an existing workflow                         |
| `workflow_enable`  | Enable a workflow in the manifest                 |
| `workflow_disable` | Disable a workflow in the manifest                |
| `workflow_delete`  | Remove a workflow file and manifest entry         |
| `workflow_run`     | Manually trigger a workflow                       |

---

## 14. Build Plan

### Phase 1: Foundation (MVP)

**Goal:** ClawPilot runs as a daemon, you can talk to it via REPL and CLI, it can use skills and execute workflows, and it stores history. Browser tools are available with clear health reporting.

#### Step 1: Project Scaffold

- Bun workspace with `core` and `clawpilot-browser` packages
- Configuration schema and loader
- pm2 ecosystem config

#### Step 2: clawpilot-browser — Health & Auth

- Playwright browser manager with session persistence
- **Health check system**: verify Playwright installed, browser binaries present, session valid
- Auth flow (manual login in visible browser)
- JSON output format for all commands
- Clear error codes: `not_installed`, `session_expired`, `session_not_found`

#### Step 3: clawpilot-browser — Teams

- Teams: read messages from channels and chats
- **Teams search**: search channels and chats by keyword with date filters
- Teams: list channels, send messages

#### Step 4: clawpilot-browser — Outlook & Web

- Outlook: calendar queries (date, range)
- **Outlook search**: search mail by keyword, sender, date
- Outlook: read unread mail, send to self
- Web: DuckDuckGo search, page fetch with Readability

#### Step 5: Core Agent

- Copilot SDK client wrapper
- Soul loader (read markdown, inject into system prompt)
- **Health-aware tool registration**: register browser tools only when healthy, inform agent of degraded tools
- Basic REPL interface

#### Step 6: Skill System

- Skill discovery from `~/.agents/skills/`
- Manifest management (enable/disable)
- Skill loading into agent context (progressive, on-demand)
- Agent tools for skill CRUD
- Ship default skills: jira, confluence, gh

#### Step 7: Workflow System

- Workflow file loading from `~/.agents/workflows/`
- Manifest management
- Agent tools for workflow CRUD
- **Output routing**: desktop notification, log, stdout, file
- Ship default workflows: morning briefing, meeting prep, standup prep, weekly summary

#### Step 8: Scheduler & Catch-Up

- Cron scheduler
- Catch-up logic on startup (with health-aware degradation)
- Event-based triggers (before_meeting)
- Watermark tracking in SQLite

#### Step 9: Storage & Self-Improvement

- SQLite database setup with all tables
- Conversation history logging
- Learnings extraction (periodic reflection)
- Learnings injection into system prompt
- History search tool
- **Browser health logging**

#### Step 10: CLI Polish

- All CLI commands (daemon, auth, health, skill, workflow, soul, send, status)
- Non-interactive `clawpilot send` mode
- Local HTTP API for external control

### Phase 2: Intelligence & Polish

#### Step 11: Menubar App

- macOS SwiftUI `MenuBarExtra` app
- Status polling via HTTP API (including browser health)
- Quick actions (restart, auth, logs)

#### Step 12: Presence Engine

- Screen lock detection in menubar app
- Presence state machine (active/away/sleeping/DND)
- State-driven notification behaviour
- Debounce on transitions

#### Step 13: Self-Improvement v2

- Confidence scoring with reinforcement/contradiction
- Automatic learning retirement
- Agent-initiated soul updates (with confirmation)
- Pattern detection across conversations

#### Step 14: Robustness

- Graceful degradation when browser session expires mid-workflow
- Retry logic for transient failures
- Auto-recovery: periodic session health checks, proactive re-auth reminders
- Log rotation and cleanup

#### Step 15: Cross-Platform

- Windows tray app (Electron or native)
- Windows screen lock detection
- Cross-platform notification handling

### Future Enhancements (Not Planned)

- **Teams self-chat watcher**: Poll self-chat for commands, respond in Teams (enables mobile interaction)
- **Chrome DevTools MCP**: Connect to live Chrome instead of Playwright for zero-auth browser access
- **Multi-agent**: Spawn sub-agents for parallel tasks
- **Voice interface**: Speech-to-text input via macOS dictation

---

## Appendix A: Example Soul — Jarvis

```markdown
# Soul: Jarvis

## Identity

You are ClawPilot, a personal work assistant running on Giordano's laptop.
Your style is dry, concise, and occasionally witty — think British butler
who also happens to be very good with technology. You call him by name
when appropriate but don't overdo it.

## Communication

- Lead with the answer, then supporting detail
- Bad news first, good news second
- Short paragraphs, bullet points for 3+ items
- No emoji. No exclamation marks. Understated is better.
- If you don't know something, say so plainly

## Proactiveness

- Flag meeting conflicts and double-bookings immediately
- Before important meetings: prepare notes unprompted (via workflow)
- If you notice a repeated manual task, suggest creating a workflow

## Briefing Style

- Morning: action-oriented, 5-7 items max, grouped by priority
- Meeting prep: attendees with roles, agenda, relevant prior context,
  2-3 suggested talking points
- Weekly: achievements, open items, upcoming deadlines

## Tool Awareness

- If browser tools are unavailable, state it plainly:
  "I can't access Teams at the moment — the browser session needs
  re-authentication. Run `clawpilot auth login` to fix this."
- Don't apologise for tool limitations. Just state the fact and
  offer alternatives.
- If a skill CLI isn't installed, provide the exact install command.

## Boundaries

- Never send any message on behalf of the user without showing a draft
  and getting explicit "send it" confirmation
- Never accept, decline, or modify calendar events
- Never transition Jira tickets without confirmation
- Never create or modify Confluence pages without confirmation
- Web searches and reading/searching Teams/Outlook/Jira are fine autonomously
- File operations on the local machine require confirmation if destructive

## When Corrected

- Acknowledge briefly, don't over-apologise
- Extract the correction as a learning immediately
- Apply it going forward
```

## Appendix B: Example Workflow — Meeting Prep

```markdown
# Workflow: Meeting Prep

## Description

Automatically prepare notes before meetings. Checks attendees,
agenda, relevant history, and recent context to provide useful
preparation material.

## Trigger

event: before_meeting(10m)

## Catch-Up Policy

skip

## Skills Required

- gh (if meeting is about code review)
- jira (if meeting relates to sprint/tickets)
- confluence (if meeting has linked documents)

## Tools Required

- clawpilot-browser (outlook calendar, teams search)

## Output

desktop_notification + log

## Instructions

When this workflow fires for an upcoming meeting:

1. Get the meeting details from Outlook calendar:
   - Title, time, duration
   - Attendees (names and roles if known)
   - Description/agenda
   - Any attachments or links

2. Search conversation history for context:
   - Previous meetings with the same attendees
   - Topics related to the meeting title
   - Any recent discussions about the meeting subject

3. If the meeting title or description mentions Jira tickets:
   - Fetch current status of those tickets
   - Note any recent changes

4. If the meeting appears to be a recurring one:
   - Summarise what was discussed last time
   - Note any action items from the previous occurrence

5. Search Teams channels for recent discussions related to the
   meeting topic (use keyword search).

6. Compose preparation notes:

   **Meeting: [title]**
   **Time: [time] ([duration])**
   **Attendees: [names]**

   **Context:**
   [relevant background from history and tools]

   **Suggested Talking Points:**
   [2-3 points based on context]

   **Open Items:**
   [any unresolved items from previous meetings]

7. Send summary as desktop notification. Full detail to log.

## Notes

- Skip meetings titled "Lunch", "Focus Time", "Block", or similar
- For 1:1s, include recent interactions with that person
- For standup/daily meetings, defer to the standup-prep workflow
- If browser tools are unavailable, prepare with whatever is available
  (history, Jira, gh) and note what couldn't be checked
```

## Appendix C: Example Skill — GitHub (gh)

```markdown
# Skill: GitHub

## Description

Interact with GitHub repositories, pull requests, issues, and actions
using the GitHub CLI.

## Prerequisites

- gh CLI installed: `brew install gh`
- Authenticated: `gh auth login`

## Commands

### List my open PRs

`gh pr list --author @me --state open`

### View PR details

`gh pr view <number>`
Returns: title, status, reviewers, checks, diff stats.

### List PRs needing my review

`gh pr list --search "review-requested:@me"`

### Check PR CI status

`gh pr checks <number>`

### View recent commits

`gh api repos/{owner}/{repo}/commits --jq '.[0:5] | .[] | "\(.sha[0:7]) \(.commit.message | split("\n")[0])"'`

### List open issues assigned to me

`gh issue list --assignee @me --state open`

### View repo activity

`gh api repos/{owner}/{repo}/activity --jq '.[0:10]'`

### Check Actions workflow runs

`gh run list --limit 5`

### View a specific run

`gh run view <run-id>`

## When to Use

- Standup prep: recent commits and merged PRs
- PR review workflow: PRs awaiting review
- Morning briefing: any failed CI runs
- When user asks about PRs, commits, issues, or CI

## Notes

- Default repo is determined by current directory or can be specified with -R owner/repo
- For cross-repo queries, use `gh api` with the appropriate endpoint
- Rate limits apply — avoid rapid repeated calls
```
