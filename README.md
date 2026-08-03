# Morpheus

Morpheus is agent operations for teams running AI work on real GitLab repositories. It turns a ready issue into an isolated, reviewable agent run, records evidence, updates a Draft merge request, and leaves the merge decision to a human.

Status: alpha.

## What is Morpheus?

Morpheus is an operator-facing control plane for a bounded software-delivery flow. It connects issue intake, agent execution, independent review, and merge-request evidence without treating an autonomous run as permission to merge.

It operates against one configured target repository and stores its runtime artifacts locally under `.morpheus/`.

## Why Morpheus?

- Agent work on production repositories needs a visible lifecycle, not an opaque background run.
- An implementation result needs independent review and concise evidence before a human decides whether to merge it.
- Authentication, repository state, unresolved decisions, and failed verification should stop work visibly rather than becoming implicit risk.

Morpheus never auto-merges.

## How it works

1. A GitLab issue receives the configured ready label, usually `agent:ready`.
2. Morpheus validates the Agent-Ready Contract and prepares an isolated workspace.
3. An agent implements the bounded work item.
4. An independent review evaluates the result.
5. Morpheus updates the Draft merge request with curated evidence.
6. A human reviews and merges, or resolves the visible blocker.

## Quick start

### Requirements

- Git
- authenticated `glab`
- Docker-compatible runtime
- Beads (`bd`) in the target repository
- Codex CLI for ChatGPT subscription authentication

### Install

```sh
curl -fsSL https://github.com/NickSuomi/morpheus/releases/latest/download/install.sh | sh
morpheus --version
```

### Configure and run

```sh
cd /path/to/target-repo
morpheus setup
morpheus doctor
morpheus daemon --once
```

`morpheus setup` configures GitLab, the container runtime, and agent authentication. `morpheus doctor` checks the active target and prints recovery steps.

## Operate

```sh
morpheus status           # current lanes and failures
morpheus slice <issue-id> # full issue story
morpheus runs             # run history
morpheus run <run-id>     # one run
morpheus logs <run-id>    # local transcript
morpheus sync             # reconcile GitLab intake
```

## Architecture

Morpheus keeps deterministic decisions separate from effectful runtime work:

- `packages/core` owns pure state, scheduling, and contract decisions.
- `packages/runtime` owns Effect-based use cases and service contracts.
- `packages/adapters` maps GitLab, Beads, SQLite, processes, and workspaces to those contracts.
- `packages/cli` renders commands without duplicating workflow logic.

The run ledger combines a mutable current summary with an immutable ordered event trail. Read the [architecture](ARCHITECTURE.md) and [architecture decisions](docs/adr/) for the full contract.

## Known limitations

- Morpheus is alpha; workflow and integration interfaces may change.
- ChatGPT-subscription authentication is serialized within one Morpheus process in the current alpha.
- A target repository needs the declared GitLab, Beads, container, and Codex prerequisites before side effects begin.

## Verify

```sh
pnpm install
pnpm check
```

For an installed target, run:

```sh
morpheus doctor
```

## Related documentation

- [Product brief](docs/product/PRD.md)
- [Alpha contract](docs/product/ALPHA.md)
- [Context glossary](CONTEXT.md)
- [Agent instructions](docs/agents/)

## License

Morpheus is licensed under [Apache-2.0](LICENSE). See [NOTICE](NOTICE) for attribution.
