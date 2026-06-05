# ADR 0002: Use Beads As Issue State And GitLab As Operator Surface

## Status

Accepted

## Context

Morpheus needs a durable issue state source, a human review surface, and enough GitLab visibility that an operator can understand and stop work without reading local Beads first. The PRD requires Beads to remain source of truth for issue state and GitLab MRs to carry human review context.

Using GitLab issue comments as lifecycle state would spread runtime state across comments and weaken operator observability.

## Decision

Beads owns issue state and contract metadata.

GitLab issue labels mirror Morpheus lifecycle state for imported issues. Morpheus reconciles GitLab labels with Beads on daemon ticks:

- `agent:ready` imports or requeues work when the Beads state is absent, blocked, or failed.
- active Beads `agent:*` state is written back to GitLab while stale lifecycle labels are removed.
- GitLab `agent:blocked`, `agent:failed`, and the stop control label defaulting to `agent:stop` are accepted as operator input and reflected into Beads before later lanes run.

GitLab MRs are curated review artifacts. Morpheus creates and updates Draft MRs through a runtime-owned `glab` adapter.

Agents never run `glab`. Morpheus never auto-merges.

## Consequences

Schedulers derive runnable work from Beads labels.

Operators can see and interrupt lifecycle from GitLab without making GitLab the authoritative scheduler state.

MR descriptions can focus on contract, evidence, verification, risk, findings, and human checklist.

Raw transcripts remain local in Morpheus artifacts.

Auth/access failures in MR operations become runtime failures with `failureKind: operator_access`.
