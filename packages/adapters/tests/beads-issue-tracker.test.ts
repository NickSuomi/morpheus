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
  it("lists runnable issues from current open and in-progress Beads state", async () => {
    const processRunner = fakeProcessRunner([
      ok([
        {
          id: "morph-fe0",
          title: "Read and mutate Beads issue state",
          labels: ["agent:ready", "ready-for-agent"],
          priority: 2,
          created_at: "2026-05-12T22:55:16Z",
          updated_at: "2026-05-12T22:55:16Z",
          dependency_count: 1,
          dependent_count: 2,
          dependencies: [
            {
              issue_id: "morph-fe0",
              depends_on_id: "morph-bqg",
            },
          ],
        },
      ]),
      ok([]),
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
        dependencyCount: 1,
        dependentCount: 2,
        dependencyIds: ["morph-bqg"],
        derivedState: {
          status: "active",
          state: "agent:ready",
        },
        lane: "preparation",
      },
    ]);
    expect(processRunner.calls).toEqual([
      {
        command: "bd",
        args: ["list", "--status", "open,in_progress", "--limit", "0", "--json"],
      },
    ]);
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
      ok([]),
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
        args: ["list", "--status", "open,in_progress", "--limit", "0", "--json"],
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
        args: ["list", "--status", "open,in_progress", "--limit", "0", "--json"],
      });
    }
  });

  it("returns typed parse failures for non-object issue rows", async () => {
    const processRunner = fakeProcessRunner([ok(["not an issue"])]);

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
        args: ["list", "--status", "open,in_progress", "--limit", "0", "--json"],
        message: "Expected issue row to be an object",
      });
    }
  });

  it("returns typed parse failures for non-array issue labels", async () => {
    const processRunner = fakeProcessRunner([
      ok([
        {
          id: "morph-fe0",
          title: "Read and mutate Beads issue state",
          labels: "agent:ready",
        },
      ]),
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
        args: ["list", "--status", "open,in_progress", "--limit", "0", "--json"],
        message: "Expected issue labels to be an array",
      });
    }
  });

  it("returns typed parse failures for non-string issue labels", async () => {
    const processRunner = fakeProcessRunner([
      ok([
        {
          id: "morph-fe0",
          title: "Read and mutate Beads issue state",
          labels: ["agent:ready", 42],
        },
      ]),
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
        args: ["list", "--status", "open,in_progress", "--limit", "0", "--json"],
        message: "Expected issue labels to contain only strings",
      });
    }
  });

  it("returns typed parse failures for malformed bd show issue rows", async () => {
    const processRunner = fakeProcessRunner([ok(["not an issue"])]);

    const result = await runEitherWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.getIssue("morph-fe0");
      }),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "IssueTrackerJsonParseError",
        command: "bd",
        args: ["show", "morph-fe0", "--json"],
        message: "Expected issue row to be an object",
      });
    }
  });

  it("applies planned state transitions by replacing labels with the complete final label set", async () => {
    const processRunner = fakeProcessRunner([
      ok([
        {
          id: "morph-fe0",
          title: "Read and mutate Beads issue state",
          labels: ["bug", "ready-for-agent", "agent:ready"],
        },
      ]),
      ok([]),
    ]);
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
        args: ["show", "morph-fe0", "--json"],
      },
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
    const processRunner = fakeProcessRunner([
      ok([
        {
          id: "morph-fe0",
          title: "Read and mutate Beads issue state",
          labels: ["agent:ready"],
        },
      ]),
      failed("transition labels failed"),
    ]);
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
        stderr: "transition labels failed",
      });
    }
    expect(processRunner.calls).toEqual([
      {
        command: "bd",
        args: ["show", "morph-fe0", "--json"],
      },
      {
        command: "bd",
        args: ["update", "morph-fe0", "--set-labels", "agent:preparing"],
      },
    ]);
  });

  it("does not apply non-planned transition results", async () => {
    const processRunner = fakeProcessRunner([]);
    const plan = planAgentStateTransition(["agent:prepared", "agent:running"], "StartPreparation");

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

  it("replans state transitions from current labels before applying labels", async () => {
    const processRunner = fakeProcessRunner([
      ok([
        {
          id: "morph-fe0",
          title: "Read and mutate Beads issue state",
          labels: ["human-added", "agent:preparing"],
        },
      ]),
      ok([]),
    ]);
    const stalePlan = planAgentStateTransition(["agent:preparing"], "PreparationReady");

    const result = await runWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.applyAgentState("morph-fe0", stalePlan);
      }),
    );

    expect(result).toEqual({
      status: "applied",
      issueId: "morph-fe0",
      addLabels: ["agent:prepared"],
      removeLabels: ["agent:preparing"],
    });
    expect(processRunner.calls.slice(-1)).toEqual([
      {
        command: "bd",
        args: [
          "update",
          "morph-fe0",
          "--set-labels",
          "human-added",
          "--set-labels",
          "agent:prepared",
        ],
      },
    ]);
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

  it("preserves imported GitLab metadata when writing contract metadata", async () => {
    const gitlabMetadata = {
      project: "group/project",
      iid: 42,
      webUrl: "https://gitlab.example.com/group/project/-/issues/42",
      labels: ["agent:ready", "backend"],
      lastSyncedAt: "2026-05-19T09:00:00.000Z",
      title: "Imported GitLab issue",
      description: "Ready for Morpheus.",
    };
    const processRunner = fakeProcessRunner([
      ok([
        {
          id: "morph-kkv",
          title: "Store Agent-Ready Contract in Beads metadata",
          labels: ["agent:preparing"],
          metadata: {
            morpheus: {
              gitlab: gitlabMetadata,
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
    expect(processRunner.calls.at(-1)?.args).toEqual([
      "update",
      "morph-kkv",
      "--metadata",
      JSON.stringify({
        morpheus: {
          gitlab: gitlabMetadata,
          contractVersion: 1,
          agentReadyContract: validContract,
        },
      }),
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

  it("creates a Beads issue for a new GitLab import with ready metadata", async () => {
    const processRunner = fakeProcessRunner([
      ok([]),
      ok({
        id: "morph-new",
        title: "Import me",
        labels: ["agent:ready"],
      }),
    ]);

    const result = await runWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.upsertImportedGitLabIssue({
          syncedAt: "2026-05-19T10:00:00.000Z",
          source: {
            project: "group/project",
            iid: 42,
            title: "Import me",
            description: "Ready for Morpheus.",
            webUrl: "https://gitlab.example.com/group/project/-/issues/42",
            labels: ["agent:ready", "backend"],
          },
        });
      }),
    );

    expect(result).toEqual({
      status: "created",
      issueId: "morph-new",
      addedReadyLabel: true,
    });
    expect(processRunner.calls).toEqual([
      { command: "bd", args: ["list", "--all", "--limit", "0", "--json"] },
      {
        command: "bd",
        args: [
          "create",
          "Import me",
          "--description",
          "Ready for Morpheus.",
          "--type",
          "task",
          "--priority",
          "P2",
          "--labels",
          "agent:ready",
          "--metadata",
          JSON.stringify({
            morpheus: {
              gitlab: {
                project: "group/project",
                iid: 42,
                webUrl: "https://gitlab.example.com/group/project/-/issues/42",
                labels: ["agent:ready", "backend"],
                lastSyncedAt: "2026-05-19T10:00:00.000Z",
                title: "Import me",
                description: "Ready for Morpheus.",
              },
            },
          }),
          "--json",
        ],
      },
    ]);
  });

  it("creates only one Beads issue when the same GitLab source syncs repeatedly", async () => {
    const imported = {
      id: "morph-existing",
      title: "Import me",
      description: "Ready for Morpheus.",
      labels: ["agent:ready"],
      metadata: {
        morpheus: {
          gitlab: {
            project: "group/project",
            iid: 42,
            webUrl: "https://gitlab.example.com/group/project/-/issues/42",
            labels: ["agent:ready", "backend"],
            lastSyncedAt: "2026-05-19T10:00:00.000Z",
            title: "Import me",
            description: "Ready for Morpheus.",
          },
        },
      },
    };
    const processRunner = fakeProcessRunner([
      ok([]),
      ok({
        id: "morph-existing",
        title: "Import me",
        labels: ["agent:ready"],
      }),
      ok([imported]),
      ok([imported]),
      ok([]),
    ]);

    const first = await runWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.upsertImportedGitLabIssue({
          syncedAt: "2026-05-19T10:00:00.000Z",
          source: {
            project: "group/project",
            iid: 42,
            title: "Import me",
            description: "Ready for Morpheus.",
            webUrl: "https://gitlab.example.com/group/project/-/issues/42",
            labels: ["agent:ready", "backend"],
          },
        });
      }),
    );

    const second = await runWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.upsertImportedGitLabIssue({
          syncedAt: "2026-05-19T10:01:00.000Z",
          source: {
            project: "group/project",
            iid: 42,
            title: "Import me",
            description: "Ready for Morpheus.",
            webUrl: "https://gitlab.example.com/group/project/-/issues/42",
            labels: ["agent:ready", "backend"],
          },
        });
      }),
    );

    expect(first).toEqual({
      status: "created",
      issueId: "morph-existing",
      addedReadyLabel: true,
    });
    expect(second).toEqual({
      status: "skipped",
      issueId: "morph-existing",
      reason: "unchanged",
    });
    expect(processRunner.calls.filter((call) => call.args[0] === "create")).toHaveLength(1);
  });

  it("updates imported GitLab issue content and metadata", async () => {
    const processRunner = fakeProcessRunner([
      ok([
        {
          id: "morph-existing",
          title: "Old title",
          description: "Old body",
          labels: ["triaged"],
          metadata: {
            morpheus: {
              gitlab: {
                project: "group/project",
                iid: 42,
                webUrl: "https://gitlab.example.com/group/project/-/issues/42",
                labels: ["agent:ready"],
                lastSyncedAt: "2026-05-19T09:00:00.000Z",
                title: "Old title",
                description: "Old body",
              },
            },
          },
        },
      ]),
      ok([
        {
          id: "morph-existing",
          title: "Old title",
          description: "Old body",
          labels: ["triaged"],
          metadata: {
            external: true,
            morpheus: {
              contractVersion: 1,
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
        return yield* tracker.upsertImportedGitLabIssue({
          syncedAt: "2026-05-19T10:00:00.000Z",
          source: {
            project: "group/project",
            iid: 42,
            title: "New title",
            description: "New body",
            webUrl: "https://gitlab.example.com/group/project/-/issues/42",
            labels: ["agent:ready", "backend"],
          },
        });
      }),
    );

    expect(result).toEqual({
      status: "updated",
      issueId: "morph-existing",
      addedReadyLabel: true,
    });
    expect(processRunner.calls.at(-1)).toEqual({
      command: "bd",
      args: [
        "update",
        "morph-existing",
        "--title",
        "New title",
        "--description",
        "New body",
        "--metadata",
        JSON.stringify({
          external: true,
          morpheus: {
            contractVersion: 1,
            gitlab: {
              project: "group/project",
              iid: 42,
              webUrl: "https://gitlab.example.com/group/project/-/issues/42",
              labels: ["agent:ready", "backend"],
              lastSyncedAt: "2026-05-19T10:00:00.000Z",
              title: "New title",
              description: "New body",
            },
          },
        }),
        "--set-labels",
        "triaged",
        "--set-labels",
        "agent:ready",
      ],
    });
  });

  it("does not add ready when an imported issue already has an active lifecycle label", async () => {
    const processRunner = fakeProcessRunner([
      ok([
        {
          id: "morph-running",
          title: "Old title",
          description: "Old body",
          labels: ["agent:running", "triaged"],
          metadata: {
            morpheus: {
              gitlab: {
                project: "group/project",
                iid: 42,
                webUrl: "https://gitlab.example.com/group/project/-/issues/42",
                labels: ["agent:ready"],
                lastSyncedAt: "2026-05-19T09:00:00.000Z",
                title: "Old title",
                description: "Old body",
              },
            },
          },
        },
      ]),
      ok([
        {
          id: "morph-running",
          title: "Old title",
          description: "Old body",
          labels: ["agent:running", "triaged"],
          metadata: {
            morpheus: {},
          },
        },
      ]),
      ok([]),
    ]);

    const result = await runWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.upsertImportedGitLabIssue({
          syncedAt: "2026-05-19T10:00:00.000Z",
          source: {
            project: "group/project",
            iid: 42,
            title: "New title",
            description: "New body",
            webUrl: "https://gitlab.example.com/group/project/-/issues/42",
            labels: [],
          },
        });
      }),
    );

    expect(result).toEqual({
      status: "updated",
      issueId: "morph-running",
      addedReadyLabel: false,
    });
    expect(processRunner.calls.at(-1)?.args).toEqual([
      "update",
      "morph-running",
      "--title",
      "New title",
      "--description",
      "New body",
      "--metadata",
      expect.any(String),
    ]);
  });

  it("blocks an active imported issue when GitLab carries the stop label", async () => {
    const imported = {
      id: "morph-running",
      title: "Import me",
      description: "Ready for Morpheus.",
      labels: ["agent:running", "triaged"],
      metadata: {
        morpheus: {
          gitlab: {
            project: "group/project",
            iid: 42,
            webUrl: "https://gitlab.example.com/group/project/-/issues/42",
            labels: ["agent:running"],
            lastSyncedAt: "2026-05-19T09:00:00.000Z",
            title: "Import me",
            description: "Ready for Morpheus.",
          },
        },
      },
    };
    const processRunner = fakeProcessRunner([ok([imported]), ok([imported]), ok([])]);

    const result = await runWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.upsertImportedGitLabIssue({
          syncedAt: "2026-05-19T10:00:00.000Z",
          source: {
            project: "group/project",
            iid: 42,
            title: "Import me",
            description: "Ready for Morpheus.",
            webUrl: "https://gitlab.example.com/group/project/-/issues/42",
            labels: ["agent:stop", "backend"],
          },
        });
      }),
    );

    expect(result).toEqual({
      status: "updated",
      issueId: "morph-running",
      addedReadyLabel: false,
    });
    expect(processRunner.calls.at(-1)?.args.slice(-4)).toEqual([
      "--set-labels",
      "triaged",
      "--set-labels",
      "agent:blocked",
    ]);
  });

  it.each(["agent:blocked", "agent:failed"] as const)(
    "requeues imported GitLab issue from %s when GitLab ready is set",
    async (agentLabel) => {
      const imported = {
        id: "morph-terminal",
        title: "Import me",
        description: "Ready for Morpheus.",
        labels: [agentLabel, "triaged"],
        metadata: {
          morpheus: {
            gitlab: {
              project: "group/project",
              iid: 42,
              webUrl: "https://gitlab.example.com/group/project/-/issues/42",
              labels: ["agent:ready"],
              lastSyncedAt: "2026-05-19T09:00:00.000Z",
              title: "Import me",
              description: "Ready for Morpheus.",
            },
          },
        },
      };
      const processRunner = fakeProcessRunner([ok([imported]), ok([imported]), ok([])]);

      const result = await runWithTracker(
        processRunner.layer,
        Effect.gen(function* () {
          const tracker = yield* IssueTracker;
          return yield* tracker.upsertImportedGitLabIssue({
            syncedAt: "2026-05-19T10:00:00.000Z",
            source: {
              project: "group/project",
              iid: 42,
              title: "Import me",
              description: "Ready for Morpheus.",
              webUrl: "https://gitlab.example.com/group/project/-/issues/42",
              labels: ["agent:ready", "backend"],
            },
          });
        }),
      );

      expect(result).toEqual({
        status: "updated",
        issueId: "morph-terminal",
        addedReadyLabel: true,
      });
      expect(processRunner.calls.at(-1)?.args.slice(-4)).toEqual([
        "--set-labels",
        "triaged",
        "--set-labels",
        "agent:ready",
      ]);
    },
  );

  it("does not requeue an imported GitLab issue already waiting for review", async () => {
    const imported = {
      id: "morph-review",
      title: "Import me",
      description: "Ready for Morpheus.",
      labels: ["agent:review-candidate", "triaged"],
      metadata: {
        morpheus: {
          gitlab: {
            project: "group/project",
            iid: 42,
            webUrl: "https://gitlab.example.com/group/project/-/issues/42",
            labels: ["agent:ready"],
            lastSyncedAt: "2026-05-19T09:00:00.000Z",
            title: "Import me",
            description: "Ready for Morpheus.",
          },
        },
      },
    };
    const processRunner = fakeProcessRunner([ok([imported]), ok([imported]), ok([])]);

    const result = await runWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.upsertImportedGitLabIssue({
          syncedAt: "2026-05-19T10:00:00.000Z",
          source: {
            project: "group/project",
            iid: 42,
            title: "Import me",
            description: "Ready for Morpheus.",
            webUrl: "https://gitlab.example.com/group/project/-/issues/42",
            labels: ["agent:ready", "backend"],
          },
        });
      }),
    );

    expect(result).toEqual({
      status: "updated",
      issueId: "morph-review",
      addedReadyLabel: false,
    });
    expect(processRunner.calls.at(-1)?.args).not.toContain("--set-labels");
  });

  it("detects duplicate imported GitLab issues and makes both non-runnable", async () => {
    const imported = (id: string) => ({
      id,
      title: "Import me",
      description: "Ready for Morpheus.",
      labels: ["agent:ready"],
      metadata: {
        morpheus: {
          gitlab: {
            project: "group/project",
            iid: 2793,
            webUrl: "https://gitlab.example.com/group/project/-/issues/2793",
            labels: ["agent:ready"],
            lastSyncedAt: "2026-05-19T09:00:00.000Z",
            title: "Import me",
            description: "Ready for Morpheus.",
          },
        },
      },
    });
    const processRunner = fakeProcessRunner([
      ok([imported("morph-primary"), imported("morph-dupe")]),
      ok([]),
      ok([]),
    ]);

    const result = await runWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.upsertImportedGitLabIssue({
          syncedAt: "2026-05-19T10:00:00.000Z",
          source: {
            project: "group/project",
            iid: 2793,
            title: "Import me",
            description: "Ready for Morpheus.",
            webUrl: "https://gitlab.example.com/group/project/-/issues/2793",
            labels: ["agent:ready"],
          },
        });
      }),
    );

    expect(result).toEqual({
      status: "skipped",
      issueId: "morph-primary",
      reason: "duplicate_detected",
      duplicateIssueIds: ["morph-dupe"],
    });
    expect(processRunner.calls).toEqual([
      { command: "bd", args: ["list", "--all", "--limit", "0", "--json"] },
      { command: "bd", args: ["update", "morph-primary", "--set-labels", "agent:failed"] },
      { command: "bd", args: ["update", "morph-dupe", "--set-labels", "agent:failed"] },
    ]);
  });

  it("fails closed for legacy GitLab imports that only carry source identity in prose", async () => {
    const processRunner = fakeProcessRunner([
      ok([
        {
          id: "morph-legacy",
          title: "Import me",
          description:
            "Legacy import without Morpheus metadata.\n\nSource: group/project#42\nhttps://gitlab.example.com/group/project/-/issues/42",
          labels: ["agent:ready"],
          metadata: {},
        },
      ]),
      ok([]),
    ]);

    const result = await runWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.upsertImportedGitLabIssue({
          syncedAt: "2026-05-19T10:00:00.000Z",
          source: {
            project: "group/project",
            iid: 42,
            title: "Import me",
            description: "Ready for Morpheus.",
            webUrl: "https://gitlab.example.com/group/project/-/issues/42",
            labels: ["agent:ready", "backend"],
          },
        });
      }),
    );

    expect(result).toEqual({
      status: "skipped",
      issueId: "morph-legacy",
      reason: "duplicate_detected",
    });
    expect(processRunner.calls).toEqual([
      { command: "bd", args: ["list", "--all", "--limit", "0", "--json"] },
      { command: "bd", args: ["update", "morph-legacy", "--set-labels", "agent:failed"] },
    ]);
  });

  it("does not treat a different legacy source identity prefix as a duplicate", async () => {
    const processRunner = fakeProcessRunner([
      ok([
        {
          id: "morph-other",
          title: "Other import",
          description: "Legacy import without Morpheus metadata.\n\nSource: group/project#420",
          labels: ["agent:ready"],
          metadata: {},
        },
      ]),
      ok({
        id: "morph-new",
        title: "Import me",
        labels: ["agent:ready"],
      }),
    ]);

    const result = await runWithTracker(
      processRunner.layer,
      Effect.gen(function* () {
        const tracker = yield* IssueTracker;
        return yield* tracker.upsertImportedGitLabIssue({
          syncedAt: "2026-05-19T10:00:00.000Z",
          source: {
            project: "group/project",
            iid: 42,
            title: "Import me",
            description: "Ready for Morpheus.",
            webUrl: "https://gitlab.example.com/group/project/-/issues/42",
            labels: ["agent:ready", "backend"],
          },
        });
      }),
    );

    expect(result).toEqual({
      status: "created",
      issueId: "morph-new",
      addedReadyLabel: true,
    });
    expect(processRunner.calls.some((call) => call.args.includes("morph-other"))).toBe(false);
  });

  it("skips unchanged imported GitLab issues", async () => {
    const processRunner = fakeProcessRunner([
      ok([
        {
          id: "morph-existing",
          title: "Import me",
          description: "Ready for Morpheus.",
          labels: ["agent:ready"],
          metadata: {
            morpheus: {
              gitlab: {
                project: "group/project",
                iid: 42,
                webUrl: "https://gitlab.example.com/group/project/-/issues/42",
                labels: ["agent:ready", "backend"],
                lastSyncedAt: "2026-05-19T09:00:00.000Z",
                title: "Import me",
                description: "Ready for Morpheus.",
              },
            },
          },
        },
      ]),
      ok([
        {
          id: "morph-existing",
          title: "Import me",
          description: "Ready for Morpheus.",
          labels: ["agent:ready"],
          metadata: {
            morpheus: {
              gitlab: {
                project: "group/project",
                iid: 42,
                webUrl: "https://gitlab.example.com/group/project/-/issues/42",
                labels: ["agent:ready", "backend"],
                lastSyncedAt: "2026-05-19T09:00:00.000Z",
                title: "Import me",
                description: "Ready for Morpheus.",
              },
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
        return yield* tracker.upsertImportedGitLabIssue({
          syncedAt: "2026-05-19T10:00:00.000Z",
          source: {
            project: "group/project",
            iid: 42,
            title: "Import me",
            description: "Ready for Morpheus.",
            webUrl: "https://gitlab.example.com/group/project/-/issues/42",
            labels: ["agent:ready", "backend"],
          },
        });
      }),
    );

    expect(result).toEqual({
      status: "skipped",
      issueId: "morph-existing",
      reason: "unchanged",
    });
    expect(processRunner.calls).toEqual([
      { command: "bd", args: ["list", "--all", "--limit", "0", "--json"] },
      { command: "bd", args: ["show", "morph-existing", "--json"] },
      {
        command: "bd",
        args: [
          "update",
          "morph-existing",
          "--metadata",
          JSON.stringify({
            morpheus: {
              gitlab: {
                project: "group/project",
                iid: 42,
                webUrl: "https://gitlab.example.com/group/project/-/issues/42",
                labels: ["agent:ready", "backend"],
                lastSyncedAt: "2026-05-19T10:00:00.000Z",
                title: "Import me",
                description: "Ready for Morpheus.",
              },
            },
          }),
        ],
      },
    ]);
  });
});
