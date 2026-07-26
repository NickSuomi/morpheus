# Trigger.dev Execution Dashboard Spike

## Outcome

The NIC-113 spike is complete and rejected for product adoption.

Trigger.dev can safely display redacted observer wrappers for real Morpheus
lane runs without becoming authoritative. That technical result does not make
it a suitable Morpheus operator dashboard.

The observer implementation remains on its prototype branch and the deployed
Cloud project remains a remote reference. Neither is shipped, supported, or
required by Morpheus.

## Question Tested

Can Trigger.dev provide the complete remote Morpheus operator experience while:

- GitLab owns intent, review, and human merge;
- Morpheus owns scheduling, workers, state, recovery, and truth;
- Trigger.dev remains a visual projection only;
- Trigger.dev controls cannot alter Morpheus;
- private target data stays local;
- no Morpheus-specific UI is built?

## What Was Built

The spike implemented the smallest officially supported topology:

```text
GitLab intent
    |
    v
Morpheus daemon -> local Beads and SQLite -> local Morpheus worker
    |
    +-- durable fail-open outbox
            |
            +-- Trigger.dev observer wrapper
                    |
                    +-- wait for Morpheus terminal state
```

One deployed Trigger.dev root task represented each real preparation,
implementation, or review run. Morpheus wrote truth first, then projected a
bounded snapshot through an idempotent task and waitpoint pair.

The remote envelope contained only opaque target, issue, and run identifiers;
lane; curated state; event sequence; timestamps; bounded failure kind; and
required human action. It excluded repository identity, issue text, GitLab
links, paths, transcripts, raw logs, exceptions, and credentials.

## What the Spike Proved

- A Trigger.dev outage does not stop Morpheus.
- Pending projection work survives daemon restart.
- Duplicate delivery and lost responses do not duplicate authoritative work.
- Wrapper cancel, failure, deletion, replay, and timeout do not change
  Morpheus.
- A replacement projection generation can recover a terminated wrapper.
- Preparation, implementation, and review can be correlated with opaque tags.
- Private-data redaction is possible.
- Production uses a deployed task; `trigger dev` is unnecessary and unsuitable
  for production.

## Product Mismatch

The dashboard shows Trigger.dev's wrapper model rather than the operator's
Morpheus model.

| Operator need                  | Trigger.dev spike result                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| One concise issue view         | Separate root wrappers joined by opaque tags                                       |
| Full task context              | Split across GitLab, local ledger, payload, metadata, and output                   |
| Real execution trace           | Observer waitpoint trace only                                                      |
| Morpheus queue and concurrency | Trigger wrapper queue and machine fields                                           |
| Morpheus controls              | Vendor controls affect only the wrapper                                            |
| Durable remote history         | Plan-dependent query and log retention                                             |
| Low-noise operational view     | Vendor tasks, deploys, regions, compute, TTL, attempts, and billing remain visible |
| Direct issue and MR navigation | Excluded by the redaction boundary and not provided by the implemented projection  |

Adding more projection data would increase privacy risk and duplication without
making Trigger.dev authoritative. Adding a command bridge would violate the
accepted ownership boundary.

## Visual Reference to Retain

The following layout ideas are useful inputs for a Morpheus-owned design:

- collapsible global navigation on the left;
- a primary run timeline in the center;
- a collapsible and resizable inspector on the right;
- Overview, Detail, Context, and Metadata tabs;
- compact lifecycle timing and status;
- export access near the detailed run surface.

The next prototype must replace Trigger.dev's information architecture with:

- issue and Draft MR identity;
- Agent-Ready Contract;
- preparation, implementation, and review as one understandable story;
- real Morpheus events and agent evidence;
- verification and review findings;
- required human action;
- explicit authority and recovery state;
- safe Morpheus-native controls, defined separately.

## Artifact Retention

- The implementation branch is retained as a code-level spike.
- The deployed Trigger.dev project is retained as a remote visual reference.
- Authenticated screenshots and generated UI prototypes remain outside public
  Morpheus git.
- No private target names, URLs, paths, credentials, or target-specific
  signoff evidence are committed.

## Final Verdict

Trigger.dev was valuable as a capability and layout spike. It is not the
Morpheus execution dashboard.

Continue with a separate interactive HTML prototype for a Morpheus-owned
operator UI. Do not port the Trigger.dev observer integration into `main`.

Architecture decision:
[ADR 0009](../adr/0009-reject-trigger-dev-as-morpheus-execution-dashboard-after-spike.md).
