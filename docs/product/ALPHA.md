# Morpheus Alpha

## Purpose

Morpheus Alpha is the first end-to-end operator path where a maintainer can install Morpheus, enter a target repository, run guided setup, prove the scheduler path, and then run a real agentic task through Morpheus.

Product principle: **If it can't explain itself, it can't run.**

## Golden Path

1. Install Morpheus from a curl installer.
2. `cd` into a target repository.
3. Run `morpheus setup`.
4. Answer guided setup prompts.
5. Let setup write/verify target Morpheus files.
6. Run doctor with zero `FAIL` results.
7. Run `morpheus daemon --once` successfully.
8. Start `morpheus daemon` when ready.
9. Mark GitLab issues with the configured ready label.
10. Use Morpheus status/run/slice/log commands to inspect work.
11. Prove real agent execution in Alpha E2E signoff.

## Installation Contract

Alpha installation uses a curl installer that downloads a pinned runnable release artifact or shim. It must not build Morpheus from source on the operator machine.

Minimum contract:

```sh
curl -fsSL <install-url> | sh
morpheus --version
```

The installer must:

- install `morpheus` into a configurable bin directory;
- verify checksum when release artifacts publish checksums;
- make `morpheus --version` work;
- print the next step: `cd target-repo && morpheus setup`.

## Setup UX Contract

`morpheus setup` is hybrid interactive CLI UX:

- choices and multi-choice prompts use selector UI;
- multi-choice prompts toggle with Space and confirm with Enter;
- text, path, model, and pasted values use readline-style input;
- secret values are never requested, printed, logged, copied, or summarized;
- setup creates or points to an explicit env file and tells the operator which required keys to fill.

The current readline setup is an implementation step toward this Alpha UX; selector UI is an Alpha blocker.

## Setup Completion Gate

Setup is not complete unless:

- `morpheus doctor` has zero `FAIL` results;
- `morpheus daemon --once` succeeds without crashing.

WARN results may remain only when they do not block the no-FAIL and daemon-once gate.

Setup completion proves the scheduler/runtime path. It does not have to execute a real container Codex agent run.

## Alpha E2E Signoff Gate

Real agent execution is a separate Alpha signoff gate.

Alpha signoff requires both:

1. a tiny fixture/demo target repository for repeatable smoke verification;
2. `private-target-repo` real-world PRIVATE_TARGET_WORKFLOW workflow signoff.

The E2E path must prove at least one real container Codex execution through Morpheus, with operator-inspectable status, runs, slice, and logs.

## Required Target Repository State

After successful setup, the target repository has:

- `morpheus.config.json`;
- generated `.morpheus/prompts/*` templates;
- generated `.morpheus/skills/*` bundle mappings where applicable;
- `.morpheus/container/*` profile files;
- `.morpheus/secrets/agent.env.example`;
- ignored real secret env file path;
- configured GitLab project, target branch, ready label, agent model/effort, auth keys, container image/profile, verification commands, daemon interval, and lane concurrency.

## Alpha Blockers

Alpha is not complete until these blockers are closed in Beads:

- finish readline `morpheus setup` implementation;
- upgrade setup prompts to hybrid selector UI;
- implement curl release installer;
- enforce strict setup completion gate;
- add fixture/demo E2E smoke target;
- run `private-target-repo` E2E signoff;
- update README to point operators to the Alpha golden path.

## Non-Goals For Alpha

- Homebrew distribution.
- Source-build installation on the operator machine.
- Collecting secret values in setup.
- Auto-merging GitLab merge requests.
- Hiding lifecycle state from the operator.
