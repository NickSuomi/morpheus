# ADR 0007: Use External Work Sources As Operator Surface

## Status

Proposed

## Context

Morpheus originally treated Beads as the issue state source of truth and GitLab
labels as a lifecycle mirror. Real ALPHA operation showed a poor day-2 operator
experience: operators work in GitLab, not Beads; merge requests, labels, CI
state, closed attempts, and local Beads/ledger history can drift; and a task can
be impossible to understand without reading private local state.

Morpheus still needs private durable working state for scheduling, contracts,
lane handoff, and run history. External systems still need to remain replaceable
because GitLab is one work source, not the Morpheus domain model.

## Decision

Treat external work sources, such as GitLab, as operator surfaces and sources of
operator intent.

Treat Beads as Morpheus private working state, not an operator-facing surface.
Operators should not need to edit Beads during normal work.

GitLab issue labels are split into two roles:

- the configured ready label is an ingestion signal;
- lifecycle labels are Morpheus-owned mirror output for visibility.

After implementation starts, explicit MR command comments are the command
surface. Morpheus only acts on commands from allowlisted users.

Initial MR commands are `fix`, `rerun`, `restart`, `stop`, `resume`, and `sync`.

Morpheus-owned MR labels provide filtering and status:

- `morpheus`
- `morpheus:active`
- `morpheus:review-candidate`
- `morpheus:failed`
- `morpheus:superseded`
- `morpheus:done`
- `morpheus:closed`

Morpheus MRs include a durable status block with source issue, current state,
latest run id, active command, pipeline status, review verdict, last failure,
next valid commands, and superseded attempt links when relevant.

Morpheus should be able to reconstruct operator-facing issue/MR state from the
external work source, MR descriptions, MR labels, and branch naming. Raw logs and
transcripts may remain local-only.

Closed unmerged work is not automatically failed. Merged work becomes
`agent:done`; closed unmerged work becomes `agent:closed` unless it was
superseded by a Morpheus restart.

## Consequences

Beads remains useful for local scheduling and lane handoff, but cannot be the
only recoverable record of operator-facing status.

`agent:ready` added to an already-managed issue is treated as operator confusion,
not a lifecycle command. Morpheus reconciles labels back to the current internal
state and points the operator to explicit MR commands.

Morpheus must add reconciliation that discovers MRs from source issue metadata,
branch naming, MR labels, and MR descriptions even when local Beads/ledger links
are missing.

MR command processing can be added incrementally. The first ALPHA follow-up is
passive reconciliation and status, then command comments.
