# Morpheus

Morpheus is a local agent orchestration system for repo-based work.

Product principle:

> If it can't explain itself, it can't run.

## Current Status

Initial monorepo scaffold and CLI shell are in place.

Read in order:

1. `docs/product/PRD.md`
2. `CONTEXT.md`
3. `ARCHITECTURE.md`
4. `docs/adr/`
5. `docs/agents/`

## Issue Tracking

This repo uses local Beads:

```bash
bd ready
bd list
bd show <id>
```

Prefix: `morph`.

## Development

```bash
pnpm install
pnpm --filter @morpheus/cli morpheus --help
pnpm --filter @morpheus/cli morpheus --version
pnpm check
pnpm typecheck:fast
```

`pnpm typecheck:fast` builds package declaration outputs first, then runs
per-package `tsgo --noEmit`. This keeps workspace package imports resolvable
while TypeScript native workspace resolution is still being proven.

## Commit Message Hook

Install the local `commit-msg` hook without Node package scaffolding:

```bash
git config core.hooksPath .githooks
```

The hook runs `scripts/validate-commit-msg.sh` and validates commit subjects:

```txt
<type>: <imperative summary>
```

Allowed types: `docs`, `feat`, `fix`, `refactor`, `test`, `chore`, `spike`,
`decision`. Keep the subject at or below 72 characters. Merge and revert commits
are accepted.

## Next Workflow

1. Implement approved Beads slices with TDD.
2. Keep package boundaries aligned with `ARCHITECTURE.md`.
