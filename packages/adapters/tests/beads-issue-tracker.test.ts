import { planAgentStateTransition } from "@morpheus/core";
import {
  IssueTracker,
  ProcessRunner,
  ProcessRunnerError,
  type ProcessResult,
  type ProcessRunnerService,
} from "@morpheus/runtime";
import { Effect, Either, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { beadsIssueTrackerLayer } from "../src/index.js";

const ok = (stdout: unknown): ProcessResult => ({
  stdout: JSON.stringify(stdout),
  stderr: "",
  exitCode: 0,
});

const failed = (stderr: string): ProcessResult => ({
  stdout: "",
  stderr,
  exitCode: 1,
});

const validContract = {
  category: "task",
  summary: "Persist contracts in Beads metadata.",
  currentBehavior: "Morpheus reads issue prose only.",
  desiredBehavior: "Morpheus stores typed contract metadata.",
  keyInterfaces: ["IssueTracker.readContract", "IssueTracker.writeContract"],
  acceptanceCriteria: ["Valid contracts round-trip through Beads metadata."],
  outOfScope: ["GitLab MR rendering"],
  verificationPlan: ["pnpm check"],
  blockedBy: "None",
  hitlDecisions: "None",
  riskLevel: "medium",
} as const;

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

const testLayer = (processRunnerLayer: Layer.Layer<ProcessRunner>) =>
  beadsIssueTrackerLayer.pipe(Layer.provide(processRunnerLayer));

const runWithTracker = <A, E>(
  processRunnerLayer: Layer.Layer<ProcessRunner>,
  program: Effect.Effect<A, E, IssueTracker>,
) => Effect.runPromise(program.pipe(Effect.provide(testLayer(processRunnerLayer))));

const runEitherWithTracker = <A, E>(
  processRunnerLayer: Layer.Layer<ProcessRunner>,
  program: Effect.Effect<A, E, IssueTracker>,
) => Effect.runPromise(Effect.either(program).pipe(Effect.provide(testLayer(processRunnerLayer))));

describe("BeadsIssueTracker", () => {
  it("lists runnable issues from bd ready JSON output", async () => {
    const processRunner = fakeProcessRunner([
      ok([
        {
          id: "morph-fe0",
          title: "Read and mutate Beads issue state",
          labels: ["agent:ready", "ready-for-agent"],
          priority: 2,
          created_at: "2026-05-12T22:55:16Z",
          updated_at: "2026-05-12T22:55:16Z",
        },
      ]),
    ]);

    const result = await runWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.listRunnableIssues();
      }),
    );

    expect(result).toEqual([
      {
        id: "morph-fe0",
        title: "Read and mutate Beads issue state",
        labels: ["agent:ready", "ready-for-agent"],
        priority: 2,
        createdAt: "2026-05-12T22:55:16Z",
        updatedAt: "2026-05-12T22:55:16Z",
        derivedState: {
          status: "active",
          state: "agent:ready",
        },
        lane: "preparation",
      },
    ]);
    expect(processRunner.calls).toEqual([{ command: "bd", args: ["ready", "--json"] }]);
  });

  it("fails closed when runnable issue labels contain conflicting agent states", async () => {
    const processRunner = fakeProcessRunner([
      ok([
        {
          id: "morph-conflict",
          title: "Conflict",
          labels: ["agent:ready", "agent:running"],
          priority: 2,
        },
      ]),
    ]);

    const result = await runWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.listRunnableIssues();
      }),
    );

    expect(result).toMatchObject([
      {
        id: "morph-conflict",
        derivedState: {
          status: "conflict",
          failureKind: "state_conflict",
          activeStates: ["agent:ready", "agent:running"],
        },
        lane: "none",
      },
    ]);
  });

  it("gets one issue from bd show JSON output", async () => {
    const processRunner = fakeProcessRunner([
      ok([
        {
          id: "morph-fe0",
          title: "Read and mutate Beads issue state",
          labels: ["agent:prepared"],
          priority: 2,
        },
      ]),
    ]);

    const result = await runWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.getIssue("morph-fe0");
      }),
    );

    expect(result).toMatchObject({
      id: "morph-fe0",
      derivedState: {
        status: "active",
        state: "agent:prepared",
      },
      lane: "implementation",
    });
    expect(processRunner.calls).toEqual([{ command: "bd", args: ["show", "morph-fe0", "--json"] }]);
  });

  it("returns typed command failures", async () => {
    const processRunner = fakeProcessRunner([failed("bd failed")]);

    const result = await runEitherWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.listRunnableIssues();
      }),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "IssueTrackerCommandError",
        command: "bd",
        args: ["ready", "--json"],
        exitCode: 1,
        stderr: "bd failed",
      });
    }
  });

  it("returns typed parse failures for malformed JSON", async () => {
    const processRunner = fakeProcessRunner([
      {
        stdout: "{",
        stderr: "",
        exitCode: 0,
      },
    ]);

    const result = await runEitherWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.listRunnableIssues();
      }),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "IssueTrackerJsonParseError",
        command: "bd",
        args: ["ready", "--json"],
      });
    }
  });

  it("applies planned state transitions through one atomic bd label set", async () => {
    const processRunner = fakeProcessRunner([ok([])]);
    const plan = planAgentStateTransition(
      ["bug", "ready-for-agent", "agent:ready"],
      "StartPreparation",
    );

    const result = await runWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.applyAgentState("morph-fe0", plan);
      }),
    );

    expect(result).toEqual({
      status: "applied",
      issueId: "morph-fe0",
      addLabels: ["agent:preparing"],
      removeLabels: ["agent:ready"],
    });
    expect(processRunner.calls).toEqual([
      {
        command: "bd",
        args: [
          "update",
          "morph-fe0",
          "--set-labels",
          "bug",
          "--set-labels",
          "ready-for-agent",
          "--set-labels",
          "agent:preparing",
        ],
      },
    ]);
  });

  it("does not remove an agent label before a failed planned transition", async () => {
    const processRunner = fakeProcessRunner([failed("set labels failed")]);
    const plan = planAgentStateTransition(["agent:ready"], "StartPreparation");

    const result = await runEitherWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.applyAgentState("morph-fe0", plan);
      }),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "IssueTrackerCommandError",
        args: ["update", "morph-fe0", "--set-labels", "agent:preparing"],
        stderr: "set labels failed",
      });
    }
    expect(processRunner.calls).toEqual([
      {
        command: "bd",
        args: ["update", "morph-fe0", "--set-labels", "agent:preparing"],
      },
    ]);
    expect(processRunner.calls.flatMap((call) => call.args)).not.toContain("--remove-label");
    expect(processRunner.calls.flatMap((call) => call.args)).not.toContain("--add-label");
  });

  it("does not apply non-planned transition results", async () => {
    const processRunner = fakeProcessRunner([]);
    const plan = planAgentStateTransition(["agent:ready", "agent:running"], "StartPreparation");

    const result = await runWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.applyAgentState("morph-fe0", plan);
      }),
    );

    expect(result).toEqual({
      status: "rejected",
      issueId: "morph-fe0",
      reason: "conflict",
      plan,
    });
    expect(processRunner.calls).toEqual([]);
  });

  it("writes contract metadata without replacing existing metadata keys", async () => {
    const processRunner = fakeProcessRunner([
      ok([
        {
          id: "morph-kkv",
          title: "Store Agent-Ready Contract in Beads metadata",
          labels: ["agent:preparing"],
          metadata: {
            external: {
              value: true,
            },
          },
        },
      ]),
      ok([]),
    ]);

    const result = await runWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.writeContract("morph-kkv", validContract);
      }),
    );

    expect(result).toEqual({
      status: "written",
      issueId: "morph-kkv",
    });
    expect(processRunner.calls).toEqual([
      { command: "bd", args: ["show", "morph-kkv", "--json"] },
      {
        command: "bd",
        args: [
          "update",
          "morph-kkv",
          "--metadata",
          JSON.stringify({
            external: {
              value: true,
            },
            morpheus: {
              contractVersion: 1,
              agentReadyContract: validContract,
            },
          }),
        ],
      },
    ]);
  });

  it("reads present contract metadata", async () => {
    const processRunner = fakeProcessRunner([
      ok([
        {
          id: "morph-kkv",
          title: "Store Agent-Ready Contract in Beads metadata",
          labels: ["agent:prepared"],
          metadata: {
            morpheus: {
              contractVersion: 1,
              agentReadyContract: validContract,
            },
          },
        },
      ]),
    ]);

    const result = await runWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.readContract("morph-kkv");
      }),
    );

    expect(result).toEqual({
      status: "present",
      issueId: "morph-kkv",
      contract: validContract,
    });
  });

  it("returns missing when contract metadata is absent", async () => {
    const processRunner = fakeProcessRunner([
      ok([
        {
          id: "morph-kkv",
          title: "Store Agent-Ready Contract in Beads metadata",
          labels: ["agent:preparing"],
          metadata: {
            external: true,
          },
        },
      ]),
    ]);

    const result = await runWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.readContract("morph-kkv");
      }),
    );

    expect(result).toEqual({
      status: "missing",
      issueId: "morph-kkv",
    });
  });

  it("returns typed malformed metadata for invalid Morpheus metadata shape", async () => {
    const processRunner = fakeProcessRunner([
      ok([
        {
          id: "morph-kkv",
          title: "Store Agent-Ready Contract in Beads metadata",
          labels: ["agent:preparing"],
          metadata: {
            morpheus: {
              contractVersion: 2,
              agentReadyContract: validContract,
            },
          },
        },
      ]),
    ]);

    const result = await runEitherWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.readContract("morph-kkv");
      }),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "IssueTrackerMalformedMetadataError",
        issueId: "morph-kkv",
      });
    }
  });

  it("returns typed schema validation failures for invalid contract metadata", async () => {
    const processRunner = fakeProcessRunner([
      ok([
        {
          id: "morph-kkv",
          title: "Store Agent-Ready Contract in Beads metadata",
          labels: ["agent:preparing"],
          metadata: {
            morpheus: {
              contractVersion: 1,
              agentReadyContract: {
                ...validContract,
                riskLevel: "severe",
              },
            },
          },
        },
      ]),
    ]);

    const result = await runEitherWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.readContract("morph-kkv");
      }),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "IssueTrackerContractSchemaError",
        issueId: "morph-kkv",
      });
    }
  });

  it("returns typed malformed metadata for non-object issue metadata", async () => {
    const processRunner = fakeProcessRunner([
      ok([
        {
          id: "morph-kkv",
          title: "Store Agent-Ready Contract in Beads metadata",
          labels: ["agent:preparing"],
          metadata: "broken",
        },
      ]),
    ]);

    const result = await runEitherWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.readContract("morph-kkv");
      }),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "IssueTrackerMalformedMetadataError",
        issueId: "morph-kkv",
      });
    }
  });

  it("returns typed schema validation before writing invalid contract metadata", async () => {
    const processRunner = fakeProcessRunner([
      ok([
        {
          id: "morph-kkv",
          title: "Store Agent-Ready Contract in Beads metadata",
          labels: ["agent:preparing"],
          metadata: {},
        },
      ]),
    ]);

    const result = await runEitherWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.writeContract("morph-kkv", {
          ...validContract,
          riskLevel: "severe",
        } as never);
      }),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "IssueTrackerContractSchemaError",
        issueId: "morph-kkv",
      });
    }
    expect(processRunner.calls).toEqual([{ command: "bd", args: ["show", "morph-kkv", "--json"] }]);
  });
});
