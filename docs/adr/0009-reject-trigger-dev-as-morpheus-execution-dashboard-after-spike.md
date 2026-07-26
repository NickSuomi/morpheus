# ADR 0009: Reject Trigger.dev as the Morpheus Execution Dashboard After Spike

## Status

Accepted

## Context

Morpheus needs a remote operator view that reduces the work required to answer:

- what issue is active;
- what preparation, implementation, and review did;
- why a run stopped;
- what evidence exists;
- what human action is required;
- which safe Morpheus controls are available.

NIC-113 tested Trigger.dev beyond a visual mock. A deployed observer task
projected real Morpheus preparation, implementation, and review runs while
Morpheus retained scheduling, execution, recovery, and source-of-truth state.
The spike also exercised outage recovery, daemon restart, idempotency,
redaction, wrapper cancellation, and authoritative failure.

The integration was technically viable only as one Trigger.dev wrapper task per
Morpheus lane run. Trigger.dev has no documented API for importing an arbitrary
externally owned run or assigning its terminal state. Its native run hierarchy,
queue, duration, compute, controls, logs, and traces describe the wrapper rather
than the real Morpheus execution.

## Decision

Do not adopt Trigger.dev as the Morpheus execution dashboard.

Do not merge the observer implementation into `main`, ship it in a release, or
configure production targets to depend on it. Keep the implementation branch
and deployed Cloud project as a non-production spike artifact and visual
reference.

Pursue a Morpheus-owned operator dashboard in a separate prototype and product
decision. The first step is interactive HTML exploration, not a production UI
or backend implementation.

The Trigger.dev spike remains successful research. It proved the responsibility
boundary and exposed the product mismatch before Morpheus committed to the
vendor integration.

## Why Trigger.dev Was Rejected

- It does not reduce operator UI noise. Trigger.dev exposes tasks, deployments,
  machines, regions, queues, compute, attempts, TTL, environments, and controls
  that are mostly wrapper infrastructure rather than Morpheus concepts.
- It cannot show the full issue-centric Morpheus context without duplicating or
  leaking data across payload, metadata, tags, output, GitLab, and the local
  ledger.
- Its run model cannot natively represent externally owned Morpheus execution.
  Independent wrappers and opaque tags approximate the lifecycle but do not
  provide the required task view.
- Its controls cannot safely become Morpheus controls. Cancel, replay, test,
  reschedule, and queue actions affect only the wrapper.
- Cloud pricing, credits, query windows, and log retention become product
  constraints for an otherwise local and self-owned workflow.
- Its native logs and traces cover observer code, not the agent transcript,
  contract, verification evidence, review findings, or GitLab lifecycle.
- The projection requires an outbox, reconciliation, idempotency, redaction,
  wrapper recovery, deployment, secrets, and operational monitoring while still
  leaving the operator without the desired complete view.

## Reusable Visual References

The spike identified layout patterns worth exploring without copying
Trigger.dev's product model:

- collapsible left navigation;
- a central run timeline or trace;
- a collapsible or resizable right inspector;
- Overview, Detail, Context, and Metadata views;
- clear lifecycle chronology and status;
- export affordances;
- independently hideable navigation and inspection surfaces.

Morpheus must redesign the information hierarchy, vocabulary, density,
ordering, issue and MR context, evidence, and controls around its own domain.

## Consequences

- GitLab remains the intent, review, and human-merge surface.
- Morpheus remains the scheduler, worker owner, state machine, recovery system,
  and source of truth.
- Trigger.dev is not a supported runtime dependency or operator surface.
- The spike branch and remote deployment may remain available for reference,
  but they carry no production support or compatibility promise.
- Existing screenshots and ignored local prototypes are design inputs for a
  separate Morpheus operator-dashboard prototype.
- Production UI scope, data transport, authentication, deployment, and control
  semantics require later decisions after the prototype is reviewed.

## Evidence

The spike produced:

- a deployed credential-free observer task;
- a real GitLab issue lifecycle through preparation, implementation, Draft MR,
  review, and review-candidate;
- completed remote wrapper runs for all three lanes;
- outage and fresh-process reconciliation;
- stable idempotent remote identifiers;
- wrapper cancel isolation and generation recovery;
- authoritative Morpheus failure projection;
- private-data redaction checks;
- full repository unit, integration, build, lint, type, and secret-scan gates.

The detailed report is
[Trigger.dev Execution Dashboard Spike](../product/trigger-dev-execution-dashboard-spike.md).
