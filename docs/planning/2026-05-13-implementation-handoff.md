# Handoff: Morpheus Implementation Start

## Focus For Next Session

Start implementation of `morph-u74`: **Scaffold Morpheus monorepo and CLI shell**.

Use TDD. Do not continue architecture planning unless the issue exposes a real missing decision.

## Current State

- Repo: `/Users/nicksuomi/sandbox/morpheus`
- Current branch: `main`
- Latest committed baseline:
  - `d009602 docs: establish Morpheus architecture baseline`
  - `362ec30 chore: add commit hook task`
  - `124accf docs: publish Morpheus implementation backlog`
- Beads issue `morph-u74` is already claimed/in progress because the previous turn was interrupted after claim.
- No scaffold/package files have been created yet.
- Working tree currently has Beads state from claiming `morph-u74` and handoff file changes.

## Read First

- `AGENTS.md`
- `docs/agents/issue-tracker.md`
- `CONTEXT.md`
- `ARCHITECTURE.md`
- `docs/product/PRD.md`
- Relevant ADRs in `docs/adr/`
- Beads issue: `bd show morph-u74`

Do not duplicate those docs in your prompt context beyond what is needed. They are source of truth.

## Required Skills

- `matt-pocock-tdd`
- `beads`
- `pnpm`

Use Matt Pocock TDD discipline:

- Plan behavior through public interfaces before code.
- Write one test, make it fail, implement only enough to pass, repeat.
- Tests should verify behavior, not implementation details.
- Refactor only while green.

Use Beads workflow:

- Run `bd prime` if context is stale.
- Inspect `bd show morph-u74`.
- Keep `morph-u74` in progress.
- Close only when acceptance criteria are actually met and verified.

## Issue To Implement

`morph-u74` acceptance criteria:

- pnpm workspace contains core, runtime, adapters, and cli packages.
- CLI package exposes a runnable `morpheus` command that prints help/version.
- Root and package scripts match architecture: build, typecheck, typecheck:fast, test, lint, format, and check.
- Core has no Effect dependency; runtime/adapters/cli may use Effect.
- tsdown, Vitest, `@effect/cli`, Effect, Effect Schema, oxlint/oxfmt, tsgo fallback strategy, and stable tsc typecheck are wired or documented in package scripts.
- Smoke verification proves CLI shell and workspace checks run.

## Suggested TDD Plan

Public interface for this slice is the repo scaffold as consumed by commands:

1. `pnpm --filter @morpheus/cli morpheus --help` or equivalent CLI invocation shows Morpheus help.
2. `pnpm --filter @morpheus/cli morpheus --version` shows package version.
3. `pnpm check` runs lint, stable typecheck, and tests.
4. A dependency-guard test proves `@morpheus/core` does not depend on Effect.

Start with one tracer test around CLI help. Then scaffold only enough to pass.

## Architecture Decisions Already Made

- TypeScript monorepo with packages: `core`, `runtime`, `adapters`, `cli`.
- Runtime/adapters/cli may use Effect; core stays pure TS.
- CLI framework: `@effect/cli`.
- Build: `tsdown`.
- Stable typecheck: `tsc --noEmit --incremental`.
- Fast optional typecheck: TypeScript 7 native `tsgo`.
- Validation: Effect Schema.
- Tests: Vitest and `@effect/vitest` where Effect services need it.
- Lint/format: `oxlint` and `oxfmt`.
- Package manager: pnpm.

## Watchouts

- Avoid overbuilding runtime behavior in this slice. No Beads adapter, ledger, config loader, or daemon implementation yet unless needed for the CLI shell.
- Do not use Morpheus `agent:*` labels on planning issues. Current implementation backlog uses `ready-for-agent,afk`.
- `.scratch/` is ignored; do not commit raw session transcript.
- Keep public vocabulary as Morpheus. Sandcastle only appears as adapter implementation detail later.

## Before Final Response

- Run relevant verification commands.
- Report exact commands run.
- If `morph-u74` is complete, close it with `bd close morph-u74 --reason "..."`
- Commit implementation changes separately from this handoff if changes are made.
