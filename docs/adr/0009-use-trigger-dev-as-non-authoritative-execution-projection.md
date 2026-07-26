# ADR 0009: Use Trigger.dev as a Non-Authoritative Execution Projection

## Status

Rejected for product adoption after completed spike

This ADR records the technically supported prototype architecture. The final
product decision is not to merge or ship it. Trigger.dev reduced neither
operator noise nor context fragmentation, imposed vendor retention and tariff
constraints, exposed wrapper-specific infrastructure, and could not provide
Morpheus-native controls. The branch and deployed task remain non-production
research and visual references for a Morpheus-owned dashboard prototype.

## Context

Operators need a remote view of real Morpheus preparation, implementation, and
review runs. Trigger.dev does not document an API that creates an arbitrary
external run or lets an external system set that run's terminal status. A run
is created by triggering a Trigger.dev task. The Runs API supports inspection,
cancel/replay/reschedule, metadata, and tags, but not external run ownership.

Moving Morpheus lanes into Trigger.dev tasks would transfer scheduling,
execution ownership, recovery, and source-of-truth state. That violates the
product boundary.

## Prototype Decision

Trigger.dev is an optional projection only:

- Morpheus commits each run mutation to its SQLite ledger first.
- A durable SQLite outbox creates one deployed observer task run for each real
  Morpheus lane run.
- The observer task waits on an explicit long-lived waitpoint. Morpheus replaces
  the run's metadata with bounded, redacted snapshots and completes the
  waitpoint after the Morpheus run becomes terminal.
- Preparation, implementation, and review appear as independent root runs,
  correlated by opaque HMAC identifiers and bounded tags. There is no synthetic
  Trigger.dev parent task.
- The observer task has one attempt, no GitLab or Morpheus credentials, no
  callback into Morpheus, and no ability to execute a lane.
- Morpheus never reads Trigger.dev state as a state-machine input. Trigger.dev
  cancel, replay, reschedule, and dashboard tests affect only the wrapper.
- If an active wrapper disappears or becomes terminal before Morpheus, the
  outbox creates a new projection generation.
- Observer delivery is fail-open. Outage never fails a Morpheus ledger
  mutation. Outbound requests have a bounded timeout. Restart reconciliation
  retries each pending row independently, continues past poisoned rows, and
  backfills the crash gap after ledger commit without projecting runs older
  than observer enablement.
- Delivery is serialized inside an observer process. The outbox retains only
  the latest full snapshot while offline, and sequence/generation guards prevent
  late acknowledgements from regressing newer state.
- The deployed observer validates opaque identifiers, curated enums, sequence
  numbers, and timestamps at runtime before using waitpoint output.
- Production uses deployed Trigger.dev Cloud tasks. `trigger dev` is never
  production infrastructure.

The external envelope contains only schema version, opaque target/issue/run
identifiers, lane, curated Morpheus state, ledger event sequence, timestamps,
bounded failure kind, and required human action. Titles, descriptions, source
URLs, raw logs, transcripts, repository paths, and credentials are excluded.

## Consequences

The prototype proved that Trigger.dev can remain isolated from authoritative
Morpheus execution. It is not a supported product integration and must not be
ported to `main` or configured as production infrastructure.

Trigger.dev remains useful for remote filtering and visual inspection, but its
run controls cannot be removed. Capability isolation, not UI policy, made
those controls harmless to Morpheus during the spike.

Trigger.dev wrapper status can temporarily disagree with Morpheus during an
outage. The local ledger and Beads remain authoritative. Native Trigger.dev
parent/child traces and external Morpheus log ingestion are not provided.

Useful layout references are the collapsible left navigation, central timeline,
collapsible or resizable right inspector, Overview/Detail/Context/Metadata tabs,
and export affordance. Morpheus information architecture and controls require a
separate prototype.

The composition depends on documented task triggering, replace-style metadata,
waitpoint completion, tags, and deployed tasks:

- <https://trigger.dev/docs/management/tasks/trigger>
- <https://trigger.dev/docs/management/runs/update-metadata>
- <https://trigger.dev/docs/management/waitpoints/create>
- <https://trigger.dev/docs/management/waitpoints/complete>
- <https://trigger.dev/docs/deployment/overview>
- <https://trigger.dev/docs/cli-dev-commands>
