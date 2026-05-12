# ADR 0002: Use Beads As Issue State And GitLab MRs As Review Artifacts

## Status

Accepted

## Context

Morpheus needs a durable issue state source and a human review surface. The PRD requires Beads to remain source of truth for issue state and GitLab MRs to carry human review context.

Using GitLab issue comments as lifecycle state would spread runtime state across comments and weaken operator observability.

## Decision

Beads owns issue state and contract metadata.

GitLab MRs are curated review artifacts. Morpheus creates and updates Draft MRs through a runtime-owned `glab` adapter.

Agents never run `glab`. Morpheus never auto-merges.

## Consequences

Schedulers derive runnable work from Beads labels.

MR descriptions can focus on contract, evidence, verification, risk, findings, and human checklist.

Raw transcripts remain local in Morpheus artifacts.

Auth/access failures in MR operations become runtime failures with `failureKind: operator_access`.
