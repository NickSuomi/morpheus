# Morpheus ALPHA

## Purpose

Morpheus ALPHA is the first end-to-end operator path where a maintainer can install Morpheus, enter a target repository, run guided setup, prove the scheduler path, and then run a real agentic task through Morpheus.

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
11. Prove real agent execution in ALPHA E2E signoff.

## Installation Contract

ALPHA installation uses a curl installer that downloads a pinned runnable release artifact or shim. It must not build Morpheus from source on the operator machine.

Minimum contract:

```sh
curl -fsSL https://github.com/NickSuomi/morpheus/releases/latest/download/install.sh | sh
morpheus --version
```

Pinned installs use the same script with an explicit release version:

```sh
curl -fsSL https://github.com/NickSuomi/morpheus/releases/latest/download/install.sh | MORPHEUS_VERSION=0.1.14 sh
```

The installer must:

- install `morpheus` into a configurable bin directory;
- verify checksum when release artifacts publish checksums;
- make `morpheus --version` work;
- print the next step: `cd target-repo && morpheus setup`.
- support both latest-channel and pinned `vX.Y.Z` GitHub Release artifacts.

## Setup UX Contract

`morpheus setup` is hybrid interactive CLI UX:

- choices and multi-choice prompts use selector UI;
- multi-choice prompts toggle with Space and confirm with Enter;
- text, path, model, and pasted values use readline-style input;
- secret values are never requested, printed, logged, copied, or summarized;
- setup creates or points to an explicit env file and tells the operator which required keys to fill.

Richer prompt copy, validation, and recovery may continue as UX hardening, but
selector/readline coverage above is part of the ALPHA contract.

## Setup Completion Gate

Setup is not complete unless:

- `morpheus doctor` has zero `FAIL` results;
- `morpheus daemon --once` succeeds without crashing.

WARN results may remain only when they do not block the no-FAIL and daemon-once gate.

Setup completion proves the scheduler/runtime path. It does not have to execute a real container Codex agent run.

## ALPHA E2E Signoff Gate

Real agent execution is a separate ALPHA signoff gate.

ALPHA signoff requires both:

1. a tiny fixture/demo target repository for repeatable smoke verification (`fixtures/alpha-target-repo`; see `docs/product/alpha-fixture-smoke.md`);
2. private target signoff against a real non-public repository.

The E2E path must prove at least one real container Codex execution through Morpheus, with operator-inspectable status, runs, slice, and logs.

## Required Target Repository State

After successful setup, the target repository has:

- `morpheus.config.json`;
- generated `.morpheus/prompts/*` templates;
- generated `.morpheus/skills/*` bundle mappings where applicable;
- `.morpheus/container/*` profile files;
- `.morpheus/secrets/agent.env.example`;
- `.gitignore` entries for local Morpheus runtime state and the real secret env file path;
- configured GitLab project, target branch, ready label, agent model/effort, auth keys, container image/profile, verification commands, daemon interval, and lane concurrency.

Setup must not create `.sandcastle` artifacts, private host auth paths, or a real secret env file containing token values. Operators create/fill the real auth env file manually.

## Intentional Lowercase Slugs

ALPHA milestone prose uses uppercase `ALPHA`. Lowercase `alpha` remains only in stable path, config, test, and fixture identifiers, including `fixtures/alpha-target-repo`, `docs/product/alpha-fixture-smoke.md`, `morpheus-alpha-fixture` temporary names, `local/alpha-fixture`, and `alpha-smoke` fixture skill/auth identifiers.

## ALPHA Capability Checklist

ALPHA is not complete until these capabilities are implemented, verified, and
the related Beads blockers are closed:

- guided `morpheus setup` implementation;
- hybrid selector/readline setup prompts;
- curl release installer;
- strict setup completion gate;
- fixture/demo E2E smoke target;
- private target E2E signoff without committing private target names, URLs,
  paths, tokens, or evidence;
- README operator path for the ALPHA golden path.

## Non-Goals For ALPHA

- Homebrew distribution.
- Source-build installation on the operator machine.
- Collecting secret values in setup.
- Auto-merging GitLab merge requests.
- Hiding lifecycle state from the operator.
- Storing private target signoff evidence in Morpheus git.
