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
- Validation: schema validation at config and contract boundaries
- Lint/format: `oxlint` and `oxfmt`, plus `tsc --noEmit`

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
  "prompts": {
    "prepare": ".morpheus/prompts/prepare.md",
    "implement": ".morpheus/prompts/implement.md",
    "review": ".morpheus/prompts/review.md"
  }
}
```

`prompts` entries are optional. Missing prompt paths use built-in defaults.

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

## Issue State

Beads labels are source of truth for issue state. Morpheus ledger mirrors what Morpheus attempted and observed.

`IssueStateMachine` computes pure transition plans. `IssueTracker` applies those plans to Beads. Runtime code never directly hand-edits `agent:*` labels.

Multiple active `agent:*` labels fail closed with `failureKind: state_conflict`.

## Scheduler

Daemon v1 uses polling ticks:

- query Beads each tick
- derive issue state through `IssueStateMachine`
- select runnable work through `LaneScheduler`
- execute per-lane capacity

No persistent queue in v1.

Each lane has independent concurrency. Default is `1` per lane. Work ordering inside each lane: priority, then date, then issue ID.

## Agent Runner

Runtime depends on `AgentRunner` port.

Early slices use `FakeAgentRunner` to produce realistic typed results and transcript artifacts. Real `SandcastleAgentRunner` arrives later as adapter work.

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

- Exact package manager scripts and build tool.
- Exact schema validation library placement.
- Exact Beads command/API surface.
- Whether reconciliation lane is explicit in v1 or internal to daemon tick.
- Retention/prune schema details.
