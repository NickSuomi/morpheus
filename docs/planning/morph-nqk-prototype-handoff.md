# morph-nqk Prototype Handoff

## Question

Can lane selection stay independent per lane while still exposing conflicting issue states and deterministic ordering after every daemon tick?

## Prototype Run

Throwaway prototype command run:

```bash
node .scratch/prototypes/morph-nqk-lane-scheduler.mjs
```

Prototype state included one preparation queue with two issues, one implementation issue, one review issue, and one conflicting issue with multiple `agent:*` labels.

## Learning

- Scheduler output should be lane-shaped, not a single global queue.
- Capacity should be applied per lane after ordering each lane independently.
- Default capacity `1` still allows one preparation, one implementation, and one review item in the same tick.
- Ordering should be deterministic inside each lane: priority, then date, then issue ID.
- Conflicting `agent:*` labels should be excluded from runnable queues and returned in a separate fail-closed list for reconciliation/operator surfaces.
- The production shape should stay pure in `packages/core`; runtime should only query Beads and pass tracked issues/config into the scheduler.

## Production Direction

Implement `LaneScheduler` as a pure core function that returns:

- per-lane queues,
- per-lane selected work,
- excluded issues with reason and active states,
- effective lane capacities.

Runtime should expose a small tick-planning use-case that reads `IssueTracker.listRunnableIssues()` and delegates all selection to `LaneScheduler`.
