import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import {
  GitLabIssueSource,
  GitLabIssueSourceCommandError,
  GitLabIssueSourceParseError,
  IssueTracker,
  IssueTrackerCommandError,
  syncGitLabIssues,
  type GitLabIssueInput,
  type GitLabIssueSourceService,
  type IssueTrackerService,
  type UpsertImportedGitLabIssueInput,
} from "../src/index.js";

const gitlabIssue = (options: Partial<GitLabIssueInput> = {}): GitLabIssueInput => ({
  project: "group/project",
  iid: 42,
  title: "Import me",
  description: "Ready for Morpheus.",
  webUrl: "https://gitlab.example.com/group/project/-/issues/42",
  labels: ["agent:ready", "backend"],
  ...options,
});

const issueSourceLayer = (
  service: Partial<GitLabIssueSourceService>,
): Layer.Layer<GitLabIssueSource> =>
  Layer.succeed(GitLabIssueSource, {
    listReadyIssues: service.listReadyIssues ?? (() => Effect.succeed([])),
  });

const issueTrackerLayer = (service: Partial<IssueTrackerService>): Layer.Layer<IssueTracker> =>
  Layer.succeed(IssueTracker, {
    listRunnableIssues: () => Effect.succeed([]),
    getIssue: () =>
      Effect.fail(
        new IssueTrackerCommandError({
          operation: "bd",
          command: "bd",
          args: [],
          exitCode: 1,
          stderr: "not used",
        }),
      ),
    applyAgentState: () =>
      Effect.fail(
        new IssueTrackerCommandError({
          operation: "bd",
          command: "bd",
          args: [],
          exitCode: 1,
          stderr: "not used",
        }),
      ),
    writeContract: () =>
      Effect.fail(
        new IssueTrackerCommandError({
          operation: "bd",
          command: "bd",
          args: [],
          exitCode: 1,
          stderr: "not used",
        }),
      ),
    readContract: (issueId) => Effect.succeed({ status: "missing", issueId }),
    listImportedGitLabIssues: () => Effect.succeed([]),
    upsertImportedGitLabIssue:
      service.upsertImportedGitLabIssue ??
      (() => Effect.succeed({ status: "skipped", issueId: "morph-skip", reason: "unchanged" })),
  });

describe("syncGitLabIssues", () => {
  it("reports created imports", async () => {
    const calls: UpsertImportedGitLabIssueInput[] = [];
    const result = await Effect.runPromise(
      syncGitLabIssues({
        project: "group/project",
        readyLabel: "agent:ready",
        syncedAt: "2026-05-19T10:00:00.000Z",
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            issueSourceLayer({
              listReadyIssues: () => Effect.succeed([gitlabIssue()]),
            }),
            issueTrackerLayer({
              upsertImportedGitLabIssue: (input) => {
                calls.push(input);
                return Effect.succeed({
                  status: "created",
                  issueId: "morph-new",
                  addedReadyLabel: true,
                });
              },
            }),
          ),
        ),
      ),
    );

    expect(result.created).toHaveLength(1);
    expect(result.updated).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
    expect(calls).toEqual([
      {
        source: gitlabIssue(),
        syncedAt: "2026-05-19T10:00:00.000Z",
      },
    ]);
  });

  it("reports updated imports without requiring a ready-label mutation", async () => {
    const result = await Effect.runPromise(
      syncGitLabIssues({
        project: "group/project",
        readyLabel: "agent:ready",
        syncedAt: "2026-05-19T10:00:00.000Z",
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            issueSourceLayer({
              listReadyIssues: () => Effect.succeed([gitlabIssue({ title: "Changed" })]),
            }),
            issueTrackerLayer({
              upsertImportedGitLabIssue: () =>
                Effect.succeed({
                  status: "updated",
                  issueId: "morph-existing",
                  addedReadyLabel: false,
                }),
            }),
          ),
        ),
      ),
    );

    expect(result.updated).toEqual([
      {
        status: "updated",
        issueId: "morph-existing",
        addedReadyLabel: false,
      },
    ]);
  });

  it("reports skipped unchanged imports", async () => {
    const result = await Effect.runPromise(
      syncGitLabIssues({
        project: "group/project",
        readyLabel: "agent:ready",
        syncedAt: "2026-05-19T10:00:00.000Z",
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            issueSourceLayer({
              listReadyIssues: () => Effect.succeed([gitlabIssue()]),
            }),
            issueTrackerLayer({
              upsertImportedGitLabIssue: () =>
                Effect.succeed({
                  status: "skipped",
                  issueId: "morph-existing",
                  reason: "unchanged",
                }),
            }),
          ),
        ),
      ),
    );

    expect(result.skipped).toEqual([
      {
        status: "skipped",
        issueId: "morph-existing",
        reason: "unchanged",
      },
    ]);
  });

  it("reports command failures without throwing", async () => {
    const result = await Effect.runPromise(
      syncGitLabIssues({
        project: "group/project",
        readyLabel: "agent:ready",
        syncedAt: "2026-05-19T10:00:00.000Z",
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            issueSourceLayer({
              listReadyIssues: () =>
                Effect.fail(
                  new GitLabIssueSourceCommandError({
                    operation: "listReadyGitLabIssues",
                    command: "glab",
                    args: ["issue", "list"],
                    exitCode: 1,
                    stderr: "glab failed",
                  }),
                ),
            }),
            issueTrackerLayer({}),
          ),
        ),
      ),
    );

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.message).toContain("glab failed");
  });

  it("reports parse failures without throwing", async () => {
    const result = await Effect.runPromise(
      syncGitLabIssues({
        project: "group/project",
        readyLabel: "agent:ready",
        syncedAt: "2026-05-19T10:00:00.000Z",
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            issueSourceLayer({
              listReadyIssues: () =>
                Effect.fail(
                  new GitLabIssueSourceParseError({
                    operation: "parse_gitlab_issues",
                    command: "glab",
                    args: ["issue", "list"],
                    message: "Unexpected token",
                  }),
                ),
            }),
            issueTrackerLayer({}),
          ),
        ),
      ),
    );

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.message).toContain("Unexpected token");
  });
});
