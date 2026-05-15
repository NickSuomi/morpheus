# Morpheus PRD

## Problem Statement

Current repo-local agent workflow grew from automation scripts into its own agent orchestration product. It now mixes daemon scheduling, issue state, sandbox execution, review, merge behavior, logs, prompts, and repo-specific app code inside `private-target-repo`.

This causes three problems:

1. Repo pollution: agent orchestration runtime code lives inside app repo, even though it is not app domain logic.
2. AI-slop risk: agent work can look process-compliant while missing durable intent, acceptance criteria, verification, risk evidence, or human merge ownership.
3. Poor observability: once lanes become parallel, there is no single place to answer what is running, for which issue, in which sandbox, what happened before, where logs are, and why a run failed.

Motto: **If it can't explain itself, it can't run.**

## Solution

Build **Morpheus** as a separate project under `/Users/nicksuomi/sandbox/morpheus`.

Morpheus is the product name, CLI name, daemon name, and public vocabulary. "Sandcastle" must not appear as product vocabulary. It may appear only as a low-level adapter implementation detail, because Morpheus can use the `@ai-hero/sandcastle` library internally.

Morpheus will run against a target repository, initially `private-target-repo`, via target repo configuration.

Morpheus owns:

- Multi-lane agent daemon
- CLI
- Run ledger
- Issue state machine
- Lane scheduler
- Review artifact renderer
- Agent runner adapter
- Beads issue tracker adapter
- GitLab MR adapter via `glab`
- Docker/worktree/sandbox runtime integration
- Prompt/template orchestration

Target repo owns:

- `.morpheus` config or equivalent
- Label mapping
- Branch naming
- GitLab project config
- Verification commands
- Prompt/template overrides if needed
- Domain docs/ADRs used by agents

## User Stories

1. As a maintainer, I want to mark an issue with `agent:ready`, so that Morpheus can decide whether it can safely become agent work.
2. As a maintainer, I want Morpheus to build the Agent-Ready Contract, so that I do not manually prepare every issue.
3. As a maintainer, I want weak issues to fail closed, so that Morpheus does not invent product intent.
4. As a maintainer, I want every agent state to be explicit, so that I can see whether work is preparing, prepared, running, reviewing, review-ready, blocked, or failed.
5. As a maintainer, I want exactly one active `agent:*` state per issue, so that the daemon never guesses from conflicting labels.
6. As a maintainer, I want Morpheus to create a Draft MR at implementation start, so that review context lives in GitLab MR instead of issue comments.
7. As a reviewer, I want the MR description to contain contract, evidence, risk, verification, and review findings, so that I can review without hunting through logs.
8. As a reviewer, I want raw agent transcripts available locally, so that I can inspect why when the MR summary is not enough.
9. As a maintainer, I want Morpheus to never auto-merge, so that human GitLab review remains final authority.
10. As an operator, I want `morpheus doctor`, so that I can verify Beads, GitLab, Docker, workspace, labels, and runtime health.
11. As an operator, I want `morpheus status`, so that I can see what is happening now.
12. As an operator, I want `morpheus runs`, `morpheus run <id>`, and `morpheus logs <id>`, so that I can inspect concrete agent runs.
13. As an operator, I want `morpheus slice <issue-id>`, so that I can see the full issue story across preparation, implementation, review, children, MR, failures, and transcripts.
14. As a developer of Morpheus, I want runtime side effects behind adapters, so that shell commands and vendor APIs do not leak across workflows.
15. As a developer of Morpheus, I want the lane scheduler designed for future parallelism, so that v1 can run sequentially without baking in sequential assumptions.

## Implementation Decisions

- Project name is **Morpheus**.
- Project path is `/Users/nicksuomi/sandbox/morpheus`.
- Current `private-target-repo` repo-local agent implementation is reference material, not the long-term product location.
- Public naming should use Morpheus vocabulary, not Sandcastle vocabulary.
- Allowed Sandcastle name use: `SandcastleAgentRunner` as adapter around `@ai-hero/sandcastle`.
- Morpheus should expose deep modules: `IssueStateMachine`, `LaneScheduler`, `RunLedger`, `ReviewArtifact`, `AgentRunner`, `IssueTracker`, `MergeRequestClient`, and `WorkspaceRuntime`.
- `IssueStateMachine` owns all `agent:*` labels and transitions.
- Valid issue states: `agent:ready`, `agent:preparing`, `agent:prepared`, `agent:running`, `agent:reviewing`, `agent:review-candidate`, `agent:blocked`, and `agent:failed`.
- Exactly one active `agent:*` state is allowed.
- Multiple active `agent:*` labels cause fail-closed behavior with `failureKind: state_conflict`.
- Valid transitions are `agent:ready` -> `agent:preparing`, `agent:preparing` -> `agent:prepared`, `agent:preparing` -> `agent:blocked`, `agent:preparing` -> `agent:failed`, `agent:prepared` -> `agent:running`, `agent:prepared` -> `agent:failed` when implementation setup fails before the implementer runs, `agent:running` -> `agent:reviewing`, `agent:running` -> `agent:blocked`, `agent:running` -> `agent:failed`, `agent:reviewing` -> `agent:review-candidate`, `agent:reviewing` -> `agent:blocked`, `agent:reviewing` -> `agent:failed`, `agent:blocked` -> `agent:ready` by human/operator requeue, and `agent:failed` -> `agent:ready` by human/operator requeue.
- `agent:review-candidate` has no Morpheus auto-merge transition.
- Events are `StartPreparation`, `PreparationReady`, `PreparationBlocked`, `PreparationFailed`, `StartImplementation`, `ImplementationReadyForReview`, `ImplementationBlocked`, `ImplementationFailed`, `StartReview`, `ReviewPassed`, `ReviewBlocked`, `ReviewFailed`, `HumanRequeued`, and `HumanRetryFailed`.
- `agent:running` remains the state that makes review-lane work runnable in the current scheduler model.
- `ImplementationReadyForReview` is the Beads transition from `agent:running` to `agent:reviewing`; it records that implementation output moved into review ownership.
- `StartReview` is review-lane runtime vocabulary for starting reviewer execution while handling `agent:running` work. It is not a second Beads state transition unless a later review-lane design explicitly adds a runtime event for that purpose.
- `agent:ready` means daemon may start preparation, not that a contract already exists.
- Agent-Ready Contract is produced by Morpheus preparation, then runtime validates it.
- Agent-Ready Contract fields are `category`, `summary`, `currentBehavior`, `desiredBehavior`, `keyInterfaces`, `acceptanceCriteria`, `outOfScope`, `verificationPlan`, `blockedBy`, `hitlDecisions`, and `riskLevel`.
- AFK-ready requires `blockedBy = None` and `hitlDecisions = None`.
- Contract must be durable, behavioral, and interface-focused.
- Contract must not depend on brittle file paths or line numbers.
- Weak prep result becomes `agent:blocked`, not implementation.
- Morpheus output is AI-slop when it is process-shaped but not contract-valid.
- `riskLevel` is proposed by prep agent and may be raised by runtime.
- `LaneScheduler` owns lane selection and future concurrency.
- Lanes are preparation, implementation, review, and sync/status reconciliation if needed.
- v1 should design for parallel execution but may execute lanes sequentially with concurrency `1`.
- Interfaces must not assume end-to-end sequential ownership.
- No mutation may rely on only one Morpheus run existing.
- `RunLedger` is required foundation, not optional observability.
- `RunLedger` uses local SQLite plus transcript/artifact files.
- Raw transcripts are local only.
- MR receives curated evidence, not raw transcript dumps.
- Failure kinds are `operator_access`, `runtime_error`, `agent_contract_error`, `verification_error`, `state_conflict`, and `unknown`.
- MR auth/access failure is `agent:failed` with `failureKind: operator_access`.
- No implementer agent starts before Draft MR exists.
- No auto-retry in v1.
- Human/operator requeues failed work by moving issue back to `agent:ready`.
- Beads remains source of truth for issue state and contract metadata.
- GitLab MR becomes human review artifact.
- Runtime may use `glab` for MR operations.
- Runtime must not use GitLab issue comments as primary lifecycle state.
- New ADR should record that Morpheus uses GitLab MRs as review artifacts while Beads remains issue state source.
- `MergeRequestClient` uses a `glab` adapter first.
- Agents never run `glab`.
- Runtime owns MR create/update/link/assign operations.
- Draft MR is created at implementation start.
- MR description source is a Morpheus review artifact template.
- Issue should not receive long evidence comments.
- Reviewer is read-only in v1.
- Reviewer cannot commit code.
- Reviewer returns typed JSON findings and verdict.
- Human GitLab review path controls merge.
- Morpheus never auto-merges in this PRD.
- Issue closes only after human merge path.
- Existing old-flow work gets manual migration only. No backward compatibility adapter required.

## Testing Decisions

- Tests should target public interfaces and observable behavior.
- Do not test implementation details.
- Important test surfaces: `IssueStateMachine`, `LaneScheduler`, `RunLedger`, `ReviewArtifact`, `GlabMergeRequestClient` adapter contract with fake process runner, `BeadsIssueTracker` adapter contract with fake process runner, and CLI rendering from ledger fixtures.
- `IssueStateMachine` tests cover one active `agent:*` state, conflict failure, valid transitions, invalid transitions, non-agent label preservation, and lane derivation.
- `RunLedger` tests cover run creation before sandbox start, sandbox/worktree/branch/MR recording, ordered event recording, failureKind recording, issue history linking, and CLI reconstruction.
- `ReviewArtifact` tests cover pending Draft MR rendering, implementation evidence, reviewer findings, raw transcript exclusion, risk, and human checklist.
- `LaneScheduler` tests cover state-to-lane selection, concurrency limits, priority/date/id sorting, conflict exclusion, and multiple issues in different lanes.

## Tracer Bullet Slices

1. **Run ledger records one preparation attempt**
   Type: AFK
   Build `RunLedger` interface, SQLite adapter, transcript files, and minimal CLI: `runs`, `run <id>`, `logs <id>`.
   Verifies Morpheus can record start/end/result/failure for one preparation run.

2. **State machine gates agent labels**
   Type: AFK
   Build `IssueStateMachine` with valid labels, events, transitions, conflict detection, and eligible lane derivation.
   Verifies exactly one `agent:*` state and fail-closed conflict behavior.

3. **Strict preparation creates Agent-Ready Contract**
   Type: AFK
   `agent:ready` -> `agent:preparing` -> `agent:prepared` or `agent:blocked`/`agent:failed`.
   Runtime validates contract schema.
   Ledger records why.

4. **Draft MR starts implementation run**
   Type: AFK
   `agent:prepared` -> `agent:running`, or `agent:prepared` -> `agent:failed` if workspace, branch, or Draft MR setup fails.
   Morpheus creates a run-scoped branch/worktree, pushes it, creates Draft MR through `glab`, links issue, writes pending review artifact.
   Ledger links issue, run, sandbox, branch, and MR.

5. **Implementation evidence updates MR**
   Type: AFK
   Implementer returns typed result.
   Runtime updates MR implementation and verification sections.
   Ledger stores artifacts/transcript paths.

6. **Read-only review creates review candidate**
   Type: AFK
   `agent:running` -> `agent:reviewing` -> `agent:review-candidate` or blocked/failed.
   Reviewer cannot commit.
   MR review section updated from typed findings.

7. **Parallel-ready scheduler**
   Type: AFK
   Build `LaneScheduler`.
   Supports lanes and concurrency config, default concurrency `1`.
   No end-to-end sequential assumption.

8. **Debug CLI expansion**
   Type: AFK
   Add `status`, `slice <issue-id>`, and `doctor`.
   `doctor` checks Beads, GitLab, Docker, workspace, labels, daemon, containers, worktrees, and ledger health read-only.

## Out of Scope

- Auto-merge.
- Auto-retry.
- Uploading raw transcripts to GitLab.
- Full dashboard UI.
- Metrics backend/alerting.
- Backward compatibility with old repo-local agent runs.
- Redaction system for transcripts.
- Parallel execution beyond interfaces/concurrency config defaulting to `1`.
- Replacing Beads as issue state source.
- GitLab issue comments as evidence store.
- Human approval command like `/morpheus approve`.
- Prune command implementation, except retention policy baseline.

## Further Notes

- Current `private-target-repo` repo-local runtime is reference implementation only.
- Public docs and CLI should use Morpheus vocabulary.
- “Sandcastle” is permitted only as adapter name where it describes usage of `@ai-hero/sandcastle`.
- Initial target repo is `private-target-repo`.
- Retention baseline: active runs retained until terminal; failed runs retained until manual prune; review-candidate runs retained until MR merged/closed or manual prune; completed intermediate runs retained for last 14 days or last 100 runs.
- Required ADR: **Use GitLab MR as Morpheus review artifact while Beads remains issue state source**.
- Core product principle: **If it can't explain itself, it can't run.**
