# TypeScript engineering guidelines

This repository is still early, which is exactly when good TypeScript habits matter most. These guidelines are intended to keep the codebase robust, maintainable, and elegant while it is still small enough to shape deliberately.

They combine general TypeScript engineering advice with repository-specific conventions already used in Clawpilot.

## Core principles

### 1. Keep modules focused

- Prefer small modules with one clear reason to change.
- Use named exports by default.
- Avoid default exports in source modules.
- Keep public module APIs small and intentional.
- If the same logic appears in multiple places, extract a shared helper instead of copying it again.

### 2. Keep boundaries explicit

- Be explicit at module boundaries: exported functions, command handlers, parsers, and public helpers should have clear parameter and return types.
- Let TypeScript infer obvious local variables inside small scopes, but do not rely on inference to define public contracts.
- Model invalid states explicitly with unions, nullable types, and type guards instead of relying on convention.

### 3. Prefer safe types over convenient types

- Do not use `any` in normal application code.
- Prefer `unknown` plus narrowing when input is genuinely dynamic.
- Avoid double assertions such as `as unknown as T`.
- Reuse shared shapes and utility types instead of inventing one-off near-duplicates.

### 4. Make dependencies obvious

- Keep imports directional and boring.
- Inside package source trees, do not use relative imports between source modules; import through the package alias instead.
- Avoid hidden coupling between features. If two modules share policy or validation rules, centralize the rule rather than duplicating it.

### 5. Be strict about error handling

- Do not swallow errors silently.
- Avoid broad catch blocks unless they are truly best-effort and documented locally.
- When an operation can fail in expected ways, return a clear result shape or surface a precise error.
- Add context to errors at boundaries instead of losing the original cause.

### 6. Optimize for changeability

- Prefer straightforward code over clever code.
- Avoid deep nesting, nested ternaries, and large mixed-responsibility files.
- Delete dead code and obsolete paths instead of preserving parallel variants.
- Keep comments for intent and trade-offs, not line-by-line narration.

### 7. Keep tests and docs close to behavior

- When behavior changes, update tests and directly related documentation.
- Test parsing, validation, and branching logic close to where it lives.
- Prefer fast feedback on changed files locally and full verification before pushing.

## Repository-specific rules

These are especially important in Clawpilot:

- Use package-root imports inside packages, not `./...` or `../...`.
- Reuse shared browser helpers, output helpers, and path helpers before creating new ones.
- Keep command modules thin.
- Keep policy centralized.
- Prefer editing existing primitives over adding parallel implementations.

## How the repository enforces this

The repository uses two layers of enforcement:

### Existing automated checks

- `eslint`
- `typescript-eslint` strict rules
- `lint-staged`
- package type checks and tests

### TypeScript guideline hook

The pre-commit hook now runs a repository-local TypeScript guideline checker on staged `.ts` and `.tsx` files.

It hard-fails on a deliberately objective subset of these rules:

- `@ts-ignore` and `@ts-nocheck`
- explicit `any` patterns in non-test files
- double assertions such as `as unknown as` in non-test files
- default exports in package source files
- relative imports inside `packages/*/src`
- `TODO`, `FIXME`, and `HACK` markers in changed TypeScript files

It also emits warnings for softer maintainability heuristics:

- large files
- many exports from one file
- nested ternaries
- empty catch blocks

Those warnings are intentionally advisory: they indicate code that deserves a second look, but they are not precise enough to be universal hard failures.

## Working rule of thumb

When writing TypeScript in this repo, aim for code that is:

- explicit at boundaries
- narrow in responsibility
- strict in typing
- boring in dependencies
- honest in error handling
- easy to change later

## Sources that informed these guidelines

These guidelines were informed by external TypeScript engineering recommendations and adapted to Clawpilot's current architecture:

- Feature-Sliced Design — TypeScript architecture guidance: <https://feature-sliced.design/blog/typescript-architecture-tips>
- Project Rules — TypeScript coding standards: <https://www.projectrules.ai/rules/typescript>
- Bacancy — TypeScript strictness and maintainability practices: <https://www.bacancytechnology.com/blog/typescript-best-practices>
- Syskool — Husky + lint-staged for TypeScript monorepos: <https://syskool.com/setting-up-pre-commit-hooks-husky-lint-staged-for-typescript-monorepos/>
- Samuel Lawrentz — enforcing coding standards with TypeScript, Husky, and lint-staged: <https://samuellawrentz.com/blog/coding-standards-husky-typescript-lint-staged/>
