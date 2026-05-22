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

## Alpha Curl Installer

Alpha installation is release-artifact based and must not build Morpheus from
source on operator machines. The installer installs `morpheus` into a
configurable bin directory, verifies published checksums when a checksum URL is
provided, validates `morpheus --version`, and prints the setup next step.

```bash
curl -fsSL <install-url> | sh
morpheus --version
```

Optional installer environment:

```bash
MORPHEUS_INSTALL_DIR="$HOME/.local/bin" \
MORPHEUS_VERSION="0.1.0" \
MORPHEUS_RELEASE_URL="https://example.com/morpheus-0.1.0-darwin-arm64.tar.gz" \
MORPHEUS_CHECKSUM_URL="https://example.com/checksums.txt" \
sh scripts/install.sh
```

After install, run:

```bash
cd target-repo && morpheus setup
```

## Local CLI Install

For development only, use pnpm from this repo to build and link the local CLI
package:

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

## Target Repo Quickstart

This is the local flow for a repo such as `private-target-repo`.

```bash
cd /Users/nicksuomi/sandbox/morpheus
pnpm install
pnpm build
pnpm link --global ./packages/cli

cd /path/to/private-target-repo
morpheus init --target . --gitlab-project group/private-target-repo
morpheus config show
```

Edit `morpheus.config.json` before running agents:

- `gitlab.project` should match the GitLab project path.
- `gitlab.readyLabel` defaults to `agent:ready` and is only an import trigger.
- `gitlab.targetBranch` defaults to `main`.
- `verification.commands` can list repo checks operators expect agents to run.

Sync imports ready GitLab issues into Beads:

```bash
glab auth status
bd ready
morpheus sync
bd ready
```

After sync, Beads is the lifecycle source of truth. Morpheus does not treat
GitLab labels as workflow state after import; Beads `agent:*` labels drive
prepare, implement, and review.

Run one daemon tick first, then polling mode:

```bash
morpheus daemon --once
morpheus status
morpheus daemon
```

Inspect transparent state while the daemon works:

```bash
morpheus slice morph-abc
morpheus runs
morpheus run run_01EXAMPLE
morpheus logs run_01EXAMPLE
morpheus prune --dry-run
```

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

`morpheus init` writes the target repo container profile at
`/path/to/target-repo/.morpheus/container/Dockerfile` and documents local runtime
setup in `/path/to/target-repo/.morpheus/container/README.md`. Build the default
agent image from the target repo so relative paths resolve to the target repo and
its `.morpheus` artifact directory:

```bash
cd /path/to/target-repo
docker build -f .morpheus/container/Dockerfile -t morpheus-agent:local .
```

The generated `morpheus.config.json` points container-backed agent runs at:

```json
{
  "agentRunner": {
    "kind": "container",
    "container": {
      "image": "morpheus-agent:local",
      "profile": ".morpheus/container/Dockerfile"
    }
  }
}
```

Default container mount:

- target repo at `/workspace`

The generated container profile and README are editable templates intended to be
tracked. Local runtime data, cache, ledger files, logs, and agent secrets remain
ignored by generated `.gitignore` entries.

## Troubleshooting

- Missing `morpheus`: run `pnpm build`, then `pnpm link --global ./packages/cli`
  from this repo, or use `pnpm --filter @morpheus/cli morpheus ...`.
- Missing config: run `morpheus init --target . --gitlab-project group/project`
  in the target repo, or pass `--config /path/to/morpheus.config.json`.
- `glab` auth failures: run `glab auth status` on the host and ensure Morpheus
  CLI commands can access that host auth before starting lanes.
- Docker access failures: start Docker and verify `docker info` succeeds from
  the host before running container-backed agents.
- Agent runtime access failures: verify Docker access from the host first, then
  inspect `.morpheus/agent-logs/` and the run logs for the failing run.
- Conflicting `agent:*` labels: keep exactly one active Beads lifecycle label on
  an issue. Use `morpheus slice <issue-id>` to inspect current state before
  changing labels.

## CLI Commands

Current command inventory:

- `morpheus config show` - show validated config summary.
- `morpheus init` - create target repo config, prompts, and Morpheus container profile.
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
