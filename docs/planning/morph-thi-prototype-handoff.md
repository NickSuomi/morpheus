# morph-thi Prototype Handoff

## Question

What compact terminal shape should `status`, `slice <issue-id>`, and `doctor` use before the CLI output contract is finalized?

## Prototype Run

Throwaway prototype command run:

```bash
node .scratch/prototypes/morph-thi-operator-output.mjs
```

The prototype used realistic fixtures for issues across preparation, implementation, and review; running, succeeded, and failed ledger runs; MR references; transcript/artifact paths; and adapter health checks.

## Learning

- `status` should summarize lane counts, blocked/failed counts, and running runs before detailed rows.
- `slice <issue-id>` should group evidence by lifecycle lane, then show MR, failure, transcript, artifact, and tombstone paths as stable fields.
- `doctor` should render one check per dependency with `OK`, `WARN`, or `FAIL` prefix and a short read-only detail.
- Output should stay plain text and fixture-testable, not table-width dependent.
- Runtime should own read-only aggregation. CLI should only load config, provide adapter layers, and print strings.

## Production Direction

Add pure renderers plus read-only runtime use-cases for operator status, issue slice, and doctor. Use existing `IssueTracker` and `RunLedger` ports. Add a small adapter-health port so `doctor` can check Beads, GitLab, Docker, workspace, labels, daemon assumptions, ledger, and config without side effects.
