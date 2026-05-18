import {
  deriveIssueState,
  deriveLane,
  planAgentStateTransition,
  type AgentReadyContract,
} from "@morpheus/core";
import { Effect, Either, Layer } from "effect";
import { describe, expect, it } from "vitest";
import {
  AgentRunner,
  AgentRunnerError,
  IssueTrackerCommandError,
  prepareIssue,
  RunLedgerPersistenceError,
  RunLedger,
  IssueTracker,
  type AgentRunnerService,
  type IssueTrackerService,
  type RunLedgerService,
  type RunSummary,
  type TrackedIssue,
} from "../src/index.js";

const validContract: AgentReadyContract = {
  category: "task",
  summary: "Prepare an issue with fake AgentRunner.",
  currentBehavior: "Issue is marked agent:ready.",
  desiredBehavior: "Preparation writes a validated contract.",
  keyInterfaces: ["IssueTracker", "RunLedger", "AgentRunner"],
  acceptanceCriteria: ["Issue transitions to agent:prepared."],
  outOfScope: ["Implementation"],
  verificationPlan: ["pnpm check"],
  blockedBy: "None",
  hitlDecisions: "None",
  riskLevel: "medium",
};

const trackedIssue = (labels: readonly string[]): TrackedIssue => {
  const derivedState = deriveIssueState(labels);
  return {
    id: "morph-lpp",
    title: "Prepare an issue with fake AgentRunner",
    labels,
    derivedState,
    lane: derivedState.status === "active" ? deriveLane(derivedState.state) : "none",
  };
};

const fakeIssueTracker = (
  initialLabels: readonly string[],
  options: {
    readonly labelsAfterStart?: readonly string[];
    readonly failTerminalTo?: string;
    readonly failWriteContract?: boolean;
  } = {},
) => {
  let labels = [...initialLabels];
  let contract: AgentReadyContract | undefined;
  const calls: string[] = [];
  const service: IssueTrackerService = {
    listRunnableIssues: () => Effect.succeed([trackedIssue(labels)]),
    getIssue: () => {
      calls.push("getIssue");
      return Effect.succeed(trackedIssue(labels));
    },
    applyAgentState: (issueId, transitionPlan) => {
      calls.push(`apply:${transitionPlan.status}`);
      if (transitionPlan.status !== "planned") {
        return Effect.succeed({
          status: "rejected",
          issueId,
          reason: transitionPlan.status,
          plan: transitionPlan,
        });
      }

      if (transitionPlan.to === options.failTerminalTo) {
        return Effect.fail(
          new IssueTrackerCommandError({
            operation: "bd",
            command: "bd",
            args: ["update", issueId],
            exitCode: 1,
            stderr: "terminal transition failed",
          }),
        );
      }

      labels = [...transitionPlan.finalLabels];
      if (transitionPlan.to === "agent:preparing" && options.labelsAfterStart !== undefined) {
        labels = [...options.labelsAfterStart];
      }
      return Effect.succeed({
        status: "applied",
        issueId,
        addLabels: transitionPlan.addLabels,
        removeLabels: transitionPlan.removeLabels,
      });
    },
    writeContract: (issueId, nextContract) => {
      calls.push("writeContract");
      if (options.failWriteContract === true) {
        return Effect.fail(
          new IssueTrackerCommandError({
            operation: "bd",
            command: "bd",
            args: ["update", issueId, "--metadata"],
            exitCode: 1,
            stderr: "metadata write failed",
          }),
        );
      }
      contract = nextContract;
      return Effect.succeed({
        status: "written",
        issueId,
      });
    },
    readContract: (issueId) =>
      Effect.succeed(
        contract === undefined
          ? {
              status: "missing",
              issueId,
            }
          : {
              status: "present",
              issueId,
              contract,
            },
      ),
  };

  return {
    calls,
    get labels() {
      return labels;
    },
    get contract() {
      return contract;
    },
    layer: Layer.succeed(IssueTracker, service),
  };
};

const fakeRunLedger = (
  options: {
    readonly failCreatePreparationRun?: boolean;
    readonly failWriteArtifacts?: boolean;
  } = {},
) => {
  const calls: string[] = [];
  const events: string[] = [];
  let created = false;
  let run: RunSummary = {
    id: "run_01KRGGDQ6JQN2GMD6KJQ5SFXR6",
    issueId: "morph-lpp",
    lane: "preparation",
    status: "running",
    summary: "Prepare an issue with fake AgentRunner",
    startedAt: "2026-05-14T00:00:00.000Z",
  };
  const service: RunLedgerService = {
    createPreparationRun: (input) => {
      calls.push("createPreparationRun");
      if (options.failCreatePreparationRun === true) {
        return Effect.fail(
          new RunLedgerPersistenceError({
            operation: "createPreparationRun",
            message: "run creation failed",
          }),
        );
      }
      events.push("PreparationStarted");
      created = true;
      run = {
        ...run,
        issueId: input.issueId,
        summary: input.summary,
      };
      return Effect.succeed(run);
    },
    createImplementationRun: (input) => {
      calls.push("createImplementationRun");
      run = {
        ...run,
        issueId: input.issueId,
        lane: "implementation",
        summary: input.summary,
      };
      return Effect.succeed(run);
    },
    createReviewRun: (input) => {
      calls.push("createReviewRun");
      run = {
        ...run,
        issueId: input.issueId,
        lane: "review",
        summary: input.summary,
      };
      return Effect.succeed(run);
    },
    recordImplementationWorkspace: (_runId, input) => {
      calls.push("recordImplementationWorkspace");
      run = {
        ...run,
        workspacePath: input.workspacePath,
        worktreePath: input.worktreePath,
        branch: input.branch,
      };
      return Effect.succeed(run);
    },
    recordMergeRequest: (_runId, input) => {
      calls.push("recordMergeRequest");
      run = {
        ...run,
        mergeRequestRef: input.reference,
        mergeRequestUrl: input.url,
      };
      return Effect.succeed(run);
    },
    writeRunArtifacts: (_runId, input) => {
      calls.push("writeRunArtifacts");
      if (options.failWriteArtifacts === true) {
        return Effect.fail(
          new RunLedgerPersistenceError({
            operation: "writeRunArtifacts",
            message: "artifact persistence failed",
          }),
        );
      }
      events.push("RunArtifactsWritten");
      run = {
        ...run,
        transcriptPath: "/tmp/morpheus/transcript.txt",
        artifactPath: "/tmp/morpheus/artifact.json",
      };
      expect(input.transcript.length).toBeGreaterThan(0);
      return Effect.succeed(run);
    },
    finishRun: (_runId, input) => {
      calls.push(`finishRun:${input.status}`);
      events.push(
        input.status === "succeeded"
          ? "PreparationSucceeded"
          : (input.terminalEvent ?? "PreparationFailed"),
      );
      run = {
        ...run,
        status: input.status,
        failureKind: input.status === "failed" ? input.failureKind : undefined,
        endedAt: "2026-05-14T00:00:01.000Z",
      };
      return Effect.succeed(run);
    },
    getRunLogs: () =>
      Effect.succeed({
        runId: run.id,
        transcriptPath: run.transcriptPath ?? "",
        transcript: "fake transcript",
      }),
    getRunArtifact: () =>
      Effect.succeed({
        runId: run.id,
        artifactPath: run.artifactPath ?? "",
        artifact: "{}",
      }),
    listRuns: () => Effect.succeed(created ? [run] : []),
    getRun: () => Effect.succeed(created ? run : undefined),
    getRunEvents: () =>
      Effect.succeed(
        events.map((type, index) => ({
          sequence: index + 1,
          runId: run.id,
          type,
          occurredAt: "2026-05-14T00:00:00.000Z",
        })),
      ),
  };

  return {
    calls,
    events,
    get run() {
      return run;
    },
    layer: Layer.succeed(RunLedger, service),
  };
};

const fakeAgentRunner = (service: AgentRunnerService) => {
  const calls: string[] = [];
  return {
    calls,
    layer: Layer.succeed(AgentRunner, {
      prepareIssue: (input) => {
        calls.push("prepareIssue");
        return service.prepareIssue(input);
      },
    }),
  };
};

const testLayer = (
  tracker: Layer.Layer<IssueTracker>,
  ledger: Layer.Layer<RunLedger>,
  runner: Layer.Layer<AgentRunner>,
) => Layer.mergeAll(tracker, ledger, runner);

const runPrepare = (
  tracker: Layer.Layer<IssueTracker>,
  ledger: Layer.Layer<RunLedger>,
  runner: Layer.Layer<AgentRunner>,
) =>
  Effect.runPromise(
    prepareIssue("morph-lpp").pipe(Effect.provide(testLayer(tracker, ledger, runner))),
  );

describe("prepareIssue", () => {
  it("writes a valid fake preparation contract and moves to prepared", async () => {
    const tracker = fakeIssueTracker(["agent:ready", "ready-for-agent"]);
    const ledger = fakeRunLedger();
    const runner = fakeAgentRunner({
      prepareIssue: () =>
        Effect.succeed({
          status: "prepared",
          contract: validContract,
          transcript: "fake transcript prepared",
          artifact: { status: "prepared" },
        }),
    });

    const result = await runPrepare(tracker.layer, ledger.layer, runner.layer);

    expect(result.status).toBe("prepared");
    expect(tracker.labels).toEqual(["ready-for-agent", "agent:prepared"]);
    expect(tracker.contract).toEqual(validContract);
    expect(ledger.run.status).toBe("succeeded");
    expect(ledger.events).toEqual([
      "PreparationStarted",
      "RunArtifactsWritten",
      "PreparationSucceeded",
    ]);
    expect(runner.calls).toEqual(["prepareIssue"]);
  });

  it("moves blocked fake preparation to blocked without writing a contract", async () => {
    const tracker = fakeIssueTracker(["agent:ready"]);
    const ledger = fakeRunLedger();
    const runner = fakeAgentRunner({
      prepareIssue: () =>
        Effect.succeed({
          status: "blocked",
          reason: "Needs product context.",
          transcript: "fake transcript blocked",
          artifact: { status: "blocked" },
        }),
    });

    const result = await runPrepare(tracker.layer, ledger.layer, runner.layer);

    expect(result).toMatchObject({
      status: "blocked",
      reason: "Needs product context.",
    });
    expect(tracker.labels).toEqual(["agent:blocked"]);
    expect(tracker.contract).toBeUndefined();
    expect(ledger.run.status).toBe("failed");
    expect(ledger.run.failureKind).toBe("agent_contract_error");
    expect(ledger.events.at(-1)).toBe("PreparationBlocked");
    expect(runner.calls).toEqual(["prepareIssue"]);
  });

  it("records failed terminal result when blocked transition command fails", async () => {
    const tracker = fakeIssueTracker(["agent:ready"], {
      failTerminalTo: "agent:blocked",
    });
    const ledger = fakeRunLedger();
    const runner = fakeAgentRunner({
      prepareIssue: () =>
        Effect.succeed({
          status: "blocked",
          reason: "Needs product context.",
          transcript: "fake transcript blocked",
          artifact: { status: "blocked" },
        }),
    });

    const result = await runPrepare(tracker.layer, ledger.layer, runner.layer);

    expect(result).toMatchObject({
      status: "failed",
      failureKind: "runtime_error",
    });
    expect(tracker.labels).toEqual(["agent:preparing"]);
    expect(tracker.contract).toBeUndefined();
    expect(ledger.run.status).toBe("failed");
    expect(ledger.run.failureKind).toBe("runtime_error");
    expect(ledger.events.at(-1)).toBe("PreparationFailed");
  });

  it("moves invalid fake preparation contracts to failed without writing a contract", async () => {
    const tracker = fakeIssueTracker(["agent:ready"]);
    const ledger = fakeRunLedger();
    const runner = fakeAgentRunner({
      prepareIssue: () =>
        Effect.succeed({
          status: "prepared",
          contract: {
            ...validContract,
            riskLevel: "severe",
          },
          transcript: "fake transcript failed",
          artifact: { status: "failed" },
        }),
    });

    const result = await runPrepare(tracker.layer, ledger.layer, runner.layer);

    expect(result).toMatchObject({
      status: "failed",
      failureKind: "agent_contract_error",
    });
    expect(tracker.labels).toEqual(["agent:failed"]);
    expect(tracker.contract).toBeUndefined();
    expect(ledger.run.status).toBe("failed");
    expect(ledger.run.failureKind).toBe("agent_contract_error");
  });

  it("blocks prepared contracts with blockedBy set", async () => {
    const tracker = fakeIssueTracker(["agent:ready"]);
    const ledger = fakeRunLedger();
    const runner = fakeAgentRunner({
      prepareIssue: () =>
        Effect.succeed({
          status: "prepared",
          contract: {
            ...validContract,
            blockedBy: "Needs maintainer decision.",
          },
          transcript: "fake transcript blocked contract",
          artifact: { status: "blocked" },
        }),
    });

    const result = await runPrepare(tracker.layer, ledger.layer, runner.layer);

    expect(result).toMatchObject({
      status: "blocked",
      reason: "blockedBy must be None: Needs maintainer decision.",
    });
    expect(tracker.labels).toEqual(["agent:blocked"]);
    expect(tracker.contract).toBeUndefined();
    expect(ledger.run.status).toBe("failed");
    expect(ledger.run.failureKind).toBe("agent_contract_error");
    expect(ledger.events.at(-1)).toBe("PreparationBlocked");
  });

  it("blocks incomplete prepared contracts without writing a contract", async () => {
    const tracker = fakeIssueTracker(["agent:ready"]);
    const ledger = fakeRunLedger();
    const runner = fakeAgentRunner({
      prepareIssue: () =>
        Effect.succeed({
          status: "prepared",
          contract: {
            ...validContract,
            summary: "",
            keyInterfaces: [],
          },
          transcript: "fake transcript incomplete contract",
          artifact: { status: "blocked" },
        }),
    });

    const result = await runPrepare(tracker.layer, ledger.layer, runner.layer);

    expect(result).toMatchObject({
      status: "blocked",
      reason: "summary must not be empty",
    });
    expect(tracker.labels).toEqual(["agent:blocked"]);
    expect(tracker.contract).toBeUndefined();
    expect(ledger.run.status).toBe("failed");
    expect(ledger.run.failureKind).toBe("agent_contract_error");
    expect(ledger.events.at(-1)).toBe("PreparationBlocked");
  });

  it("blocks prepared contracts with hitlDecisions set", async () => {
    const tracker = fakeIssueTracker(["agent:ready"]);
    const ledger = fakeRunLedger();
    const runner = fakeAgentRunner({
      prepareIssue: () =>
        Effect.succeed({
          status: "prepared",
          contract: {
            ...validContract,
            hitlDecisions: "Choose product behavior.",
          },
          transcript: "fake transcript hitl contract",
          artifact: { status: "blocked" },
        }),
    });

    const result = await runPrepare(tracker.layer, ledger.layer, runner.layer);

    expect(result).toMatchObject({
      status: "blocked",
      reason: "hitlDecisions must be None: Choose product behavior.",
    });
    expect(tracker.labels).toEqual(["agent:blocked"]);
    expect(tracker.contract).toBeUndefined();
    expect(ledger.run.status).toBe("failed");
    expect(ledger.run.failureKind).toBe("agent_contract_error");
  });

  it("records runner-declared failed preparation as a failed run and issue", async () => {
    const tracker = fakeIssueTracker(["agent:ready"]);
    const ledger = fakeRunLedger();
    const runner = fakeAgentRunner({
      prepareIssue: () =>
        Effect.succeed({
          status: "failed",
          failureKind: "runtime_error",
          message: "Fake runner declared failure.",
          transcript: "fake transcript runner failed",
          artifact: { status: "failed" },
        }),
    });

    const result = await runPrepare(tracker.layer, ledger.layer, runner.layer);

    expect(result).toMatchObject({
      status: "failed",
      failureKind: "runtime_error",
      message: "Fake runner declared failure.",
    });
    expect(tracker.labels).toEqual(["agent:failed"]);
    expect(tracker.contract).toBeUndefined();
    expect(ledger.run.status).toBe("failed");
    expect(ledger.run.failureKind).toBe("runtime_error");
  });

  it("fails closed without writing contract when prepared transition sees label drift", async () => {
    const tracker = fakeIssueTracker(["agent:ready", "ready-for-agent"], {
      labelsAfterStart: ["agent:running", "ready-for-agent", "human-added"],
    });
    const ledger = fakeRunLedger();
    const runner = fakeAgentRunner({
      prepareIssue: () =>
        Effect.succeed({
          status: "prepared",
          contract: validContract,
          transcript: "fake transcript prepared",
          artifact: { status: "prepared" },
        }),
    });

    const result = await runPrepare(tracker.layer, ledger.layer, runner.layer);

    expect(result).toMatchObject({
      status: "failed",
      failureKind: "state_conflict",
    });
    expect(tracker.labels).toEqual(["agent:running", "ready-for-agent", "human-added"]);
    expect(tracker.contract).toBeUndefined();
    expect(tracker.calls).not.toContain("writeContract");
    expect(ledger.run.status).toBe("failed");
    expect(ledger.run.failureKind).toBe("state_conflict");
  });

  it("finishes the run when terminal transition command fails", async () => {
    const tracker = fakeIssueTracker(["agent:ready"], {
      failTerminalTo: "agent:prepared",
    });
    const ledger = fakeRunLedger();
    const runner = fakeAgentRunner({
      prepareIssue: () =>
        Effect.succeed({
          status: "prepared",
          contract: validContract,
          transcript: "fake transcript prepared",
          artifact: { status: "prepared" },
        }),
    });

    const result = await runPrepare(tracker.layer, ledger.layer, runner.layer);

    expect(result).toMatchObject({
      status: "failed",
      failureKind: "runtime_error",
    });
    expect(tracker.labels).toEqual(["agent:preparing"]);
    expect(tracker.contract).toEqual(validContract);
    expect(ledger.run.status).toBe("failed");
    expect(ledger.run.failureKind).toBe("runtime_error");
  });

  it("finishes the run when contract metadata write fails before prepared transition", async () => {
    const tracker = fakeIssueTracker(["agent:ready"], {
      failWriteContract: true,
    });
    const ledger = fakeRunLedger();
    const runner = fakeAgentRunner({
      prepareIssue: () =>
        Effect.succeed({
          status: "prepared",
          contract: validContract,
          transcript: "fake transcript prepared",
          artifact: { status: "prepared" },
        }),
    });

    const result = await runPrepare(tracker.layer, ledger.layer, runner.layer);

    expect(result).toMatchObject({
      status: "failed",
      failureKind: "runtime_error",
      message: expect.stringContaining("Agent-Ready Contract write failed"),
    });
    expect(tracker.labels).toEqual(["agent:failed"]);
    expect(tracker.contract).toBeUndefined();
    expect(ledger.run.status).toBe("failed");
    expect(ledger.run.failureKind).toBe("runtime_error");
  });

  it("does not mutate issue state when run creation fails", async () => {
    const tracker = fakeIssueTracker(["agent:ready"]);
    const ledger = fakeRunLedger({ failCreatePreparationRun: true });
    const runner = fakeAgentRunner({
      prepareIssue: () =>
        Effect.succeed({
          status: "prepared",
          contract: validContract,
          transcript: "fake transcript prepared",
          artifact: { status: "prepared" },
        }),
    });

    const result = await Effect.runPromise(
      Effect.either(
        prepareIssue("morph-lpp").pipe(
          Effect.provide(testLayer(tracker.layer, ledger.layer, runner.layer)),
        ),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(RunLedgerPersistenceError);
    }
    expect(tracker.labels).toEqual(["agent:ready"]);
    expect(tracker.calls).toEqual(["getIssue"]);
    expect(ledger.calls).toEqual(["createPreparationRun"]);
    expect(runner.calls).toEqual([]);
  });

  it("records thrown runner failures as failed runs and issues", async () => {
    const tracker = fakeIssueTracker(["agent:ready"]);
    const ledger = fakeRunLedger();
    const runner = fakeAgentRunner({
      prepareIssue: () =>
        Effect.fail(
          new AgentRunnerError({
            operation: "prepareIssue",
            message: "runner threw",
          }),
        ),
    });

    const result = await runPrepare(tracker.layer, ledger.layer, runner.layer);

    expect(result).toMatchObject({
      status: "failed",
      failureKind: "runtime_error",
      message: expect.stringContaining("runner threw"),
    });
    expect(tracker.labels).toEqual(["agent:failed"]);
    expect(tracker.contract).toBeUndefined();
    expect(ledger.run.status).toBe("failed");
    expect(ledger.run.failureKind).toBe("runtime_error");
  });

  it("finishes the run when artifact writing fails", async () => {
    const tracker = fakeIssueTracker(["agent:ready"]);
    const ledger = fakeRunLedger({ failWriteArtifacts: true });
    const runner = fakeAgentRunner({
      prepareIssue: () =>
        Effect.succeed({
          status: "prepared",
          contract: validContract,
          transcript: "fake transcript prepared",
          artifact: { status: "prepared" },
        }),
    });

    const result = await runPrepare(tracker.layer, ledger.layer, runner.layer);

    expect(result).toMatchObject({
      status: "failed",
      failureKind: "runtime_error",
    });
    expect(tracker.labels).toEqual(["agent:failed"]);
    expect(tracker.contract).toBeUndefined();
    expect(ledger.run.status).toBe("failed");
    expect(ledger.run.failureKind).toBe("runtime_error");
    expect(ledger.events).toEqual(["PreparationStarted", "PreparationFailed"]);
  });

  it("finishes the run when artifact serialization fails", async () => {
    const tracker = fakeIssueTracker(["agent:ready"]);
    const ledger = fakeRunLedger();
    const runner = fakeAgentRunner({
      prepareIssue: () =>
        Effect.succeed({
          status: "prepared",
          contract: validContract,
          transcript: "fake transcript prepared",
          artifact: BigInt(1),
        }),
    });

    const result = await runPrepare(tracker.layer, ledger.layer, runner.layer);

    expect(result).toMatchObject({
      status: "failed",
      failureKind: "runtime_error",
    });
    expect(tracker.labels).toEqual(["agent:failed"]);
    expect(tracker.contract).toBeUndefined();
    expect(ledger.run.status).toBe("failed");
    expect(ledger.run.failureKind).toBe("runtime_error");
    expect(ledger.events).toEqual(["PreparationStarted", "PreparationFailed"]);
  });

  it("fails closed on state conflict before runner and ledger start", async () => {
    const tracker = fakeIssueTracker(["agent:ready", "agent:running"]);
    const ledger = fakeRunLedger();
    const runner = fakeAgentRunner({
      prepareIssue: () =>
        Effect.succeed({
          status: "prepared",
          contract: validContract,
          transcript: "fake transcript prepared",
          artifact: { status: "prepared" },
        }),
    });

    const result = await Effect.runPromise(
      Effect.either(
        prepareIssue("morph-lpp").pipe(
          Effect.provide(testLayer(tracker.layer, ledger.layer, runner.layer)),
        ),
      ),
    );

    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right).toEqual({
        status: "state_rejected",
        issueId: "morph-lpp",
        reason: "conflict",
        failureKind: "state_conflict",
      });
    }
    expect(tracker.labels).toEqual(["agent:ready", "agent:running"]);
    expect(ledger.calls).toEqual([]);
    expect(runner.calls).toEqual([]);
  });

  it("does not run when StartPreparation is invalid for current state", async () => {
    const tracker = fakeIssueTracker(["agent:prepared"]);
    const ledger = fakeRunLedger();
    const runner = fakeAgentRunner({
      prepareIssue: () =>
        Effect.succeed({
          status: "prepared",
          contract: validContract,
          transcript: "fake transcript prepared",
          artifact: { status: "prepared" },
        }),
    });

    const result = await runPrepare(tracker.layer, ledger.layer, runner.layer);

    expect(result).toMatchObject({
      status: "state_rejected",
      reason: "invalid_transition",
    });
    expect(ledger.calls).toEqual([]);
    expect(runner.calls).toEqual([]);
    expect(planAgentStateTransition(tracker.labels, "StartImplementation").status).toBe("planned");
  });
});
