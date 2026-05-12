# Morpheus

Morpheus is a local agent orchestration system for repo-based work.

Product principle:

> If it can't explain itself, it can't run.

## Current Status

Planning and architecture phase.

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

## Next Workflow

1. Finish architecture grill open questions.
2. Prototype disputed state/ledger/scheduler logic if needed.
3. Re-run issue slicing from `docs/product/PRD.md` and `ARCHITECTURE.md`.
4. Implement approved slices with TDD.
