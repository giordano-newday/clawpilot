# AGENTS.md

Inherit `/AGENTS.md`.

## Directory-specific instructions

- Scripts should be small, composable, and boring.
- If two scripts share logic, extract a shared helper instead of copying utility code between entrypoints.
- Keep script responsibilities distinct:
  - report generation logic in dedicated helpers
  - badge logic in one place
  - history update logic in one place
- Prefer deterministic inputs/outputs over hidden side effects.
- Treat scripts as tooling, not as a second application layer; if logic becomes product behavior, move it into a package.
