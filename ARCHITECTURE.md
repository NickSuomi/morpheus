# Morpheus Architecture

## Status

Initial architecture brief. Derived from `docs/product/PRD.md` and architecture grill decisions.

## System Shape

Morpheus is a TypeScript monorepo with a hybrid runtime:

- CLI commands for operator use and one-shot workflows.
- Daemon command for polling Beads and running lane scheduler loop.
- Shared runtime use-cases used by both CLI and daemon.

Morpheus operates against a target repository. The target repo contains `morpheus.config.json`; runtime artifacts default under `.morpheus/`.

## Monorepo Packages

```txt
packages/
  core/
  runtime/
  adapters/
  cli/
```

### `packages/core`

Pure TypeScript only. No Effect dependency.

Owns:

- `IssueStateMachine`
- `LaneScheduler`
- `AgentReadyContract` schema/domain types
- `ReviewArtifact` model/rendering types
- pure transition and scheduling decisions

### `packages/runtime`

Effect-based orchestration.

Owns:

- use-cases: prepare issue, start implementation, record implementation result, review run, show status, show slice, doctor
- Effect service contracts for effectful ports
- daemon loop
- transaction boundaries across runtime services where needed

Runtime service contracts:

- `IssueTracker`
- `MergeRequestClient`
- `RunLedger`
- `AgentRunner`
- `WorkspaceRuntime`
- `Clock`

Effectful ports are owned by runtime. Concrete adapters must not leak vendor command shapes into use-cases.

Runtime ports are Effect service contracts. Each port is declared in `packages/runtime` as a `Context.Tag` service whose methods return `Effect` values, with typed failures for recoverable conditions. Adapters expose concrete implementations as `Layer`s, using `Layer.effect` when construction depends on another service and `Layer.succeed` for fakes in tests. Adapters map vendor, SQL, filesystem, and process failures into runtime error types. CLI commands, tests, and future daemon entry points provide adapter layers at the edge rather than wrapping runtime use-cases in Promises.

### `packages/adapters`

Concrete adapter implementations.

Owns:

```txt
src/
  beads/
  gitlab/
  sqlite-ledger/
  sandcastle/
  process/
  workspace/
```

Adapters satisfy runtime service contracts. Adapter package may contain private shared helpers. Split adapters into separate packages only after real independent reuse or versioning pressure appears.

### `packages/cli`

Thin command layer.

Owns:

- `@effect/cli` command definitions
- config path resolution
- terminal rendering
- running runtime programs

CLI must not duplicate runtime workflow logic.

## Stack

- Language/runtime: TypeScript on Node 22+
- Package manager/workspace: pnpm
- CLI: `@effect/cli`
- Effects/resources/errors: Effect in runtime, adapters, and CLI
- Tests: Vitest, plus `@effect/vitest` for Effect services
- SQLite: `@effect/sql-sqlite-node`
- Validation: Effect Schema at config and contract boundaries
- Lint/format: `oxlint` and `oxfmt`, plus `tsc --noEmit`
- Typecheck: prefer TypeScript 7 native `tsgo`; keep `tsc --noEmit --incremental` fallback until compatibility is proven

Root package scripts:

```json
{
  "scripts": {
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "typecheck:fast": "pnpm build && pnpm -r typecheck:fast",
    "test": "vitest run",
    "lint": "oxlint .",
    "format": "oxfmt --write .",
    "check": "pnpm lint && pnpm build && pnpm typecheck && pnpm test"
  }
}
```

Per-package scripts:

```json
{
  "scripts": {
    "build": "tsdown",
    "typecheck": "tsc --noEmit --incremental",
    "typecheck:fast": "tsgo --noEmit",
    "test": "vitest run"
  }
}
```

Stable `tsc` typecheck is default. Fast `tsgo` is opt-in until compatibility is proven. Root `check` runs lint, then build, then typecheck, then tests. Root `typecheck:fast` intentionally builds package outputs first because current native compiler workspace package resolution depends on each package's emitted declaration entrypoint.

## Effect Scope

Effect belongs at side-effect edges:

- process execution
- file system
- SQL
- config loading
- time
- logging
- daemon concurrency
- adapter errors/resources

Effect does not belong in pure core modules. Core modules remain deterministic functions and types.

## Config

Target repo root contains `morpheus.config.json`. Commands may accept `--config` override.

Initial shape:

```json
{
  "targetRepo": ".",
  "issueTracker": { "kind": "beads" },
  "mergeRequests": { "kind": "gitlab-glab" },
  "agentRunner": { "kind": "sandcastle" },
  "ledger": { "path": ".morpheus/ledger.sqlite" },
  "lanes": {
    "preparation": { "concurrency": 1 },
    "implementation": { "concurrency": 1 },
    "review": { "concurrency": 1 }
  },
  "verification": { "commands": [] },
  "retention": {
    "completedIntermediate": {
      "keepDays": 14,
      "keepLast": 100
    },
    "failed": "manual",
    "reviewCandidate": "until-mr-closed-or-manual",
    "active": "never"
  },
  "prompts": {
    "prepare": ".morpheus/prompts/prepare.md",
    "implement": ".morpheus/prompts/implement.md",
    "review": ".morpheus/prompts/review.md"
  }
}
```

`prompts` entries are optional. Missing prompt paths use built-in defaults.

Lane `concurrency` values are positive integers.

Commands touching target repo require valid config before side effects begin.

## Run Ledger

Run IDs use prefixed ULIDs:

```txt
run_<ulid>
```

Default artifact directory:

```txt
.morpheus/runs/run_<ulid>/
```

Ledger model is hybrid:

- `runs`: mutable current summary projection.
- `run_events`: immutable ordered audit trail.

Every run state change writes an event and updates summary in one SQL transaction.

`run_events` answers what happened. `runs` answers what is true now.

Terminal run states are immutable: finishing a run is valid only while its current summary status is `running`; attempts to finish `succeeded` or `failed` runs return a typed invalid-state failure and must not append terminal events or rewrite summary fields.

Artifact writes are ledger-coordinated: the adapter must verify the run exists before creating transcript or artifact files, then record the artifact event and path updates in SQL. If that SQL write fails, the adapter must best-effort remove files created by the failed write so `.morpheus/runs` does not accumulate orphan artifacts.

Retention/prune is in v1 and is operator-owned:

- `morpheus prune --dry-run`
- `morpheus prune --apply`

Prune never deletes Beads issues, never touches GitLab MRs, and never prunes active non-terminal runs. Prune keeps a tombstone summary in `runs` while deleting detailed events and local artifacts that policy allows.

Tombstone fields in `runs`:

- `pruned_at`
- `pruned_by`
- `prune_reason`
- `events_pruned_at`
- `artifacts_pruned_at`
- `artifact_bytes_deleted`

Pruned runs keep stable identity and coarse metadata: run ID, issue ID, lane, status, failure kind, start/end timestamps, MR ref, and branch. Prune clears transcript and detailed artifact paths. Detailed run events are replaced by one `RunPruned` event.

## Issue State

Beads labels are source of truth for issue state. Morpheus ledger mirrors what Morpheus attempted and observed.

`IssueStateMachine` computes pure transition plans. `IssueTracker` applies those plans to Beads. Runtime code never directly hand-edits `agent:*` labels.

Multiple active `agent:*` labels fail closed with `failureKind: state_conflict`.

The Beads adapter uses the `bd` CLI through `ProcessRunner`. It must prefer `bd --json` for machine-readable output and must not read Beads' Dolt/DB internals directly.

Planned issue state transitions must be applied as one Beads label-set mutation from `AgentStateTransitionPlan.finalLabels`, preserving non-agent labels and avoiding remove-then-add gaps.

`IssueTracker` v1 methods:

```txt
listRunnableIssues()
getIssue(issueId)
applyAgentState(issueId, transitionPlan)
writeContract(issueId, contract)
readContract(issueId)
```

Agent-Ready Contract is stored in Beads issue metadata, not markdown body prose:

```json
{
  "morpheus": {
    "contractVersion": 1,
    "agentReadyContract": {}
  }
}
```

The adapter uses `bd create/update --metadata` and `bd show --json` for this data.

## Scheduler

Daemon v1 uses polling ticks:

- query Beads each tick
- derive issue state through `IssueStateMachine`
- select runnable work through `LaneScheduler`
- execute per-lane capacity

No persistent queue in v1.

Each lane has independent positive integer concurrency. Default is `1` per lane. Work ordering inside each lane: priority, then date, then issue ID.

Reconciliation is internal daemon tick behavior in v1, not a public scheduler lane. It can become an explicit lane later if it gains independent scheduling needs.

## Agent Runner

Runtime depends on `AgentRunner` port.

`SandcastleAgentRunner` is the production adapter for `agentRunner.kind = "sandcastle"`. It resolves built-in Morpheus prompts or target-repo prompt overrides, calls the Sandcastle programmatic API, captures raw stdout as the transcript, and stores Sandcastle metadata in local run artifacts.

`FakeAgentRunner` remains a test/support adapter for deterministic runtime coverage.

Public vocabulary remains Morpheus. Sandcastle appears only in adapter implementation naming.

## Review Artifact

`ReviewArtifact` renders the full GitLab MR description from the current model each time.

Morpheus does not patch markdown sections. Morpheus does not use GitLab issue comments as lifecycle or evidence storage. Raw transcripts remain local.

## Initial Delivery Flow

1. Finalize this architecture brief and ADRs.
2. Prototype only disputed logic: issue state, ledger schema, scheduler, or CLI UX.
3. Re-run issue slicing from `docs/product/PRD.md` plus `ARCHITECTURE.md`.
4. Implement first approved issue with TDD.

## Open Questions

- Exact first prototype scope before re-running issue slicing.
