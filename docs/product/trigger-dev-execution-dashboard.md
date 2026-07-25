# Trigger.dev Execution Dashboard

Trigger.dev can show real Morpheus lane runs remotely. It is optional and
non-authoritative: GitLab owns operator intent/review/merge; Morpheus owns
scheduling, execution, state, recovery, and truth.

## Deploy the observer

Use a reviewed Trigger.dev CLI and deploy `packages/trigger-observer`. Do not
run `trigger dev` for production.

```sh
cd packages/trigger-observer
export TRIGGER_PROJECT_REF=proj_example
trigger deploy \
  --project-ref "$TRIGGER_PROJECT_REF" \
  --profile operator-profile \
  --env prod
```

The deployed task ID is `morpheus-execution-observer-v1`. The task has no
GitLab or Morpheus credentials and makes no callback into Morpheus.

Create a production Secret API key in the Trigger.dev dashboard. Keep both
secrets in the daemon environment, never in target config:

```sh
export TRIGGER_SECRET_KEY=...
export MORPHEUS_TRIGGER_CORRELATION_SECRET=...
```

The correlation secret should be a stable random value for the target. Rotating
it changes the opaque identifiers used for future dashboard correlation.

## Configure a target

Add this optional block to `morpheus.config.json`:

```json
{
  "executionObserver": {
    "kind": "trigger-dev",
    "environment": "production",
    "taskIdentifier": "morpheus-execution-observer-v1",
    "secretKeyEnv": "TRIGGER_SECRET_KEY",
    "correlationSecretEnv": "MORPHEUS_TRIGGER_CORRELATION_SECRET",
    "waitpointTimeout": "4w",
    "idempotencyKeyTTL": "30d"
  }
}
```

Omit the block or use `{ "kind": "disabled" }` to disable projection. Configure
`apiUrl` only for an explicitly operated Trigger.dev API endpoint.

Start or restart the normal Morpheus daemon. No Trigger.dev scheduler or daemon
is added:

```sh
morpheus config show
morpheus daemon --config morpheus.config.json
```

## Expected dashboard behavior

Each preparation, implementation, and review lane is a separate Trigger.dev
root run. Filter by tags such as `morpheus:projection`,
`lane:implementation`, or the opaque issue/run tags. Metadata shows the
authoritative Morpheus state and ledger sequence.

Cancel, replay, reschedule, or Run Test affects only the observer wrapper. It
cannot stop, retry, approve, merge, or change a Morpheus run. If Morpheus is
still active after a wrapper becomes terminal, reconciliation creates a new
projection generation.

## Failure and recovery

- Trigger.dev outage: Morpheus continues. The local outbox records pending
  delivery and retries on later daemon ticks. Each HTTP attempt is bounded to
  10 seconds; one poisoned row does not block later rows.
- Daemon restart: existing outbox rows are resumed. A run committed after
  observer enablement but before enqueue is backfilled from the ledger.
- Duplicate request or lost response: waitpoint and task trigger use stable
  idempotency keys; metadata is a full snapshot; waitpoint completion is an
  idempotent no-op after success.
- Missing observer secrets: Morpheus continues with a degraded warning and
  retains pending projection work.
- Wrapper timeout/failure/cancel/deletion: it is never interpreted as Morpheus
  state. Reconciliation creates a new numbered wrapper generation.

## Privacy gate

Remote payload, metadata, tags, output, and errors contain only opaque HMAC
identifiers and curated enums. Never add issue titles/descriptions, GitLab URLs,
repository paths, raw logs/transcripts, exception messages, or credentials.

Before publishing or signing off:

```sh
MORPHEUS_FORBIDDEN_PRIVATE_PATTERNS='operator-approved-patterns' \
  pnpm scan:private-data
```

Architecture rationale: [ADR 0009](../adr/0009-use-trigger-dev-as-non-authoritative-execution-projection.md).
Official capability review:
[NIC-113 research](../planning/nic-113-trigger-dev-official-research.md).
