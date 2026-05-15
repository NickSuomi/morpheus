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
    program.pipe(Effect.provide(glabMergeRequestClientLayer.pipe(Layer.provide(processRunnerLayer)))),
  );

const runWithWorkspace = <A, E>(
  processRunnerLayer: Layer.Layer<ProcessRunner>,
  program: Effect.Effect<A, E, WorkspaceRuntime>,
) =>
  Effect.runPromise(
    program.pipe(Effect.provide(gitWorkspaceRuntimeLayer.pipe(Layer.provide(processRunnerLayer)))),
  );

describe("GitWorkspaceRuntime", () => {
  it("prepares implementation branch state through ProcessRunner-owned git", async () => {
    const processRunner = fakeProcessRunner([
      ok("/repo\n"),
      ok("main\n"),
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
        args: [
          "worktree",
          "add",
          "-b",
          "morpheus/morph-7ky-run_01KRGGDQ6JQN2GMD6KJQ5SFXR6",
          "/.morpheus-worktree-run_01KRGGDQ6JQN2GMD6KJQ5SFXR6",
          "main",
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
          title: "Draft: Create Draft MR before implementation",
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
          "Draft: Create Draft MR before implementation",
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
});
