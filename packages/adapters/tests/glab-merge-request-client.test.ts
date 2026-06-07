import {
  MergeRequestClient,
  ProcessRunner,
  ProcessRunnerError,
  WorkspaceRuntime,
  type ProcessResult,
  type ProcessRunnerService,
} from "@morpheus/runtime";
import { Effect, Either, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { gitWorkspaceRuntimeLayer, glabMergeRequestClientLayer } from "../src/index.js";

const ok = (stdout: unknown): ProcessResult => ({
  stdout: typeof stdout === "string" ? stdout : JSON.stringify(stdout),
  stderr: "",
  exitCode: 0,
});

const failed = (stderr: string): ProcessResult => ({
  stdout: "",
  stderr,
  exitCode: 1,
});

const fakeProcessRunner = (results: readonly ProcessResult[]) => {
  const calls: Array<{ command: string; args: readonly string[] }> = [];
  const service: ProcessRunnerService = {
    run: (command, args) =>
      Effect.gen(function* () {
        calls.push({ command, args });

        const result = results[calls.length - 1];
        if (result === undefined) {
          return yield* new ProcessRunnerError({
            command,
            args: [...args],
            message: "Unexpected process call",
          });
        }

        return result;
      }),
  };

  return {
    calls,
    layer: Layer.succeed(ProcessRunner, service),
  };
};

const runWithMergeRequests = <A, E>(
  processRunnerLayer: Layer.Layer<ProcessRunner>,
  program: Effect.Effect<A, E, MergeRequestClient>,
) =>
  Effect.runPromise(
    program.pipe(
      Effect.provide(glabMergeRequestClientLayer.pipe(Layer.provide(processRunnerLayer))),
    ),
  );

const runWithWorkspace = <A, E>(
  processRunnerLayer: Layer.Layer<ProcessRunner>,
  program: Effect.Effect<A, E, WorkspaceRuntime>,
  options: Parameters<typeof gitWorkspaceRuntimeLayer>[0] = {},
) =>
  Effect.runPromise(
    program.pipe(
      Effect.provide(gitWorkspaceRuntimeLayer(options).pipe(Layer.provide(processRunnerLayer))),
    ),
  );

describe("GitWorkspaceRuntime", () => {
  it("prepares implementation branch state through ProcessRunner-owned git", async () => {
    const processRunner = fakeProcessRunner([
      ok("/repo\n"),
      ok("main\n"),
      ok(""),
      ok("origin/main\n"),
      ok(""),
      ok(""),
    ]);

    const result = await runWithWorkspace(
      processRunner.layer,
      Effect.gen(function* () {
        const workspace = yield* WorkspaceRuntime;
        return yield* workspace.prepareImplementationWorkspace({
          issueId: "morph-7ky",
          runId: "run_01KRGGDQ6JQN2GMD6KJQ5SFXR6",
        });
      }),
    );

    expect(result).toEqual({
      workspacePath: "/repo",
      worktreePath: "/.morpheus-worktree-run_01KRGGDQ6JQN2GMD6KJQ5SFXR6",
      branch: "morpheus/morph-7ky-run_01KRGGDQ6JQN2GMD6KJQ5SFXR6",
      targetBranch: "main",
      baseRef: "origin/main",
      remote: "origin",
    });
    expect(processRunner.calls).toEqual([
      {
        command: "git",
        args: ["rev-parse", "--show-toplevel"],
      },
      {
        command: "git",
        args: ["branch", "--show-current"],
      },
      {
        command: "git",
        args: ["fetch", "origin", "main"],
      },
      {
        command: "git",
        args: ["rev-parse", "--verify", "origin/main"],
      },
      {
        command: "git",
        args: [
          "worktree",
          "add",
          "-b",
          "morpheus/morph-7ky-run_01KRGGDQ6JQN2GMD6KJQ5SFXR6",
          "/.morpheus-worktree-run_01KRGGDQ6JQN2GMD6KJQ5SFXR6",
          "origin/main",
        ],
      },
      {
        command: "git",
        args: [
          "push",
          "--set-upstream",
          "origin",
          "morpheus/morph-7ky-run_01KRGGDQ6JQN2GMD6KJQ5SFXR6",
        ],
      },
    ]);
  });

  it("fails before worktree side effects when configured target branch differs from checkout branch", async () => {
    const processRunner = fakeProcessRunner([ok("/repo\n"), ok("epic/stale\n")]);

    const result = await runWithWorkspace(
      processRunner.layer,
      Effect.gen(function* () {
        const workspace = yield* WorkspaceRuntime;
        return yield* workspace.prepareImplementationWorkspace({
          issueId: "morph-7ky",
          runId: "run_01KRGGDQ6JQN2GMD6KJQ5SFXR6",
        });
      }).pipe(Effect.either),
      { targetBranch: "dev-6" },
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "WorkspaceRuntimeError",
        operation: "prepareImplementationWorkspace",
        message:
          "Configured target branch dev-6 does not match current checkout branch epic/stale. Checkout the configured target branch before running Morpheus.",
      });
    }
    expect(processRunner.calls).toEqual([
      {
        command: "git",
        args: ["rev-parse", "--show-toplevel"],
      },
      {
        command: "git",
        args: ["branch", "--show-current"],
      },
    ]);
  });

  it("finalizes implementation workspace by pushing detected branch commits", async () => {
    const processRunner = fakeProcessRunner([ok("abc123\ndef456\n"), ok("")]);

    const result = await runWithWorkspace(
      processRunner.layer,
      Effect.gen(function* () {
        const workspace = yield* WorkspaceRuntime;
        return yield* workspace.finalizeImplementationWorkspace({
          issueId: "morph-7ky",
          runId: "run_01KRGGDQ6JQN2GMD6KJQ5SFXR6",
          workspace: {
            workspacePath: "/repo",
            worktreePath: "/worktree",
            branch: "morpheus/morph-7ky-run_01KRGGDQ6JQN2GMD6KJQ5SFXR6",
            targetBranch: "main",
            baseRef: "origin/main",
            remote: "origin",
          },
        });
      }),
    );

    expect(result).toEqual({ commits: ["abc123", "def456"] });
    expect(processRunner.calls).toEqual([
      {
        command: "git",
        args: ["-C", "/worktree", "rev-list", "--reverse", "origin/main..HEAD"],
      },
      {
        command: "git",
        args: [
          "-C",
          "/worktree",
          "push",
          "origin",
          "HEAD:refs/heads/morpheus/morph-7ky-run_01KRGGDQ6JQN2GMD6KJQ5SFXR6",
        ],
      },
    ]);
  });

  it("does not push when finalization finds no implementation branch commits", async () => {
    const processRunner = fakeProcessRunner([ok("")]);

    const result = await runWithWorkspace(
      processRunner.layer,
      Effect.gen(function* () {
        const workspace = yield* WorkspaceRuntime;
        return yield* workspace.finalizeImplementationWorkspace({
          issueId: "morph-7ky",
          runId: "run_01KRGGDQ6JQN2GMD6KJQ5SFXR6",
          workspace: {
            workspacePath: "/repo",
            branch: "morpheus/morph-7ky-run_01KRGGDQ6JQN2GMD6KJQ5SFXR6",
            targetBranch: "main",
            remote: "origin",
          },
        });
      }),
    );

    expect(result).toEqual({ commits: [] });
    expect(processRunner.calls).toEqual([
      {
        command: "git",
        args: ["-C", "/repo", "rev-list", "--reverse", "main..HEAD"],
      },
    ]);
  });
});

describe("GlabMergeRequestClient", () => {
  it("creates Draft MRs through ProcessRunner-owned glab", async () => {
    const processRunner = fakeProcessRunner([
      ok({
        web_url: "https://gitlab.example.com/group/project/-/merge_requests/42",
        reference: "!42",
      }),
    ]);

    const result = await runWithMergeRequests(
      processRunner.layer,
      Effect.gen(function* () {
        const mergeRequests = yield* MergeRequestClient;
        return yield* mergeRequests.createDraftMergeRequest({
          issueId: "morph-7ky",
          title: "Create Draft MR before implementation",
          sourceBranch: "morpheus/morph-7ky",
          targetBranch: "main",
          description: "Draft MR created before implementer agent execution.",
        });
      }),
    );

    expect(result).toEqual({
      reference: "!42",
      url: "https://gitlab.example.com/group/project/-/merge_requests/42",
    });
    expect(processRunner.calls).toEqual([
      {
        command: "glab",
        args: [
          "mr",
          "create",
          "--draft",
          "--source-branch",
          "morpheus/morph-7ky",
          "--target-branch",
          "main",
          "--title",
          "Create Draft MR before implementation",
          "--description",
          "Draft MR created before implementer agent execution.",
          "--yes",
        ],
      },
    ]);
  });

  it("maps glab auth/access failures to operator_access", async () => {
    const processRunner = fakeProcessRunner([failed("not logged in to GitLab")]);

    const result = await runWithMergeRequests(
      processRunner.layer,
      Effect.gen(function* () {
        const mergeRequests = yield* MergeRequestClient;
        return yield* mergeRequests.createDraftMergeRequest({
          issueId: "morph-7ky",
          title: "Draft: Create Draft MR before implementation",
          sourceBranch: "morpheus/morph-7ky",
          targetBranch: "main",
          description: "Draft MR created before implementer agent execution.",
        });
      }).pipe(Effect.either),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "MergeRequestClientError",
        operation: "createDraftMergeRequest",
        failureKind: "operator_access",
        message: "not logged in to GitLab",
      });
    }
  });

  it("finds an open MR that already references a source issue", async () => {
    const processRunner = fakeProcessRunner([
      ok([
        {
          iid: 99,
          web_url: "https://gitlab.example.com/group/project/-/merge_requests/99",
        },
      ]),
    ]);

    const result = await runWithMergeRequests(
      processRunner.layer,
      Effect.gen(function* () {
        const mergeRequests = yield* MergeRequestClient;
        return yield* mergeRequests.findOpenMergeRequestForSourceIssue({
          sourceIssueIid: 1234,
        });
      }),
    );

    expect(result).toEqual({
      reference: "!99",
      url: "https://gitlab.example.com/group/project/-/merge_requests/99",
    });
    expect(processRunner.calls).toEqual([
      {
        command: "glab",
        args: ["mr", "list", "--search", "#1234", "--output", "json", "--per-page", "100"],
      },
    ]);
  });

  it("passes MR gate when the head pipeline succeeded", async () => {
    const processRunner = fakeProcessRunner([
      ok({
        head_pipeline: { status: "success" },
      }),
    ]);

    const result = await runWithMergeRequests(
      processRunner.layer,
      Effect.gen(function* () {
        const mergeRequests = yield* MergeRequestClient;
        return yield* mergeRequests.inspectGate({
          reference: "!42",
          url: "https://gitlab.example.com/group/project/-/merge_requests/42",
        });
      }),
    );

    expect(result).toEqual({
      status: "passed",
      summary: "MR head pipeline status is success.",
    });
    expect(processRunner.calls).toEqual([
      {
        command: "glab",
        args: ["mr", "view", "!42", "--output", "json"],
      },
    ]);
  });

  it("fails MR gate when the head pipeline failed", async () => {
    const processRunner = fakeProcessRunner([
      ok({
        head_pipeline: { status: "failed" },
      }),
    ]);

    const result = await runWithMergeRequests(
      processRunner.layer,
      Effect.gen(function* () {
        const mergeRequests = yield* MergeRequestClient;
        return yield* mergeRequests.inspectGate({
          reference: "!42",
          url: "https://gitlab.example.com/group/project/-/merge_requests/42",
        });
      }),
    );

    expect(result).toEqual({
      status: "failed",
      summary: "MR head pipeline status is failed.",
    });
  });

  it("updates the full MR description through ProcessRunner-owned glab", async () => {
    const processRunner = fakeProcessRunner([
      ok({
        web_url: "https://gitlab.example.com/group/project/-/merge_requests/42",
      }),
    ]);

    const result = await runWithMergeRequests(
      processRunner.layer,
      Effect.gen(function* () {
        const mergeRequests = yield* MergeRequestClient;
        return yield* mergeRequests.updateDescription({
          reference: "!42",
          description: "# Full curated ReviewArtifact",
        });
      }),
    );

    expect(result).toEqual({
      reference: "!42",
      url: "https://gitlab.example.com/group/project/-/merge_requests/42",
    });
    expect(processRunner.calls).toEqual([
      {
        command: "glab",
        args: ["mr", "update", "!42", "--description", "# Full curated ReviewArtifact", "--yes"],
      },
    ]);
  });
});
