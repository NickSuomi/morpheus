# Handoff: Morpheus Planning Session

## Focus For Next Session

Continue from the Morpheus PRD toward implementation planning and initial project scaffold.

## Key Artifacts

- PRD: `/Users/nicksuomi/sandbox/morpheus/docs/product/PRD.md`
- Project directory: `/Users/nicksuomi/sandbox/morpheus`
- Current repo reference implementation: `/Users/nicksuomi/code/intra/private-target-repo/.sandcastle`
- Upstream Matt Pocock skills clone used for install: `/var/folders/rb/ttz5kx2d4qd5grzbbbbn8ljh0000gn/T/opencode/mattpocock-skills`
- Upstream commit installed: `f304057d61d3df3c9fd992ac2b6e3833cb9325fb`

## Decisions Captured In PRD

Do not duplicate PRD contents. Read `/Users/nicksuomi/sandbox/morpheus/docs/product/PRD.md` first.

Most important locked decisions:

- Product name: Morpheus.
- Sandcastle is implementation detail only; public vocabulary should not use it.
- Motto: “If it can’t explain itself, it can’t run.”
- Morpheus lives outside `private-target-repo`, under `/Users/nicksuomi/sandbox/morpheus`.
- Current repo-local `.sandcastle` is reference implementation only.
- Core modules: `IssueStateMachine`, `LaneScheduler`, `RunLedger`, `ReviewArtifact`, `AgentRunner`, `IssueTracker`, `MergeRequestClient`, `WorkspaceRuntime`.
- `RunLedger` is required foundation: local SQLite plus local transcript/artifact files.
- Beads remains issue state source; GitLab MR becomes review artifact.
- Runtime may use `glab` for MR lifecycle through adapter; agents never run `glab`.
- No auto-merge, no auto-retry in v1.
- Reviewer is read-only in v1.
- Design for parallel lanes, execute sequentially at first with concurrency `1`.

## Skills Installed

Installed latest Matt Pocock skills into these roots with `matt-pocock-*` names:

- `/Users/nicksuomi/.agents/skills`
- `/Users/nicksuomi/.codex/skills`
- `/Users/nicksuomi/.config/opencode/skills`
- `/Users/nicksuomi/.cursor/skills`

Old unprefixed Matt skill duplicates were removed from these roots. Current OpenCode skill registry may need reload/restart to expose names such as `matt-pocock-handoff`.

## Suggested Skills Next

- `matt-pocock-to-issues`: break PRD into tracer-bullet implementation issues.
- `matt-pocock-tdd`: implement slices red-green-refactor.
- `matt-pocock-improve-codebase-architecture`: keep deep module seams clean.
- `matt-pocock-grill-me`: clarify remaining design choices before scaffold.
- `pnpm`: if scaffolding TypeScript project with pnpm.

If registry has not reloaded, read skill files directly from `/Users/nicksuomi/.agents/skills/matt-pocock-*/SKILL.md`.

## Recommended Next Step

1. Use `matt-pocock-to-issues` methodology on `/Users/nicksuomi/sandbox/morpheus/docs/product/PRD.md`.
2. Approve tracer-bullet slices and dependencies.
3. Decide scaffold stack before coding:
   - package manager/runtime
   - CLI framework
   - test runner
   - SQLite library
   - repo layout
4. Scaffold minimal Morpheus project.
5. Start Slice 1: `Run ledger records one preparation attempt`.

## Notes

- User prefers direct, critical architecture discussion.
- Caveman mode was enabled earlier; keep concise, factual style.
- User switched from plan mode to build mode after asking to use handoff.
