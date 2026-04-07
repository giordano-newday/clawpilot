# Source Checklist

Use this checklist before synthesis. Capture concrete evidence, not impressions.

## Teams

- Confirm Teams access is authenticated before export.
- Export activity for the derived Monday-to-today window with `clawpilot-browser teams export --since <monday> --json`.
- Record the chat id, channel id, or meeting thread id for each item used.
- Capture message permalinks or thread links when available.
- Note meeting titles, thread topics, timestamps, and participants only when they directly support the summary.
- Mark whether the item shows coordination, decision-making, status reporting, or follow-up actions.
- Exclude casual chatter that does not support a work claim.

## Jira

- Confirm Jira CLI access works before collecting issues.
- List tickets touched in the Monday-to-today window.
- Record the ticket key for each item used.
- Capture evidence type for each ticket: transition, comment, worklog, assignee change, field update, or linked PR/update.
- Keep direct links to the issue and, where possible, the specific activity that proves it was touched this week.
- Note the current status only if it is relevant to the summary.
- Do not treat ticket assignment alone as proof of substantive work.

## Confluence

- Confirm Confluence CLI or API access works before collecting pages.
- List pages touched in the Monday-to-today window.
- Record the page title and page id for each item used.
- Capture direct page links and note whether the evidence is an edit, comment, new page, or material revision.
- Keep a short note about what changed only when it is visible from the page history or page content.
- Do not count passive page views or unchanged drafts as work evidence.

## Copilot Sessions

- Confirm `session_store` is queryable before collecting Copilot evidence.
- Query sessions in the same Monday-to-today window.
- Record the session id for each item used.
- Capture concrete artifacts such as changed file paths, branch names, PR refs, commands, checkpoints, or explicit task summaries.
- Link Copilot evidence back to the Teams, Jira, or Confluence item it supports whenever possible.
- Use Copilot to add implementation detail, not to replace stronger workplace evidence.
- Do not claim outcomes that appear only as plans, drafts, or assistant speculation.

## Cross-Source Deduplication

- Group evidence by underlying work item before writing.
- Merge the same work across sources into one summary point.
- Prefer source authority in this order: Teams, Jira, Confluence, Copilot sessions.
- Keep secondary-source links in the appendix instead of duplicating the accomplishment in the narrative.
- If two sources disagree, keep the claim at the lowest evidence-backed level and note the ambiguity.
- If a source is missing, report it explicitly instead of filling the gap with inference.
