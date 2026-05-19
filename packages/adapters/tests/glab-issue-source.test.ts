import {
  GitLabIssueSource,
  ProcessRunner,
  ProcessRunnerError,
  type ProcessResult,
  type ProcessRunnerService,
} from "@morpheus/runtime";
import { Effect, Either, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { glabIssueSourceLayer } from "../src/index.js";

const ok = (stdout: unknown): ProcessResult => ({
  stdout: typeof stdout === "string" ? stdout : JSON.stringify(stdout),
  stderr: "",
  exitCode: 0,
});

const failed = (stderr: string, exitCode = 1): ProcessResult => ({
  stdout: "",
  stderr,
  exitCode,
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

const runWithIssueSource = <A, E>(
  processRunnerLayer: Layer.Layer<ProcessRunner>,
  program: Effect.Effect<A, E, GitLabIssueSource>,
) =>
  Effect.runPromise(
    program.pipe(Effect.provide(glabIssueSourceLayer.pipe(Layer.provide(processRunnerLayer)))),
  );

describe("GlabIssueSource", () => {
  it("lists opened GitLab issues with the configured ready label", async () => {
    const processRunner = fakeProcessRunner([
      ok([
        {
          iid: 42,
          title: "Import me",
          description: "Ready for Morpheus import.",
          web_url: "https://gitlab.example.com/group/project/-/issues/42",
          labels: ["agent:ready", "backend"],
        },
      ]),
    ]);

    const result = await runWithIssueSource(
      processRunner.layer,
      Effect.gen(function* () {
        const source = yield* GitLabIssueSource;
        return yield* source.listReadyIssues({
          project: "group/project",
          readyLabel: "agent:ready",
        });
      }),
    );

    expect(result).toEqual([
      {
        project: "group/project",
        iid: 42,
        title: "Import me",
        description: "Ready for Morpheus import.",
        webUrl: "https://gitlab.example.com/group/project/-/issues/42",
        labels: ["agent:ready", "backend"],
      },
    ]);
    expect(processRunner.calls).toEqual([
      {
        command: "glab",
        args: [
          "issue",
          "list",
          "--repo",
          "group/project",
          "--opened",
          "--label",
          "agent:ready",
          "--output",
          "json",
          "--per-page",
          "100",
        ],
      },
    ]);
  });

  it("maps auth/access failures to typed operator-access errors", async () => {
    const processRunner = fakeProcessRunner([failed("not logged in to GitLab")]);

    const result = await runWithIssueSource(
      processRunner.layer,
      Effect.gen(function* () {
        const source = yield* GitLabIssueSource;
        return yield* source.listReadyIssues({
          project: "group/project",
          readyLabel: "agent:ready",
        });
      }).pipe(Effect.either),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "GitLabIssueSourceAccessError",
        operation: "listReadyGitLabIssues",
        failureKind: "operator_access",
        message: "not logged in to GitLab",
      });
    }
  });

  it("maps non-access command failures to typed command errors", async () => {
    const processRunner = fakeProcessRunner([failed("GitLab returned 500", 2)]);

    const result = await runWithIssueSource(
      processRunner.layer,
      Effect.gen(function* () {
        const source = yield* GitLabIssueSource;
        return yield* source.listReadyIssues({
          project: "group/project",
          readyLabel: "agent:ready",
        });
      }).pipe(Effect.either),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "GitLabIssueSourceCommandError",
        operation: "listReadyGitLabIssues",
        command: "glab",
        exitCode: 2,
        stderr: "GitLab returned 500",
      });
    }
  });

  it("maps malformed JSON to typed parse errors", async () => {
    const processRunner = fakeProcessRunner([ok("{not-json")]);

    const result = await runWithIssueSource(
      processRunner.layer,
      Effect.gen(function* () {
        const source = yield* GitLabIssueSource;
        return yield* source.listReadyIssues({
          project: "group/project",
          readyLabel: "agent:ready",
        });
      }).pipe(Effect.either),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "GitLabIssueSourceParseError",
        operation: "parse_gitlab_issues",
      });
    }
  });

  it("maps missing required fields to typed schema errors", async () => {
    const processRunner = fakeProcessRunner([
      ok([
        {
          iid: 42,
          description: "Missing title.",
          web_url: "https://gitlab.example.com/group/project/-/issues/42",
          labels: ["agent:ready"],
        },
      ]),
    ]);

    const result = await runWithIssueSource(
      processRunner.layer,
      Effect.gen(function* () {
        const source = yield* GitLabIssueSource;
        return yield* source.listReadyIssues({
          project: "group/project",
          readyLabel: "agent:ready",
        });
      }).pipe(Effect.either),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "GitLabIssueSourceSchemaError",
        operation: "parse_gitlab_issues",
        message: "Expected issue title to be a string",
      });
    }
  });
});
