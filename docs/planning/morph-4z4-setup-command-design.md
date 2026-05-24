# morph-4z4 Setup Command Design

## Decision

The guided onboarding command should be `morpheus setup`.

`morpheus setup` is the default recommendation because it matches operator intent: install Morpheus, enter a target repository, answer only missing questions, and leave with a validated target configuration plus explicit next steps. It should be interactive by default, safe to re-run, and thin at the CLI edge. Runtime use-cases should own detection, file mutation plans, validation, health checks, and command sequencing.

This is design-only. No production CLI command is implemented by this document.

## Top-Level UX

Default interactive flow:

```bash
cd /path/to/target-repo
morpheus setup
```

Equivalent explicit target flow:

```bash
morpheus setup --target /path/to/target-repo
```

Expected phases:

1. Resolve and validate the target repository path.
2. Detect repository basics and existing Morpheus files.
3. Ask for missing or ambiguous required inputs.
4. Show a mutation preview before writing files.
5. Write or update `morpheus.config.json` and Morpheus templates under `.morpheus/`.
6. Guide explicit agent auth env setup without reading or printing secret values.
7. Explain or run the container image build according to operator choice.
8. Run `morpheus config show` and `morpheus doctor`.
9. Explain OK/WARN/FAIL results and the smallest next action.
10. Guide GitLab `agent:ready`, `morpheus sync`, `morpheus daemon --once`, and daemon startup.

The command should never auto-start the long-running daemon in the default flow. It may run `daemon --once` only after explicit confirmation.

## Existing Commands Sequenced

`morpheus setup` should wrap or sequence these existing commands/use-cases:

- `morpheus init`: create initial target config, prompts, copied skills, container profile, agent env example, and `.gitignore` entries.
- `morpheus config show`: display validated config summary after writes.
- `morpheus doctor`: check read-only adapter and runtime health.
- `morpheus sync`: import GitLab issues with the configured ready label into Beads.
- `morpheus daemon --once`: run one daemon tick to prove the scheduler path before a long-running daemon.

Manual steps that remain manual in v1:

- Installing or linking Morpheus itself until a distribution path is published.
- Authenticating host `glab` access.
- Supplying real agent secret values in `.morpheus/secrets/agent.env`.
- Editing `.morpheus/container/Dockerfile` for target-specific heavy toolchains.
- Deciding which GitLab issues should receive `agent:ready`.
- Starting and supervising the long-running `morpheus daemon` process.

## Prompt Contract

All prompts should show detected values, a default, validation, and the resulting mutation. If an existing valid value is found, the default is that value and pressing Enter keeps it.

| Phase        | Prompt                                                       | Default                                                                                      | Validation                                                                                                                                          | Resulting Mutation                                                                                                                                                                                       |
| ------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Target       | `Target repository path?`                                    | `.` when run inside a Git worktree, otherwise required                                       | Path exists, is a directory, is readable, and either contains `.git` or is inside a Git worktree                                                    | Sets setup target; generated config uses `targetRepo: "."` when config lives at target root                                                                                                              |
| Target       | `Use existing Morpheus config at <path>?`                    | `yes` when `morpheus.config.json` exists                                                     | Existing config must parse and pass schema validation before update mode proceeds                                                                   | Chooses update mode; preserves existing valid values unless later prompts change them                                                                                                                    |
| Target       | `Overwrite existing generated templates?`                    | `no`                                                                                         | Only allowed when generated files already exist; must require explicit `yes`                                                                        | Enables force-style template rewrite for `.morpheus/prompts/*`, `.morpheus/skills/*`, `.morpheus/container/*`, and `.morpheus/secrets/agent.env.example`; never overwrites `.morpheus/secrets/agent.env` |
| GitLab       | `GitLab project path?`                                       | Existing `gitlab.project`, else value inferred from `glab repo view` remote when unambiguous | Must match `group/project` or nested `group/subgroup/project`; setup should verify with `glab repo view` or a read-only GitLab check when available | Writes `gitlab.project`                                                                                                                                                                                  |
| GitLab       | `Target branch for merge requests?`                          | Existing `gitlab.targetBranch`, else current remote default branch if detected, else `main`  | Non-empty branch name; warn if branch cannot be found on remote, fail only if operator chooses strict validation                                    | Writes `gitlab.targetBranch`                                                                                                                                                                             |
| GitLab       | `GitLab ready label to import?`                              | Existing `gitlab.readyLabel`, else `agent:ready`                                             | Non-empty label; warn if not present in GitLab labels when label lookup is available                                                                | Writes `gitlab.readyLabel`; clarify it is an import trigger only and Beads owns lifecycle state after sync                                                                                               |
| Agent        | `Agent provider?`                                            | Existing `agentRunner.agent.provider`, else `codex`                                          | v1 accepts only `codex`                                                                                                                             | Writes `agentRunner.agent.provider`                                                                                                                                                                      |
| Agent        | `Agent model?`                                               | Existing `agentRunner.agent.model`, else current init default                                | Non-empty string                                                                                                                                    | Writes `agentRunner.agent.model`                                                                                                                                                                         |
| Agent        | `Agent reasoning effort?`                                    | Existing `agentRunner.agent.effort`, else current init default                               | One of `low`, `medium`, `high`, `xhigh`                                                                                                             | Writes `agentRunner.agent.effort`                                                                                                                                                                        |
| Auth         | `Agent auth env file path?`                                  | Existing `agentRunner.auth.envFile`, else `.morpheus/secrets/agent.env`                      | Relative path must stay inside target repo; absolute paths require confirmation; must not be `.env` at repo root by default                         | Writes `agentRunner.auth.envFile`; writes `.morpheus/secrets/agent.env.example`; updates `.gitignore` for the secret file                                                                                |
| Auth         | `Required auth env keys?`                                    | Existing `agentRunner.auth.requiredKeys`, else `OPENAI_API_KEY`                              | Comma-separated non-empty env var names matching shell identifier rules                                                                             | Writes `agentRunner.auth.requiredKeys`; example file includes keys with empty values only                                                                                                                |
| Auth         | `Create missing secret file now with empty keys?`            | `yes` when file is missing                                                                   | Only writes empty assignments and comments; never prompts for secret values                                                                         | Creates configured secret file with empty key placeholders if operator agrees; file remains ignored                                                                                                      |
| Container    | `Container image tag?`                                       | Existing `agentRunner.container.image`, else `morpheus-agent:local`                          | Non-empty Docker-compatible image reference string                                                                                                  | Writes `agentRunner.container.image`                                                                                                                                                                     |
| Container    | `Container profile path?`                                    | Existing `agentRunner.container.profile`, else `.morpheus/container/Dockerfile`              | Relative path must stay inside target repo and end with a plausible Dockerfile path                                                                 | Writes `agentRunner.container.profile`; writes editable Dockerfile template when missing or force rewrite is confirmed                                                                                   |
| Container    | `Container workspace mount?`                                 | Existing first mount, else `.:/workspace`                                                    | Host path must be inside target repo unless explicitly confirmed; container path must be absolute                                                   | Writes `agentRunner.container.mounts`                                                                                                                                                                    |
| Container    | `Detected capabilities: <list>. Add matching doctor probes?` | `yes`                                                                                        | Capabilities are detected from repo files; generated probes must use current runtime-supported probe schema                                         | Writes `verification.toolchainProbes` for Node, pnpm, Android/Gradle, and iOS/Xcode detections                                                                                                           |
| Container    | `Build container image now?`                                 | `no` if Docker is unavailable or profile changed; otherwise `yes`                            | Requires `docker info` success; build command must run from target repo                                                                             | If yes, runs `docker build -f <profile> -t <image> .`; if no, prints the exact command and marks doctor container image result as expected WARN until built                                              |
| Verification | `Verification commands agents should run?`                   | Existing `verification.commands`, else detected package-script suggestions, else empty       | Each command must be a non-empty shell command; empty list is valid with a warning                                                                  | Writes `verification.commands`                                                                                                                                                                           |
| Daemon       | `Daemon poll interval seconds?`                              | Existing `daemon.pollIntervalSeconds`, else `30`                                             | Positive integer                                                                                                                                    | Writes `daemon.pollIntervalSeconds`                                                                                                                                                                      |
| Lanes        | `Lane concurrency?`                                          | Existing values, else `1/1/1`                                                                | Positive integers; warn that values above 1 require operator confidence in runner isolation                                                         | Writes `lanes.preparation.concurrency`, `lanes.implementation.concurrency`, and `lanes.review.concurrency`                                                                                               |
| Review       | `Write these changes?`                                       | `yes` for new setup, `no` for update mode                                                    | Operator must confirm after seeing planned creates, updates, and skipped files                                                                      | Applies file/config mutations atomically where practical; refuses to overwrite secrets                                                                                                                   |
| Doctor       | `Run doctor now?`                                            | `yes`                                                                                        | Requires config load success                                                                                                                        | Runs doctor and renders OK/WARN/FAIL interpretation                                                                                                                                                      |
| Sync         | `Run sync now?`                                              | `no` until GitLab and Beads doctor checks are OK                                             | Requires GitLab project configured and `glab` auth OK                                                                                               | Runs `morpheus sync` only when confirmed                                                                                                                                                                 |
| Daemon       | `Run one daemon tick now?`                                   | `no` until doctor has no FAIL results                                                        | Requires config valid and operator confirmation                                                                                                     | Runs `morpheus daemon --once` only when confirmed                                                                                                                                                        |

## File And Config Mutations

New target setup should create the same baseline as `morpheus init`:

- `morpheus.config.json`
- `.morpheus/prompts/prepare.md`
- `.morpheus/prompts/implement.md`
- `.morpheus/prompts/review.md`
- `.morpheus/skills/*/SKILL.md` for bundled Morpheus agent skills
- `.morpheus/container/Dockerfile`
- `.morpheus/container/README.md`
- `.morpheus/secrets/agent.env.example`
- `.gitignore` entries for local runtime state, logs, cache, ledger files, and `.morpheus/secrets/agent.env`

Update mode should preserve existing target-owned customizations by default. It should patch only the fields confirmed in prompts and should not rewrite prompt, skill, or container templates unless the operator explicitly confirms template overwrite.

The planned config shape remains declarative in `morpheus.config.json`. No target-owned TypeScript runtime config should be introduced.

## Secrets Policy

`morpheus setup` must treat agent credentials as explicit operator-owned secrets.

- Secret values are never requested interactively in the setup command.
- Secret values are never printed, logged, summarized, copied into Beads, or written into docs.
- The default secret path is `.morpheus/secrets/agent.env`.
- The generated example file may contain only comments and empty assignments such as `OPENAI_API_KEY=`.
- The real secret file must be ignored by `.gitignore`.
- Doctor may report whether required keys are present, but it must not print values or value lengths.
- Morpheus must not silently use global host Codex auth such as `~/.codex` for agent runs.

If the auth file is missing or lacks required keys, setup should explain the exact file and key names to fill, then stop before sync or daemon guidance that would start agent work.

## Doctor Interpretation

Setup should render doctor results using the existing `OK`, `WARN`, and `FAIL` vocabulary.

- `OK`: requirement is satisfied; no action needed.
- `WARN`: setup can continue, but operator should understand degraded or incomplete behavior. Examples: container image not built, optional toolchain probe missing, no ready GitLab issues found, empty verification command list.
- `FAIL`: setup must stop before agent-running commands. Examples: malformed config, missing Beads, missing `glab` auth for GitLab operations, missing Docker for container-backed agents, missing required auth env file or key.

The command should group output by dependency area: config, target repo, Beads, GitLab, Docker-compatible runtime, container image, agent auth file, ledger path, labels, and verification probes.

## GitLab And Daemon Guidance

After config and doctor pass enough to proceed, setup should print an operator path rather than hiding the lifecycle model:

```bash
# In GitLab, add this label to issues Morpheus may import:
agent:ready

# Then import ready GitLab issues into Beads:
morpheus sync

# Inspect Beads source-of-truth state:
bd ready

# Prove one scheduler tick:
morpheus daemon --once

# Start the polling daemon when ready:
morpheus daemon
```

If the configured ready label is not `agent:ready`, the printed guidance should use the configured value while explaining that `agent:ready` remains the default recommendation.

## Non-Interactive And CI Considerations

Non-interactive setup is available for CI and scripted target onboarding. It
uses the same runtime setup planner as the interactive command, but never opens
terminal prompts.

Supported flags:

- `--target <path>`: target repository path.
- `--gitlab-project <group/project>`: GitLab project path.
- `--target-branch <branch>`: GitLab MR target branch.
- `--gitlab-ready-label <label>`: GitLab import trigger label.
- `--auth-env-file <path>`: explicit agent auth env file path.
- `--required-auth-key <key[,key]>`: required auth env keys.
- `--container-image <image>`: configured agent image tag.
- `--container-profile <path>`: editable container Dockerfile path.
- `--verification-command <command[,command]>`: configured verification commands.
- `--poll-interval-seconds <number>`: daemon poll interval.
- `--yes`: accept safe defaults and file writes, but still never fill secret values.
- `--no-build`: skip image build and print command.
- `--build`: build image if Docker is available.
- `--no-sync`: skip sync.
- `--once`: run `daemon --once` after successful setup and explicit non-interactive gates.
- `--config-input <json>`: read a declarative setup answer file.
- `--dry-run`: render planned prompts, defaults, validation, and mutations without writing.

CI mode fails closed when required inputs are missing. `--dry-run` is always
non-mutating, including when paired with `--yes`. Config input accepts public
setup answers only; secret values are rejected instead of stored or printed.
Machine-readable result data remains future work; v1 keeps plain text.

## Implementation Shape For Later

When implemented, keep the CLI thin:

- CLI owns command definition, terminal prompts, and printing.
- Runtime owns target detection, setup answer validation, mutation planning, doctor interpretation, and sequencing of existing use-cases.
- Adapters own filesystem, process, Git, GitLab, Docker-compatible runtime, and Beads checks.
- Tests should cover prompt planning and mutation planning without depending on terminal interactivity.

The first production implementation should avoid broad CLI churn. It can start by composing existing init/config/doctor/sync/daemon use-cases with a setup-specific plan renderer before adding richer update-mode patching.
