# ADR 0003: Use Hybrid Run Ledger

## Status

Accepted

## Context

Operators need quick answers such as what is running now, which issue failed, and where transcripts live. They also need an ordered audit trail for debugging agent behavior.

Pure append-only event sourcing gives strong auditability but makes every CLI query reconstruct current state.

Mutable rows alone are simple but lose durable explanation.

## Decision

Use a hybrid SQLite ledger:

- `runs` stores current run summary.
- `run_events` stores immutable ordered events.

Every state change writes a `run_events` record and updates `runs` in one transaction.

Run IDs use `run_<ulid>`.

## Consequences

`runs` supports fast `status`, `runs`, and `run <id>` summaries.

`run_events` preserves the full timeline for `slice <issue-id>` and forensic inspection.

Tests must enforce event/summary consistency.
