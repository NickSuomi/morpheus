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

Concrete implementation of an effectful runtime port, such as Beads, GitLab via `glab`, SQLite, `SandcastleAgentRunner`, process execution, or workspace operations.

### Container Runtime

Morpheus-owned sandbox execution surface for agents. Target repository artifacts use Morpheus vocabulary, such as `.morpheus/` paths and `agentRunner.kind = "container"`. Low-level libraries may be used inside adapters, but target repositories should not need user-visible `.sandcastle/` setup for the normal Morpheus flow.

### Docker-Compatible Runtime

Container runtime reachable through Docker CLI/API semantics, such as Docker Desktop, OrbStack, Colima, or a remote Docker context. Morpheus should check runtime availability through Docker-compatible commands like `docker info` rather than assuming a specific macOS app.

### Agent Auth File

Explicit target/runtime environment file containing the token an agent may use, such as Codex API credentials. Default path is `.morpheus/secrets/agent.env`, with `.morpheus/secrets/agent.env.example` as the non-secret template. Morpheus must not silently use global host Codex authentication like `~/.codex` for agent runs. If the configured auth file is missing or lacks the required token, agent execution fails with an operator-auth error before work starts.

### Blocking Health Check

Doctor check that prevents Morpheus from safely running lanes. Blocking checks cover prerequisites Morpheus itself needs to explain and execute work, such as config, Beads, GitLab access, Docker-compatible runtime access, ledger access, agent auth, workspace access, and the configured container image for container-backed agents.

### Advisory Health Check

Doctor check that exposes target- or task-specific risk but does not prevent daemon startup. Advisory checks cover optional target toolchains such as Java, Android SDK, pnpm, Node inside a container image, or other verification tools that may be required by a later task. Morpheus reports these risks so operators and agents can see them before a run, but task-specific verification owns the eventual pass/fail evidence.

### Container Profile

Editable Morpheus-owned container setup generated for a target repository, such as `.morpheus/container/Dockerfile` and supporting docs. Morpheus may detect likely repo capabilities like Node, Android, or iOS and generate guidance/probes, but v1 does not auto-install heavyweight toolchains such as Android SDK or Xcode. Operators opt in by editing the container profile.

### Declarative Target Config

Target repository configuration stays in `morpheus.config.json`, not a target-owned TypeScript runtime file. Agent model, explicit auth file, container image/profile, mounts, setup hooks, prompt paths, and bundled skill mapping should be represented declaratively in config. Old repo-local TypeScript runtime config files are reference material only.

### Fake Agent Runner

Local deterministic runner used in early slices to exercise orchestration without Docker, external sandbox runtime, or real agents.
