# Morpheus

Morpheus is a local, repo-based agent orchestration system for explainable software work.

Product principle:

> If it can't explain itself, it can't run.

Morpheus connects GitLab issue intake, Beads lifecycle state, container-backed agents, run ledgers, and operator inspection commands into one auditable workflow.

## Table of Contents

- [What Morpheus Is](#what-morpheus-is)
- [Problem](#problem)
- [How Morpheus Works](#how-morpheus-works)
- [Current Status](#current-status)
- [ALPHA Golden Path](#alpha-golden-path)
- [Target Repository Quickstart](#target-repository-quickstart)
- [Doctor Health Model](#doctor-health-model)
- [Operating The Daemon](#operating-the-daemon)
- [Inspecting Runs](#inspecting-runs)
- [Manual Lane Commands](#manual-lane-commands)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Development](#development)

## What Morpheus Is

Morpheus is an operator-first CLI for running AI agents against real repositories without losing control of state, evidence, or review boundaries.

Today it can:

- initialize a target repository with Morpheus config, prompts, skills, secrets templates, and a container profile;
- import ready GitLab issues into local Beads;
- schedule prepare, implement, and review lanes;
- run agents in a Docker-compatible container runtime;
- record run evidence in a local ledger;
- expose status, issue slices, run details, and logs for operator inspection.

## Problem

Agent runs are hard to trust when they hide lifecycle state, use implicit credentials, mutate repos without a clear contract, or leave no audit trail.

Morpheus solves this by making every run explainable before it executes:

- GitLab is the human intake UI.
- Beads is the lifecycle source of truth after import.
- `agent:*` labels describe workflow state.
- Doctor checks separate blocking prerequisites from advisory target risk.
- Agents run with explicit target config and explicit auth env files.
- Operators can inspect every run through CLI commands and ledger data.

## How Morpheus Works

1. A target repo is configured with `morpheus.config.json`.
2. GitLab issues with the configured ready label are imported into Beads.
3. Morpheus derives runnable lanes from Beads `agent:*` state.
4. `morpheus daemon` syncs, schedules, and executes work.
5. Prepare creates an explainable contract.
6. Implement creates an isolated workspace branch and draft merge request.
7. Review checks evidence and contract fit.
8. The operator inspects status, slices, runs, and logs.

## Current Status

Morpheus is in ALPHA development. The canonical ALPHA contract lives in:

- `docs/product/ALPHA.md`

The ALPHA setup completion gate is:

- `morpheus doctor` has zero `FAIL` results;
- `morpheus daemon --once` succeeds without crashing.

`WARN` results are visible risk for task-specific verification, not automatic setup blockers.

## ALPHA Golden Path

The intended ALPHA operator path is:

```sh
curl -fsSL <install-url> | sh
morpheus --version
cd /path/to/target-repo
morpheus setup
morpheus doctor
docker build -f .morpheus/container/Dockerfile -t morpheus-agent:local .
morpheus daemon --once
morpheus daemon
```

Then mark a GitLab issue with the configured ready label, usually `agent:ready`, and inspect work with `morpheus status`, `morpheus slice`, `morpheus runs`, and `morpheus logs`.

The curl installer exists as `scripts/install.sh` for release artifacts/shims. The public hosted install URL and production release channel are still release-process work; do not treat Homebrew or a public package registry as available today.

## Target Repository Quickstart

If you are evaluating from this source checkout, build and link the CLI first:

```sh
cd /path/to/morpheus
pnpm install
pnpm build
pnpm link --global ./packages/cli
morpheus --help
```

Then configure a target repository:

```sh
cd /path/to/target-repo
morpheus setup
morpheus config show
```

Setup writes or updates:

- `morpheus.config.json`;
- `.morpheus/prompts/*`;
- `.morpheus/skills/*` mappings;
- `.morpheus/container/Dockerfile`;
- `.morpheus/container/README.md`;
- `.morpheus/secrets/agent.env.example`;
- `.gitignore` entries for local ledgers, logs, caches, and real secret env files.

Before running agents, verify or edit:

- `gitlab.project`;
- `gitlab.readyLabel`;
- `gitlab.targetBranch`;
- `agentRunner.agent.model` and `agentRunner.agent.effort`;
- `agentRunner.auth.envFile` and required keys;
- `agentRunner.container.image` and profile path;
- `verification.commands` and `verification.toolchainProbes`;
- lane concurrency and daemon polling interval.

Morpheus does not collect secret values. Put real credentials in the configured env file, for example `.morpheus/secrets/agent.env`, and keep that file ignored.

Build the target agent image explicitly:

```sh
docker build -f .morpheus/container/Dockerfile -t morpheus-agent:local .
```

Run the health and scheduler gate:

```sh
morpheus doctor
morpheus daemon --once
```

Import a real GitLab issue:

```sh
glab auth status
morpheus sync
bd ready
```

After sync, Beads owns lifecycle state. GitLab labels are intake signals; Beads `agent:*` labels drive Morpheus lanes.

## Doctor Health Model

`morpheus doctor` prints `OK`, `WARN`, and `FAIL` results.

- `FAIL` blocks Morpheus setup or safe lane execution. Examples: invalid config, missing Beads, GitLab auth failure, Docker-compatible runtime unavailable, missing required agent auth keys, unreadable workspace, or missing configured container image.
- `WARN` means visible task-specific risk. Examples: optional target toolchains like Java or Android SDK are not present in the container profile.
- `OK` means the checked prerequisite is currently readable or available.

The daemon does not auto-build the agent image in v1. If doctor reports a missing image, run:

```sh
docker build -f .morpheus/container/Dockerfile -t morpheus-agent:local .
```

## Operating The Daemon

Run one tick first:

```sh
morpheus daemon --once
```

Then run polling mode when the one-shot gate is healthy:

```sh
morpheus daemon
```

The daemon syncs ready GitLab issues, schedules runnable Beads lanes, executes up to configured lane capacity, and records run evidence.

## Inspecting Runs

Use these commands while the daemon works:

```sh
morpheus status
morpheus slice <issue-id>
morpheus runs
morpheus run <run-id>
morpheus logs <run-id>
morpheus prune --dry-run
```

`slice` is the fastest way to inspect one issue across labels, derived state, dependencies, runs, and evidence.

## Manual Lane Commands

Manual lane commands are debugging and escape hatches, not the primary happy path:

```sh
morpheus prepare <issue-id>
morpheus implement <issue-id>
morpheus review <issue-id>
```

Prefer `morpheus daemon --once` and `morpheus daemon` for normal ALPHA operation.

## Troubleshooting

- Missing `morpheus`: install from the release artifact/script, or for development run `pnpm build && pnpm link --global ./packages/cli`.
- Missing config: run `morpheus setup` in the target repo, or pass `--config /path/to/morpheus.config.json`.
- GitLab auth failure: run `glab auth status` and verify access to `gitlab.project`.
- Docker failure: start Docker Desktop, OrbStack, Colima, or a remote Docker context and verify `docker info`.
- Missing agent image: run `docker build -f .morpheus/container/Dockerfile -t morpheus-agent:local .` from the target repo.
- Missing auth keys: create the configured env file and add required keys; do not paste secrets into setup.
- Toolchain warnings: edit `.morpheus/container/Dockerfile`, rebuild the image, and rerun doctor.
- Failed agent run: inspect `morpheus runs`, `morpheus run <run-id>`, `morpheus logs <run-id>`, and `.morpheus/agent-logs/`.

## Roadmap

### Guided Setup CLI

ALPHA includes `morpheus setup` as the guided target-repo onboarding path. The remaining planned work is UX hardening: richer selector prompts, clearer validation copy, and more operator-friendly recovery from invalid inputs. Setup must continue to avoid secret value collection.

### Production Distribution

Planned beyond the current ALPHA release process. The chosen ALPHA direction is curl-installed release artifacts. Public hosting, checksums/signing policy, Homebrew, npm/binary packaging, and update flow are still distribution work.

### ALPHA E2E Signoff

ALPHA signoff requires both:

- a small fixture target repo smoke test;
- private target signoff through Morpheus, with evidence kept outside Morpheus git.

## Development

Project docs to read in order:

1. `docs/product/PRD.md`
2. `CONTEXT.md`
3. `ARCHITECTURE.md`
4. `docs/adr/`
5. `docs/agents/`
6. `.understand-anything/knowledge-graph.json`

The knowledge graph is a committed architecture map for onboarding, broad
refactors, and agent prompt design. Use its `tour` first, then `layers`, then
targeted `nodes` and `edges`. Treat the PRD, context, architecture brief, and
ADRs as authoritative when anything conflicts.

Common commands:

```sh
pnpm install
pnpm build
pnpm check
pnpm typecheck:fast
```

Issue tracking uses Beads with prefix `morph`:

```sh
bd ready
bd list
bd show <id>
```

Commit hooks:

```sh
git config core.hooksPath .githooks
```
