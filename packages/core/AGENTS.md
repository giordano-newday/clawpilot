# AGENTS.md

Inherit `/AGENTS.md`.

## Package-specific instructions

- This package is the orchestration core, not a grab bag.
- Centralize cross-cutting policy here when it truly belongs to the whole agent: session setup, tool registration, memory, scheduling, soul loading, and prompt assembly.
- Do not re-implement browser-specific behavior here; depend on `@clawpilot/browser` through clear interfaces instead.
- Prefer stable contracts over convenience duplication. Shared types, state models, and workflow schemas should have one home.
- Keep future subsystems sharply separated: soul, skills, storage, workflows, HTTP API, and runtime lifecycle should each own their boundary.
