# Weekly Work Summary Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a repo-local weekly work summary workflow that gathers Monday-to-today activity from Teams, Jira, Confluence, and Copilot sessions, synthesizes a balanced summary, and publishes a dated Confluence page under the configured parent.

**Architecture:** Ship the first version as a project-local skill so the workflow can orchestrate existing tools without waiting on a new runtime. Strengthen the weakest source primitive first by adding a date-bounded Teams export command in `@clawpilot/browser`, then encode the end-to-end workflow in `.agents/skills/weekly-work-summary`. After the skill works reliably, add a thin repo-local extension that exposes a stable command surface but reuses the same workflow contract and avoids duplicating the source-specific rules.

**Tech Stack:** Project-local Copilot skill markdown, Copilot CLI extension, `@clawpilot/browser` Teams CLI, Jira CLI, Confluence CLI/API, Copilot `session_store` SQL, TypeScript, Commander, Vitest

---

### Task 1: Add a date-bounded Teams export primitive

**Files:**

- Modify: `packages/clawpilot-browser/src/teams.ts`
- Modify: `packages/clawpilot-browser/src/commands/teams.ts`
- Modify: `packages/clawpilot-browser/src/__tests__/teams.test.ts`
- Modify: `packages/clawpilot-browser/src/__tests__/teams-command.test.ts`
- Modify: `README.md`

**Step 1: Write the failing domain tests**

Add focused tests in `packages/clawpilot-browser/src/__tests__/teams.test.ts` for a new export helper that:

- accepts a `since` ISO date
- keeps only conversations with activity on or after `since`
- preserves direct chats, private/group chats, and channels in one normalized result
- returns stable JSON fields the workflow can summarize later

**Step 2: Run the targeted Teams tests and verify they fail**

Run:

```bash
pnpm --filter @clawpilot/browser test -- src/__tests__/teams.test.ts src/__tests__/teams-command.test.ts
```

Expected: FAIL because the export helper and command do not exist yet.

**Step 3: Implement the minimal Teams export logic**

In `packages/clawpilot-browser/src/teams.ts`, add a narrow helper such as `exportTeamsActivity()` that builds on the existing list/read primitives instead of duplicating fetch logic. Keep the output normalized and JSON-friendly so the workflow can group by conversation type and timestamp without screen-scraping.

**Step 4: Add a CLI subcommand**

In `packages/clawpilot-browser/src/commands/teams.ts`, add a new subcommand such as:

```bash
clawpilot-browser teams export --since 2026-03-23 --json
```

The command should:

- require `--since`
- default to JSON output for machine consumption
- keep the human-readable formatter thin if a text mode is added later

**Step 5: Update command tests**

Extend `packages/clawpilot-browser/src/__tests__/teams-command.test.ts` so the new command:

- parses `--since`
- prints JSON output
- forwards arguments into the domain helper
- surfaces errors without swallowing them

**Step 6: Run the targeted Teams tests and verify they pass**

Run:

```bash
pnpm --filter @clawpilot/browser test -- src/__tests__/teams.test.ts src/__tests__/teams-command.test.ts
```

Expected: PASS for the new export coverage.

**Step 7: Update usage docs**

Add the new Teams export command to `README.md` near the existing `teams list` / `teams read` examples.

**Step 8: Commit**

```bash
git add README.md packages/clawpilot-browser/src/teams.ts packages/clawpilot-browser/src/commands/teams.ts packages/clawpilot-browser/src/__tests__/teams.test.ts packages/clawpilot-browser/src/__tests__/teams-command.test.ts
git commit -m "feat: add Teams activity export command

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Add the repo-local weekly summary skill

**Files:**

- Create: `.agents/skills/weekly-work-summary/SKILL.md`
- Create: `.agents/skills/weekly-work-summary/references/source-checklist.md`
- Create: `.agents/skills/weekly-work-summary/references/page-template.md`
- Modify: `README.md`

**Step 1: Write the skill contract before workflow prose**

Create `SKILL.md` with:

- name, description, triggers, and scope metadata
- required inputs: date, parent page, time window, execution mode
- explicit source order: Teams, Jira, Confluence, Copilot sessions
- hard failure rule for missing auth or unavailable tools

Keep the skill as the single source of truth for the workflow contract.

**Step 2: Add the source checklist reference**

Create `.agents/skills/weekly-work-summary/references/source-checklist.md` with a concrete evidence checklist for each system:

- Teams: direct chats, group/private chats, channels, timestamps, links/ids
- Jira: assigned, updated, commented, transitioned tickets
- Confluence: created, edited, commented pages
- Copilot sessions: summary, files touched, refs, notable tasks

This reference should tell the executor what to collect, not how to improvise.

**Step 3: Add the page template reference**

Create `.agents/skills/weekly-work-summary/references/page-template.md` with the expected output structure:

- page title using today’s date
- narrative summary section
- evidence appendix grouped by Teams, Jira, Confluence, and Copilot
- explicit missing-source section if any collector fails

**Step 4: Encode the end-to-end workflow in the skill**

In `SKILL.md`, instruct the executor to:

1. derive Monday-to-today automatically
2. run `clawpilot-browser teams export --since <monday> --json`
3. query Jira CLI for tickets touched this week
4. query Confluence CLI/API for pages touched this week
5. query `session_store` for Copilot work this week
6. deduplicate overlapping evidence
7. publish the final page under `https://newdaycards.atlassian.net/wiki/x/DQFHbwE`

The skill should prefer links and ids over raw dumps and forbid invented evidence.

**Step 5: Add a README entry for the new project-local skill**

Document the skill in `README.md` near the existing project-local skill section.

**Step 6: Manual smoke-check the skill text**

Verify the skill can be loaded and read cleanly by checking:

- file names are correct
- references are linked correctly
- the default behavior matches the user decisions: balanced output, calendar week, full auto

**Step 7: Commit**

```bash
git add .agents/skills/weekly-work-summary README.md
git commit -m "feat: add weekly work summary skill

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Add a repo-local extension wrapper for command-style entry

**Files:**

- Create: `.github/extensions/weekly-work-summary.js`
- Modify: `README.md`

**Step 1: Inspect the Copilot extension authoring guide**

Run the extension guide first and follow its recommended file shape before writing code:

```bash
# use the extensions_manage tool with operation "guide"
```

Do not invent an extension format from memory.

**Step 2: Scaffold the extension**

Create `.github/extensions/weekly-work-summary.js` as a thin wrapper that:

- exposes a stable command-style entrypoint
- accepts optional overrides for parent page, date, and execution mode
- forwards into the same workflow contract as the skill

Keep the wrapper thin; policy stays in the skill contract.

**Step 3: Reload extensions and smoke-test discovery**

Run the extension reload flow and verify the new extension appears in the loaded extension list.

Expected: the extension is discoverable without runtime errors.

**Step 4: Manually exercise the wrapper in draft mode**

Run the extension with draft-only or dry-run inputs first and verify it:

- invokes the weekly summary workflow
- surfaces missing prerequisites clearly
- does not silently publish on failure

**Step 5: Update docs**

Add a short usage example to `README.md` once the final invocation syntax is known.

**Step 6: Commit**

```bash
git add .github/extensions/weekly-work-summary.js README.md
git commit -m "feat: add weekly work summary extension

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Verify the end-to-end weekly summary workflow

**Files:**

- Modify: `README.md`
- Modify: `.agents/skills/weekly-work-summary/SKILL.md`
- Modify: `.github/extensions/weekly-work-summary.js`

**Step 1: Verify source prerequisites explicitly**

Confirm each source is available before the full run:

```bash
node packages/clawpilot-browser/dist/index.js auth status --validate
jira --version
# run the Confluence CLI/API equivalent already configured on the machine
```

Expected: Teams session is valid, Jira is installed, and Confluence access is available.

**Step 2: Run a full draft collection pass**

Use the skill or wrapper to gather evidence without publishing first.

Expected: one balanced summary plus an appendix with evidence grouped by source.

**Step 3: Inspect the evidence for duplication and gaps**

Check that:

- the same ticket or page is not repeated across sections without explanation
- Teams evidence only includes conversations with meaningful participation
- Copilot session evidence points to concrete work, not generic session noise

**Step 4: Run the publish path**

Use the final full-auto mode and verify the page is created under the requested parent with today’s date in the title.

Expected: the new Confluence page exists and matches the draft structure.

**Step 5: Tighten wording or guardrails if verification uncovered ambiguity**

Make only the smallest updates needed in the skill or extension so future runs are deterministic.

**Step 6: Run repo verification**

Run:

```bash
pnpm check:ts-guidelines
pnpm lint
pnpm build
pnpm test
```

Expected: PASS across the repo before opening a PR.

**Step 7: Commit**

```bash
git add README.md .agents/skills/weekly-work-summary .github/extensions/weekly-work-summary.js
git commit -m "docs: finalize weekly work summary workflow

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Open the PR and finish the branch cleanly

**Files:**

- No code changes expected unless review feedback requires them

**Step 1: Open or update the PR**

Push the branch and open a PR that explains:

- why the workflow is skill-first
- what the Teams export command adds
- how the extension wraps the same contract

**Step 2: Request Copilot review if needed**

If Copilot review was not requested automatically, request it explicitly.

**Step 3: Address review comments one by one**

Reply to each review comment with the resolution or rationale after making any needed changes.

**Step 4: Re-run verification after review changes**

Run the relevant targeted tests plus:

```bash
pnpm lint && pnpm build && pnpm test
```

Expected: PASS before merge.
