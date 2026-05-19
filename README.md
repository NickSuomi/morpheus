# Morpheus

Morpheus is a local agent orchestration system for repo-based work.

Product principle:

> If it can't explain itself, it can't run.

## Current Status

Initial monorepo scaffold and CLI shell are in place.

Read in order:

1. `docs/product/PRD.md`
2. `CONTEXT.md`
3. `ARCHITECTURE.md`
4. `docs/adr/`
5. `docs/agents/`

## Issue Tracking

This repo uses local Beads as the current source of truth for issue state:

```bash
bd ready
bd list
bd show <id>
```

Prefix: `morph`.

GitLab labels are not authoritative lifecycle state yet. Morpheus may import
ready GitLab issues through sync flow, but after import, Beads `agent:*` labels
own the workflow state.

## Development

```bash
pnpm install
pnpm build
pnpm check
pnpm typecheck:fast
```

`pnpm typecheck:fast` builds package declaration outputs first, then runs
per-package `tsgo --noEmit`. This keeps workspace package imports resolvable
while TypeScript native workspace resolution is still being proven.

## Local CLI Install

Morpheus is not published to npm yet. Use pnpm from this repo to build and link
the local CLI package:

```bash
cd /Users/nicksuomi/sandbox/morpheus
pnpm install
pnpm build
pnpm link --global ./packages/cli
morpheus --help
```

`morpheus --help` should print the command help after linking. Re-run
`pnpm build` after source changes so the linked command uses current `dist`
output.

For temporary unlinked local use, run the CLI through the package script:

```bash
cd /Users/nicksuomi/sandbox/morpheus
pnpm build
pnpm --filter @morpheus/cli morpheus --help
pnpm --filter @morpheus/cli morpheus config show --config /path/to/target-repo/morpheus.config.json
```

Most commands load `morpheus.config.json` from the current working directory or
from `--config`. Run target-repo commands from a repository that has that config,
or pass an explicit config path.

## Docker Daemon

Build the local image from this repo. This does not require publishing Morpheus
to npm:

```bash
cd /Users/nicksuomi/sandbox/morpheus
docker build -t morpheus:local .
docker run --rm morpheus:local --help
```

Initialize a target repo:

```bash
morpheus init \
  --target /path/to/target-repo \
  --gitlab-project group/project
```

`morpheus init` writes `/path/to/target-repo/.morpheus/docker-compose.yml`.
Run the daemon from the target repo so the compose-relative bind mounts resolve
to the target repo and its `.morpheus` artifact directory:

```bash
cd /path/to/target-repo
docker compose -f .morpheus/docker-compose.yml up
```

The generated compose file runs:

```bash
morpheus daemon --config /workspace/morpheus.config.json
```

Required mounts:

- target repo at `/workspace`
- persistent `.morpheus` artifacts at `/workspace/.morpheus`
- glab auth from `${HOME}/.config/glab-cli`
- Git config from `${HOME}/.gitconfig`
- SSH auth from `${HOME}/.ssh`
- Docker socket from `/var/run/docker.sock`

The compose file contains only paths and image settings. It does not write glab
tokens, SSH keys, or other secrets into tracked Morpheus config.

## CLI Commands

Current command inventory:

- `morpheus config show` - show validated config summary.
- `morpheus init` - create target repo config, prompts, and Docker compose template.
- `morpheus doctor` - check read-only adapter and runtime health.
- `morpheus status` - show read-only operator status.
- `morpheus slice <issue-id>` - show issue forensics across state and runs.
- `morpheus runs` - list run ledger entries.
- `morpheus run <run-id>` - show one run.
- `morpheus logs <run-id>` - show run transcript/log output.
- `morpheus prune --dry-run|--apply` - prune policy-eligible terminal runs.
- `morpheus sync` - import ready GitLab issues into Beads.
- `morpheus prepare <issue-id>` - prepare one Beads issue.
- `morpheus implement <issue-id>` - create workspace branch and Draft MR for one prepared issue.
- `morpheus review <issue-id>` - run read-only review for one running issue.
- `morpheus daemon [--once]` - poll, sync, schedule, and run Morpheus lanes.

## Commit Message Hook

Install the local `commit-msg` hook without Node package scaffolding:

```bash
git config core.hooksPath .githooks
```

The hook runs `scripts/validate-commit-msg.sh` and validates commit subjects:

```txt
<type>: <imperative summary>
```

Allowed types: `docs`, `feat`, `fix`, `refactor`, `test`, `chore`, `spike`,
`decision`. Keep the subject at or below 72 characters. Merge and revert commits
are accepted.

## Next Workflow

1. Implement approved Beads slices with TDD.
2. Keep package boundaries aligned with `ARCHITECTURE.md`.
