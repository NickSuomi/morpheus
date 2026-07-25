# NIC-113 Trigger.dev Official Capability Research

Research date: 2026-07-25

Scope: current official Trigger.dev documentation and API reference only.

## Verdict

**Direct external-run projection is not supported.**

Trigger.dev defines a run as an instance created by triggering a Trigger.dev
task. Its published Runs API can list, retrieve, replay, cancel, reschedule,
update metadata, add tags, and retrieve events/traces/results. It does not expose
an API to create an arbitrary run or externally set that run to completed or
failed. Therefore Morpheus cannot import its own execution as a native
Trigger.dev run and externally drive the native run lifecycle.

Sources:

- [Runs: a run is created when a task is triggered](https://trigger.dev/docs/runs)
- [Tasks API: trigger a task and receive a run ID](https://trigger.dev/docs/management/tasks/trigger)
- [Published Runs API operations](https://trigger.dev/docs/management/runs/update-metadata)

**The accepted NIC-113 boundary is supportable only through a minimal observer
task.**

Morpheus may trigger one deployed Trigger.dev observer task for each
authoritative Morpheus lane run. The observer task waits on an externally
completed waitpoint. Morpheus updates the observer run's metadata while its own
worker executes, then completes the waitpoint with a redacted terminal envelope.
The observer returns for Morpheus success or throws with retries disabled for
Morpheus failure.

This topology has an unavoidable qualification: Trigger.dev schedules and
executes the observer task. It does **not** schedule or execute the Morpheus
lane. The Trigger.dev run is a real Trigger.dev run, but it is only a projection
of the real Morpheus run.

If NIC-113 requires the Trigger.dev run itself to be the Morpheus execution, or
requires Morpheus to mutate a Trigger.dev run status without a Trigger.dev task,
the requirement is blocked by the published API.

## Confirmed Capability Matrix

| Need                                               | Official capability                                                                                              | Verdict for NIC-113                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Create a dashboard run for an external execution   | Trigger a deployed task; response contains `run_<id>`                                                            | Supported only as an observer task, not as an imported Morpheus run |
| Update current projected state                     | `PUT /api/v1/runs/{runId}/metadata` replaces run metadata                                                        | Supported; Morpheus must serialize full-snapshot writes             |
| Add filterable correlation                         | Trigger options and `runs.addTags()`; up to 10 tags                                                              | Supported                                                           |
| Complete from an external system                   | Complete a waitpoint token; waiting task resumes and returns                                                     | Supported through the observer task                                 |
| Fail from an external system                       | Complete the token with failure data; observer throws; uncaught task error fails the run                         | Supported through the observer task                                 |
| Idempotent terminal signal                         | Completing an already-completed waitpoint is a successful no-op                                                  | Supported                                                           |
| Discover/reconcile a projection                    | Retrieve/list runs and retrieve waitpoint status                                                                 | Supported                                                           |
| Append external Morpheus logs/spans to a run trace | No published Runs API operation ingests logs, spans, events, or traces                                           | Not supported as native run logs/traces                             |
| Show curated external stream data                  | Streams v2 can target a run from outside a task                                                                  | Supported, but it is a stream, not native run-log/trace ingestion   |
| Prevent dashboard cancel/replay/test               | Dashboard officially exposes all three actions; no per-task disable mechanism is documented in the reviewed docs | Must be isolated, not treated as authoritative                      |
| Use local `trigger dev` for production             | `trigger dev` runs task code locally; production requires deployment                                             | Rejected                                                            |

Primary references:

- [Trigger task API](https://trigger.dev/docs/management/tasks/trigger)
- [Update run metadata API](https://trigger.dev/docs/management/runs/update-metadata)
- [Add run tags API](https://trigger.dev/docs/management/runs/add-tags)
- [Wait for token](https://trigger.dev/docs/wait-for-token)
- [Create waitpoint API](https://trigger.dev/docs/management/waitpoints/create)
- [Complete waitpoint API](https://trigger.dev/docs/management/waitpoints/complete)
- [Retrieve waitpoint API](https://trigger.dev/docs/management/waitpoints/retrieve)
- [Task errors and retries](https://trigger.dev/docs/errors-retrying)
- [Streams](https://trigger.dev/docs/tasks/streams)
- [CLI dev command](https://trigger.dev/docs/cli-dev-commands)
- [Deployment](https://trigger.dev/docs/deployment/overview)

## Smallest Supported Topology

Use one Trigger.dev root observer run per Morpheus lane run:

```text
GitLab operator intent
        |
        v
Morpheus daemon -> Beads + SQLite ledger -> Morpheus worker
        |
        +-- fail-open projection outbox
                 |
                 +-- create/reuse waitpoint
                 +-- trigger deployed observer task
                 +-- update redacted run metadata
                 +-- complete terminal waitpoint
                                      |
                                      v
                           Trigger.dev observer run
                           (dashboard projection only)
```

The observer task must:

1. accept only a versioned, redacted projection envelope and a waitpoint ID;
2. declare `retry.maxAttempts: 1`;
3. log only curated observer lifecycle messages;
4. wait with `wait.forToken()`;
5. return a redacted result for Morpheus success;
6. throw a redacted error for Morpheus failure;
7. contain no GitLab credentials, Morpheus state-store access, Morpheus command
   endpoint, or callback that can change Morpheus.

Official facts supporting the composition:

- Waitpoint tokens can be created from backend code, then passed to
  `wait.forToken()` inside a task.
- External code can complete the token through the SDK or HTTP callback.
- Completing an already-completed token is a no-op returning success.
- A waiting task is suspended; Trigger.dev Cloud checkpoints waits so they do
  not consume compute while paused.
- Returning from a task completes it; an uncaught error fails it; task retry
  count is configurable.

Sources:

- [Waitpoint token flow](https://trigger.dev/docs/wait-for-token)
- [Complete waitpoint idempotency](https://trigger.dev/docs/management/waitpoints/complete)
- [Waiting and checkpointing](https://trigger.dev/docs/wait)
- [Task completion and failure](https://trigger.dev/docs/tasks/overview)
- [Errors and retry configuration](https://trigger.dev/docs/errors-retrying)

## Create, Update, Complete, Fail, Correlate

### Create

Morpheus first creates an idempotent terminal waitpoint, then triggers the
deployed observer task with:

- an idempotency key derived from an opaque Morpheus projection ID;
- the waitpoint ID;
- a schema version;
- redacted initial metadata;
- bounded correlation tags.

The Trigger API returns the Trigger.dev run ID. Morpheus must persist the
projection record and Trigger.dev run ID before completing the terminal
waitpoint, including when reconciling an already-terminal Morpheus run.

Waitpoint tokens default to a 10-minute timeout and a 1-hour idempotency-key
TTL. The adapter must set both explicitly from Morpheus projection policy;
otherwise an ordinary long lane or outage can time out the observer or allow
token duplication.

Trigger.dev idempotency is task- and environment-scoped. Outside a task, all
documented idempotency scopes behave globally. The default key retention is 30
days. A repeated trigger during the window returns the original run. Failed
runs automatically clear their idempotency key; successful and canceled runs
retain it.

Consequences:

- A lost trigger response is safe to retry while the observer remains waiting.
- The observer must not be allowed to fail before its run ID is persisted.
- After an observer system failure or cancellation, Morpheus must create a new
  persisted projection generation with a new idempotency key. It must not
  blindly reuse the old key.

Sources:

- [Trigger API](https://trigger.dev/docs/management/tasks/trigger)
- [Task idempotency scopes, TTL, and failed-run behavior](https://trigger.dev/docs/idempotency)
- [Create waitpoint idempotency](https://trigger.dev/docs/management/waitpoints/create)
- [Waitpoint defaults](https://trigger.dev/docs/wait-for-token)

### Update

Use the management API to replace the entire metadata object on the known
Trigger.dev run ID. The endpoint documents replacement, not conditional update
or event append.

Morpheus therefore must:

- publish a complete redacted snapshot, not a partial patch;
- include the authoritative Morpheus ledger event sequence;
- serialize writes per projection;
- coalesce intermediate updates;
- never derive Morpheus state from the last Trigger.dev metadata value.

This ordering is a Morpheus responsibility. The reviewed Trigger.dev API does
not document compare-and-set or ETag semantics for metadata updates.

Source: [Update metadata API](https://trigger.dev/docs/management/runs/update-metadata)

### Complete and fail

Complete the waitpoint with a redacted terminal envelope only after the
Trigger.dev run ID is durable locally.

The observer task maps the envelope:

- `succeeded` -> return a JSON-serializable summary;
- `failed` -> throw a redacted error with retries disabled;
- waitpoint timeout -> fail only the observer projection.

Morpheus must never interpret observer completion, failure, cancellation,
timeout, or replay as a state-machine event.

Sources:

- [Complete waitpoint API](https://trigger.dev/docs/management/waitpoints/complete)
- [Waitpoint result and timeout behavior](https://trigger.dev/docs/wait-for-token)
- [Task final states](https://trigger.dev/docs/runs)
- [Errors and retries](https://trigger.dev/docs/errors-retrying)

### Correlate

Use tags for dashboard/list filtering and metadata for the detailed snapshot.
Tags do not automatically propagate to child runs, and a run supports at most
10 tags of 1-128 characters.

Recommended bounded tag vocabulary:

- `morpheus:projection`
- `schema:v1`
- `lane:preparation`, `lane:implementation`, or `lane:review`
- `target:<opaque-hash>`
- `issue:<opaque-hash>`
- `run:<opaque-hash>`
- `projection:<generation>`

Do not put target repository names, hostnames, issue titles, branch names,
private URLs, local paths, or transcript content in tags.

Sources:

- [Tags limits and filtering](https://trigger.dev/docs/tags)
- [Add tags API](https://trigger.dev/docs/management/runs/add-tags)
- [List runs API](https://trigger.dev/docs/management/runs/list)

## Trigger.dev Hierarchy Limitation

An externally triggered task is a root run. Trigger.dev parent/child
relationships are created by task-to-task triggering inside Trigger.dev. The
published external Task trigger API does not document an option to assign an
existing parent run.

Therefore v1 should represent preparation, implementation, and review as
independent observer runs correlated by the same opaque issue tag, not by
creating a synthetic Trigger.dev parent that schedules children.

If a Trigger.dev parent/child tree is mandatory acceptance criteria, it would
require Trigger.dev to schedule projection children and would expand the
integration beyond the smallest observer. That criterion should be treated as a
separate product decision, not assumed from the synthetic prototype.

Sources:

- [Run root depth and trigger function fields](https://trigger.dev/docs/management/runs/retrieve)
- [Parent/root metadata and task-to-task child example](https://trigger.dev/docs/runs/metadata)

## Logs, Traces, Metadata, and Streams

Trigger.dev's run log is built from logs, traces, and spans emitted in task
execution. The published Runs API only retrieves events and traces; it does not
document ingestion endpoints for externally produced Morpheus logs or spans.

Consequences:

- The observer task can produce genuine Trigger.dev logs/traces about the
  projection wrapper.
- Those logs/traces must not be described as the remote Morpheus worker trace.
- Curated Morpheus progress belongs in run metadata.
- Raw Morpheus transcripts remain local.

Streams v2 can pipe data to a specific Trigger.dev run from outside a task, and
the dashboard can display streams. Current documented stream limits include
28-day retention and 300 MiB maximum size. A stream is still not native
run-log/trace ingestion. It is unnecessary for the minimum v1 projection and
would increase the private-data surface.

Sources:

- [Logging and tracing](https://trigger.dev/docs/logging)
- [Published Runs API operations](https://trigger.dev/docs/management/runs/update-metadata)
- [Streams, external targeting, visibility, and limits](https://trigger.dev/docs/tasks/streams)

## Dashboard Controls and Command-Plane Isolation

Trigger.dev officially exposes:

- cancel for in-progress runs;
- replay from API and dashboard, creating a new run;
- dashboard test execution in any environment;
- bulk cancel and replay.

The reviewed official docs do not document a per-task setting that disables
these controls. Isolation must be architectural:

- the observer has no credential or network capability that can mutate
  Morpheus or GitLab;
- Morpheus never polls Trigger.dev as operator intent;
- Morpheus ignores Trigger.dev cancel/replay/test runs for scheduler and
  state-machine decisions;
- only the Trigger.dev run ID stored in Morpheus's projection record is the
  tracked projection;
- replayed or test runs may create dashboard noise but cannot execute Morpheus
  work;
- cancellation can stop a projection but cannot stop the Morpheus lane;
- reconciliation may create a new observer projection generation from
  authoritative Morpheus state.

Sources:

- [Cancel behavior](https://trigger.dev/docs/management/runs/cancel)
- [Replay behavior](https://trigger.dev/docs/replaying)
- [Dashboard tests](https://trigger.dev/docs/run-tests)
- [Bulk actions](https://trigger.dev/docs/bulk-actions)

## Outage and Restart Reconciliation

Trigger.dev's management SDK automatically retries network and server failures
three times by default with exponential backoff. This is transport behavior,
not a durable Morpheus outbox.

Morpheus must provide the durable boundary:

1. Commit the Morpheus lane event and run summary first.
2. Append or update a local projection-outbox record in the same authoritative
   workflow.
3. Attempt Trigger.dev delivery after the Morpheus commit.
4. Treat every Trigger.dev error as observer degradation, never lane failure.
5. On daemon restart, read pending projection records from Morpheus state.
6. Retrieve known Trigger.dev run and waitpoint IDs when available.
7. Re-send the latest full metadata snapshot when its ledger sequence is newer.
8. Complete the terminal waitpoint idempotently for terminal Morpheus runs.
9. If the tracked observer is terminal for a non-authoritative reason, create a
   new projection generation without mutating the Morpheus run.

This reconciliation algorithm is a Morpheus architecture requirement composed
from the official Trigger, Runs, and Waitpoints APIs. It is not a Trigger.dev
source-of-truth or exactly-once guarantee.

Sources:

- [Management API errors and retries](https://trigger.dev/docs/management/errors-and-retries)
- [Retrieve run](https://trigger.dev/docs/management/runs/retrieve)
- [List runs](https://trigger.dev/docs/management/runs/list)
- [Retrieve waitpoint](https://trigger.dev/docs/management/waitpoints/retrieve)
- [Idempotent waitpoint completion](https://trigger.dev/docs/management/waitpoints/complete)

## Limits That Affect the Design

Current Trigger.dev Cloud limits documented by Trigger.dev:

| Surface                | Current documented limit                              | Design consequence                                            |
| ---------------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| Management API         | 1,500 requests/minute                                 | Coalesce progress; do not mirror every raw ledger event       |
| Tags                   | 10 per run, each 1-128 characters                     | Fixed bounded correlation vocabulary                          |
| Metadata               | 256 KB                                                | Full status snapshot only; no transcript or unbounded history |
| Single trigger payload | 3 MB                                                  | Projection envelope should be far smaller and redacted        |
| Task output            | 10 MB                                                 | Terminal summary only                                         |
| Cloud queued-run TTL   | Maximum 14 days                                       | TTL concerns time queued before start, not the wait duration  |
| Log retention          | Free 1 day; Hobby 7 days; Pro 30 days                 | Trigger.dev cannot be the durable audit log                   |
| Query lookback         | Free 1 day; Hobby 7 days; Pro 30 days                 | Long-term reporting must come from Morpheus                   |
| Query result           | 10,000 rows; 10 seconds; 3 concurrent queries/project | Do not base recovery on dashboard queries                     |
| Streams v2             | 28-day retention; 300 MiB maximum size                | Optional only; not durable run history                        |

The official limits page documents log retention, not a durability contract for
all run metadata. The run inspector may outlive logs, but Morpheus must not
depend on Trigger.dev retention for recovery.

Run metadata is visible in the run details view but is not available on the
TRQL Query page. Custom Trigger.dev dashboards therefore cannot aggregate
Morpheus metadata. Tags and native run fields can be queried and filtered.

Sources:

- [Cloud limits](https://trigger.dev/docs/limits)
- [Tag limits](https://trigger.dev/docs/tags)
- [Metadata limit and dashboard visibility](https://trigger.dev/docs/runs/metadata)
- [Streams limits](https://trigger.dev/docs/tasks/streams)
- [TRQL tables and metadata exclusion](https://trigger.dev/docs/observability/query)

## Cloud Environments and Deployment

Each Trigger.dev environment has its own secret key. Production observer runs
must use a deployed task and the production key. Staging has an independent
deployment/version and key; Trigger.dev Cloud documents staging as available on
Hobby and Pro. Preview branches are separate isolated environments with
plan-specific quotas.

`trigger dev` runs task code locally. Trigger.dev still performs scheduling,
and stopping the dev server auto-cancels its runs. It is a development tool, not
production infrastructure.

Required operational boundary:

- validate with a deployed staging observer where the plan supports staging;
- deploy the observer task for production;
- configure the production environment key only in the Morpheus operator secret
  boundary;
- never keep `trigger dev` alive as the production worker;
- never put the Trigger.dev key in the target repository, ledger payload,
  Trigger.dev metadata, logs, or GitLab.

Sources:

- [Environment-specific API keys](https://trigger.dev/docs/apikeys)
- [Production and staging deployment](https://trigger.dev/docs/deployment/overview)
- [Preview branches](https://trigger.dev/docs/deployment/preview-branches)
- [CLI dev behavior](https://trigger.dev/docs/cli-dev-commands)
- [Dev mode local execution and auto-cancel](https://trigger.dev/docs/how-it-works)

## Private-Data Boundary

Trigger.dev stores and exposes task payload, output, metadata, tags, logs, error
messages, and traces through its dashboard and APIs. Public-key run retrieval
omits payload and output, but the production integration uses a secret
environment key for writes and the dashboard remains an operator-visible
surface.

The projection schema must allowlist fields rather than redact arbitrary input
after serialization. Allowed data should be limited to:

- schema version;
- opaque hashed target/issue/run correlation;
- lane;
- normalized Morpheus state;
- monotonic ledger event sequence;
- timestamps;
- bounded failure kind;
- bounded, pre-redacted operator summary;
- projection generation.

Explicitly forbidden:

- repository or group names;
- private hostnames and URLs;
- issue/MR titles or bodies;
- branch/worktree/local paths;
- tokens, headers, credential paths, or callback URLs;
- commands containing target-specific arguments;
- raw exception stacks from Morpheus;
- raw agent prompts, responses, or transcripts.

Sources:

- [Retrieve run payload/output behavior](https://trigger.dev/docs/management/runs/retrieve)
- [Logging and structured log visibility](https://trigger.dev/docs/logging)
- [Metadata dashboard visibility](https://trigger.dev/docs/runs/metadata)

## Go/No-Go Conditions

Implementation may proceed only with all of these constraints accepted:

- The dashboard run is named and documented as a projection/observer run.
- One observer root run represents one Morpheus lane run.
- Trigger.dev never receives a scheduling or execution command for Morpheus.
- Trigger.dev status never drives Beads, the ledger, GitLab, or worker control.
- Cancel/replay/test are isolated because they cannot reach Morpheus.
- Progress is a redacted full metadata snapshot, not raw logs.
- Native Trigger.dev logs/traces describe only observer execution.
- A durable Morpheus outbox/reconciler owns delivery and restart recovery.
- Production uses a deployed Trigger.dev task, never `trigger dev`.

Stop implementation if any of these stronger requirements are imposed:

- import a Morpheus execution as a native Trigger.dev run without a task;
- externally set a native run's completed/failed state;
- show external Morpheus logs as native Trigger.dev run spans through a
  documented ingestion API;
- make Trigger.dev parent/child hierarchy mandatory without allowing Trigger.dev
  to schedule projection children;
- guarantee that dashboard controls are absent rather than harmless;
- rely on Trigger.dev for durable recovery or source-of-truth state.

## Official Sources Reviewed

- [Documentation index](https://trigger.dev/docs/llms.txt)
- [Runs](https://trigger.dev/docs/runs)
- [Task trigger API](https://trigger.dev/docs/management/tasks/trigger)
- [Management API overview](https://trigger.dev/docs/management/overview)
- [Management API authentication](https://trigger.dev/docs/management/authentication)
- [List runs](https://trigger.dev/docs/management/runs/list)
- [Retrieve run](https://trigger.dev/docs/management/runs/retrieve)
- [Update metadata](https://trigger.dev/docs/management/runs/update-metadata)
- [Add tags](https://trigger.dev/docs/management/runs/add-tags)
- [Cancel run](https://trigger.dev/docs/management/runs/cancel)
- [Replay run](https://trigger.dev/docs/management/runs/replay)
- [Retrieve run events](https://trigger.dev/docs/management/runs/retrieve-events)
- [Retrieve run trace](https://trigger.dev/docs/management/runs/retrieve-trace)
- [Create waitpoint](https://trigger.dev/docs/management/waitpoints/create)
- [Retrieve waitpoint](https://trigger.dev/docs/management/waitpoints/retrieve)
- [Complete waitpoint](https://trigger.dev/docs/management/waitpoints/complete)
- [Wait for token](https://trigger.dev/docs/wait-for-token)
- [Wait and checkpointing](https://trigger.dev/docs/wait)
- [Idempotency](https://trigger.dev/docs/idempotency)
- [Task errors and retries](https://trigger.dev/docs/errors-retrying)
- [Management API errors and retries](https://trigger.dev/docs/management/errors-and-retries)
- [Tags](https://trigger.dev/docs/tags)
- [Run metadata](https://trigger.dev/docs/runs/metadata)
- [Logging and tracing](https://trigger.dev/docs/logging)
- [Streams](https://trigger.dev/docs/tasks/streams)
- [Run tests](https://trigger.dev/docs/run-tests)
- [Replaying](https://trigger.dev/docs/replaying)
- [Bulk actions](https://trigger.dev/docs/bulk-actions)
- [Limits](https://trigger.dev/docs/limits)
- [Query](https://trigger.dev/docs/observability/query)
- [API keys](https://trigger.dev/docs/apikeys)
- [Deployment](https://trigger.dev/docs/deployment/overview)
- [Preview branches](https://trigger.dev/docs/deployment/preview-branches)
- [CLI dev command](https://trigger.dev/docs/cli-dev-commands)
- [How it works](https://trigger.dev/docs/how-it-works)
