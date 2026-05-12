# Morpheus Context

## Product Principle

If it can't explain itself, it can't run.

## Glossary

### Morpheus

Repo-local agent orchestration system. Morpheus owns scheduling, state transitions, run history, agent execution orchestration, review artifact rendering, and operator/debug commands.

### Target Repository

Repository Morpheus operates on. Target repo owns `morpheus.config.json`, domain docs, verification commands, prompt overrides, Beads issue state, branch naming, and GitLab project settings.

### Issue State

Current Beads `agent:*` label on an issue. Exactly one active `agent:*` state is valid. Beads issue state is source of truth.

### Agent-Ready Contract

Structured behavioral contract produced during preparation. It describes current behavior, desired behavior, key interfaces, acceptance criteria, out of scope, verification plan, blockers, HITL decisions, and risk level.

### Run

One Morpheus attempt to perform work in a lane for an issue. Runs have durable IDs, summary state, ordered events, transcript references, and artifact references.

### Run Ledger

Local SQLite-backed observability store. It records current run summaries and immutable run events. It mirrors Morpheus activity but does not own issue state.

### Lane

Scheduler category for work: preparation, implementation, review, or reconciliation. Each lane has independent concurrency.

### Review Artifact

Curated GitLab MR description rendered by Morpheus. It includes contract, evidence, risk, verification, findings, and human checklist. It excludes raw transcripts.

### Adapter

Concrete implementation of an effectful runtime port, such as Beads, GitLab via `glab`, SQLite, Sandcastle, process execution, or workspace operations.

### Fake Agent Runner

Local deterministic runner used in early slices to exercise orchestration without Docker, Sandcastle, or real agents.
