# Issue Tracker: Beads

Issues for this repo live in local/private Beads (`bd`).

## Repository Facts

- Beads directory: `.beads`
- Prefix: `morph`
- Backend: embedded Dolt
- Remote: none configured; issues are local-only unless a remote is added later.
- Role: maintainer
- Public git policy: `.beads/` is ignored and must not be committed.

## Core Rules

- Use `bd` for all task tracking.
- Do not create markdown task files as tracker substitutes.
- Create Beads issues before implementation work.
- Use dependencies for blocked work instead of prose-only notes.
- Do not use `bd edit`; it opens an interactive editor.
- Treat Beads contents as local/private working state.
- Do not store private target names, hostnames, issue/MR URLs, local paths,
  tokens, or signoff evidence in Beads entries intended for sharing.
- Publish only scrubbed summaries through docs, commits, or future public issue
  exports.

## Public Git Policy

`.beads/` stays ignored because task history can contain target-specific
evidence from private ALPHA signoff. Public Morpheus git history must not rely
on committed Beads files for project state.

Agents should still use local `bd` commands for active work. If a fresh clone
lacks local Beads data, run `bd prime` or `bd ready`; if no local workspace is
available, initialize or sync Beads through the operator-approved local/private
channel rather than committing `.beads/`.

## Common Commands

```bash
bd ready
bd list --status open
bd show <id>
bd create "Title" --type task --priority P2 --body-file -
bd update <id> --claim
bd dep add <issue> <depends-on>
bd blocked
bd close <id> --reason "Done"
```

## Publishing Issues

When a skill says "publish to the issue tracker", create Beads issues with `bd create`.

Use:

- `--type task` for implementation slices
- `--type spike` for timeboxed uncertainty reduction
- `--type decision` for ADR/architecture decision work
- `--priority P2` unless the user says otherwise
- `--labels` for triage or Morpheus workflow labels

## Fetching Issues

When a skill says "fetch the relevant ticket", run:

```bash
bd show <id>
```

For lists:

```bash
bd list --json
bd ready
bd blocked
```

## Morpheus Workflow Labels

These labels describe Morpheus-managed issue state and are distinct from Matt Pocock triage labels:

- `agent:ready`
- `agent:preparing`
- `agent:prepared`
- `agent:running`
- `agent:reviewing`
- `agent:review-candidate`
- `agent:blocked`
- `agent:failed`

Exactly one active `agent:*` state should exist on a Morpheus-managed issue.
