# AGENTS.md

Inherit `/AGENTS.md`.

## Package-specific instructions

- Keep this package focused on browser-facing capabilities only: auth, health, Teams/Outlook/web automation, and CLI wiring.
- Use package-root imports everywhere in this package: `@clawpilot/browser/...`. Do not use relative imports between files under `src/`.
- Reuse shared primitives aggressively:
  - JSON responses go through `src/utils/output.ts`
  - browser state paths go through `src/utils/paths.ts`
  - unobtrusive non-login browser behavior goes through `src/utils/window.ts`
- Do not duplicate Playwright launch/config logic across commands. If two flows launch Chromium the same way, extract or reuse the helper.
- Keep `auth login` visibly interactive. Non-login browser flows should default to unobtrusive windows.
- Prefer pure parsing/extraction helpers next to browser automation so unit-testable logic stays isolated from Playwright runtime behavior.
- Commander command modules should stay thin: parse input, call domain functions, shape output, nothing more.
- Avoid embedding policy strings, selectors, or validation rules in multiple command files; centralize them in the relevant module.
