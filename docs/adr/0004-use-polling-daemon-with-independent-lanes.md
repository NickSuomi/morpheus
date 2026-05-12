# ADR 0004: Use Polling Daemon With Independent Lanes

## Status

Accepted

## Context

Human operators may edit Beads labels directly. Morpheus must recover from missed events, restarts, and label drift.

A queue-based system would require another durable state source and reconciliation model.

## Decision

Use a polling daemon in v1.

Each tick reads Beads, derives state through `IssueStateMachine`, selects work through `LaneScheduler`, and executes work up to per-lane concurrency.

Lane capacities are independent. Default concurrency is `1` for preparation, implementation, and review.

## Consequences

Daemon behavior remains recoverable from Beads state.

No persistent queue is needed in v1.

Review and implementation lanes do not starve behind preparation work solely because of global ordering.
