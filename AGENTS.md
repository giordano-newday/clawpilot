# AGENTS.md

## High-level instructions

- Be merciless about abstraction and avoiding duplication.
- When the same logic, shape, workflow, or constant appears more than once, strongly prefer extracting or centralizing it instead of copying it again.
- Do not introduce one-off variants of existing patterns when a shared helper, utility, or module is the cleaner design.
- Keep abstractions honest and small: extract for real reuse and clarity, not for indirection on its own.
- Prefer one authoritative implementation of each behavior. If two places need the same thing, stop and design the shared seam first.
- Default to editing existing primitives before adding new ones. Reach for shared helpers, utilities, config, and schemas before inventing parallel paths.
- Keep policy centralized. Validation rules, output shapes, paths, browser launch behavior, and workflow conventions should live in one place each.
- Make the easy path the correct path: good abstractions should remove choices, not multiply them.
- Be strict about generated artifacts and ownership boundaries:
  - hand-written source belongs in `packages/*/src`, `scripts/`, and `docs/plans`
  - generated output belongs in `dist`, `coverage`, and `docs/reports`
  - do not hand-edit generated artifacts unless the task explicitly requires it
- Prefer deleting dead code or obsolete variants over preserving duplicated legacy paths.
- Never use relative imports between source modules inside a package. Import through the package root alias instead (for example `@clawpilot/browser/...`), not `./...` or `../...`.
- When adding local instructions in nested `AGENTS.md` files, inherit this file and only add directory-specific guidance. Do not restate the same global rules with different wording.

## Repository-wide conventions

- Package names, paths, and CLI names stay lowercase (`clawpilot`); human-facing product naming is `Clawpilot`.
- Keep `auth login` visible for manual sign-in. Background/non-login browser work should stay unobtrusive by default.
- Reuse existing helpers for browser state, output formatting, and window behavior before adding new browser utilities.
- If a new module needs its own `AGENTS.md`, keep it short, specific, and additive to this root file.
