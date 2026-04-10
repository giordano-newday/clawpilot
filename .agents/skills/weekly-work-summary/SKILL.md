---
name: weekly-work-summary
description: Use when preparing or publishing a weekly work summary page from workplace systems and Copilot activity, especially when the report must gather evidence across Teams, Jira, Confluence, and Copilot sessions for the current work week.
---

# Weekly Work Summary

## Overview

Build one evidence-backed weekly summary page for the current work week. Treat this skill as the workflow contract: follow the required inputs, source order, failure rules, collection steps, deduplication rules, and publishing target exactly.

Never invent evidence, outcomes, or completion claims. If a source cannot be reached, stop the workflow and report the blocking failure instead of producing a polished partial summary.

## When to Use

Use this skill when the task is to prepare or publish a weekly work summary from workplace evidence.

- Use it when the summary must cover the current work week.
- Use it when evidence must be gathered across Teams, Jira, Confluence, and Copilot sessions.
- Use it when the summary will be published to the weekly summary parent page or prepared in that publish-ready format.

Do not use this skill for ad hoc status notes, one-source summaries, or rolling-window activity reports unless the caller explicitly changes the contract.

## Scope

This skill covers:

- deriving the calendar-week window,
- collecting evidence in the required source order,
- deduplicating overlapping items,
- drafting the summary in the required page structure,
- publishing only when the selected execution mode allows it.

This skill does not allow invented evidence, soft-failed collection, or publishing a partial page after a required collector fails.

## Required Inputs

Capture these inputs before collecting evidence:

| Input          | Requirement                                                                                                                           | Default                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Date           | Use today's local date for the page title and week boundary calculation.                                                              | Today                                              |
| Parent page    | Publish under the weekly summary parent page.                                                                                         | `https://newdaycards.atlassian.net/wiki/x/DQFHbwE` |
| Time window    | Calendar week only, not rolling days.                                                                                                 | Monday-to-today                                    |
| Summary style  | Choose the narrative detail level for the final write-up.                                                                             | Balanced output                                    |
| Execution mode | Accepted values: `Full auto publish` or `Draft only`. Use `Draft only` to stop before publish and return the gathered draft/evidence. | Full auto publish                                  |

If the caller does not override the inputs above, use those defaults exactly.

Default synthesis behavior is balanced output unless the caller explicitly asks for a shorter or more detailed summary.

## Source Order

Collect and synthesize evidence in this order, and do not reorder it during analysis:

1. Teams
2. Jira
3. Confluence
4. Copilot sessions

Use earlier sources to anchor what happened and later sources to fill gaps or add implementation detail. Do not let Copilot or git-style implementation detail lead the narrative when stronger workplace evidence exists upstream.

## Hard Failure Rules

Stop immediately and report a hard failure when any required authentication, CLI, API, or database access is missing or unavailable.

- Do not soft-fail.
- Do not publish a partial page.
- Do not write a polished narrative around incomplete evidence.
- Do not guess what missing sources would have shown.

Examples of hard failures:

- Teams export requires authentication and the browser session is invalid.
- Jira CLI access is unavailable.
- Confluence CLI or API access is unavailable.
- `session_store` cannot be queried for Copilot activity.
- The publish target cannot be opened or updated.

## Collection Workflow

### 1. Derive the time window

Derive the calendar week automatically:

- Find the Monday for today's local date.
- Use Monday through today inclusive.
- Never substitute a rolling 7-day window unless the caller explicitly overrides the time window.

### 2. Collect evidence in source order

#### Teams

Run:

```bash
clawpilot-browser teams export --since <monday> --json
```

Use Teams as the primary activity anchor for meetings, call follow-ups, decisions, coordination, and shared progress updates.

#### Jira

Query the Jira CLI for tickets touched during the same Monday-to-today window. Prefer issues with explicit evidence of progress such as status changes, comments, worklogs, transitions, or updated fields.

#### Confluence

Query the Confluence CLI or API for pages touched during the same Monday-to-today window. Prefer pages you edited, commented on, or materially advanced.

#### Copilot sessions

Query `session_store` for Copilot work during the same Monday-to-today window. Use it to recover implementation detail, commands, files, branches, or checkpoints that support the story from workplace systems.

### 3. Validate and deduplicate

Deduplicate overlapping evidence before writing the summary:

- Merge the same work item seen in Teams, Jira, Confluence, and Copilot into one activity.
- Prefer the strongest evidence source in the required order.
- Keep supporting links from secondary sources in the appendix instead of counting them as separate accomplishments.
- Avoid double-counting a ticket, meeting, or document that appears in multiple systems.

### 4. Synthesize conservatively

Default to balanced output:

- Summarize the week in a concise narrative, with enough detail to be useful but without raw dumps.
- Prefer links, ticket ids, page ids, chat ids, and session ids over pasted transcripts or large payloads.
- Only claim outcomes that the collected evidence supports.
- If the evidence is ambiguous, describe the work neutrally instead of overstating impact.

### 5. Publish

Execution mode controls the final step. Accepted values are `Full auto publish` and `Draft only`.

- `Full auto publish`: publish the final page under `https://newdaycards.atlassian.net/wiki/x/DQFHbwE`.
- `Draft only`: stop before publish and return the gathered draft plus evidence appendix for review instead of updating Confluence.

Use the structure from `references/page-template.md`. Use the evidence checks from `references/source-checklist.md` before publishing or returning the draft.

## Evidence Rules

- Never invent evidence.
- Never infer completion from intent alone.
- Never convert tentative discussion into shipped work.
- Never turn a draft, TODO, or exploration session into a finished result without corroboration.
- Prefer links and ids over raw dumps.
- Keep raw source material out of the narrative unless a short quote is essential.

## Output Contract

The final page must include:

- A title using today's date.
- A narrative summary section.
- An evidence appendix grouped by Teams, Jira, Confluence, and Copilot.
- An explicit missing-source section if any collector fails before publish.

If any required collector fails, report the failure and do not publish.

## References

- Source checks: `references/source-checklist.md`
- Page structure: `references/page-template.md`

## Common Mistakes

| Mistake                                | Required behavior                                                     |
| -------------------------------------- | --------------------------------------------------------------------- |
| Using the last 7 days                  | Always derive Monday-to-today unless the caller overrides the window. |
| Letting Copilot lead the story         | Use Teams, then Jira, then Confluence, then Copilot sessions.         |
| Soft-failing on missing auth/tools     | Treat missing auth or unavailable tooling as a hard failure and stop. |
| Counting the same work twice           | Merge overlapping evidence into one activity with source links.       |
| Writing confident claims without proof | Keep only evidence-backed statements and note ambiguity honestly.     |
