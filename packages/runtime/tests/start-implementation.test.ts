import { deriveIssueState, deriveLane, type AgentReadyContract } from "@morpheus/core";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import {
  AgentRunner,
  IssueTracker,
  IssueTrackerCommandError,
  MergeRequestClient,
  MergeRequestClientError,
  RunLedger,
  RunLedgerPersistenceError,
  startImplementation,
  WorkspaceRuntime,
  type IssueTrackerService,
  type AgentRunnerService,
  type MergeRequestClientService,
  type RunLedgerService,
  type RunSummary,
  type TrackedIssue,
  type WorkspaceRuntimeService,
} from "../src/index.js";

const validContract: AgentReadyContract = {
  category: "task",
  summary: "Create Draft MR before implementation.",
  currentBehavior: "Implementation has not started.",
  desiredBehavior: "Morpheus creates a Draft MR before implementer execution.",
  keyInterfaces: ["WorkspaceRuntime", "MergeRequestClient", "RunLedger"],
  acceptanceCriteria: ["Draft MR exists before agent:running."],
  outOfScope: ["Implementer execution"],
  verificationPlan: ["pnpm check"],
  blockedBy: "None",
  hitlDecisions: "None",
  riskLevel: "medium",
};

const trackedIssue = (labels: readonly string[]): TrackedIssue => {
  const derivedState = deriveIssueState(labels);
  return {
    id: "morph-7ky",
    title: "Create Draft MR before implementation",
    labels,
    derivedState,
    lane: derivedState.status === "active" ? deriveLane(derivedState.state) : "none",
  };
};

const fakeIssueTracker = (
  initialLabels: readonly string[],
  options: {
    readonly failReadContract?: boolean;
  } = {},
) => {
  let labels = [...initialLabels];
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

      labels = [...transitionPlan.finalLabels];
      return Effect.succeed({
        status: "applied",
        issueId,
        addLabels: transitionPlan.addLabels,
        removeLabels: transitionPlan.removeLabels,
      });
    },
    writeContract: (issueId) => Effect.succeed({ status: "written", issueId }),
    readContract: (issueId) => {
      if (options.failReadContract === true) {
        return Effect.fail(
          new IssueTrackerCommandError({
            operation: "bd",
            command: "bd",
            args: ["show", issueId, "--json"],
            exitCode: 1,
            stderr: "metadata read failed",
          }),
        );
      }

      return Effect.succeed({
        status: "present",
        issueId,
        contract: validContract,
      });
    },
  };

  return {
    calls,
    get labels() {
      return labels;
    },
    layer: Layer.succeed(IssueTracker, service),
  };
};

const fakeRunLedger = (
  options: {
    readonly failRecordWorkspace?: boolean;
    readonly failRecordMergeRequest?: boolean;
  } = {},
) => {
  const events: string[] = [];
  let run: RunSummary = {
    id: "run_01KRGGDQ6JQN2GMD6KJQ5SFXR6",
    issueId: "morph-7ky",
    lane: "implementation",
    status: "running",
    summary: "Create Draft MR before implementation",
    startedAt: "2026-05-14T00:00:00.000Z",
  };
  const service: RunLedgerService = {
    createPreparationRun: (input) =>
      Effect.succeed({
        ...run,
        issueId: input.issueId,
        lane: "preparation",
        summary: input.summary,
      }),
    createImplementationRun: (input) => {
      events.push("ImplementationStarted");
      run = {
        ...run,
        issueId: input.issueId,
        lane: "implementation",
        summary: input.summary,
      };
      return Effect.succeed(run);
    },
    createReviewRun: (input) => {
      events.push("StartReview");
      run = {
        ...run,
        issueId: input.issueId,
        lane: "review",
        summary: input.summary,
      };
      return Effect.succeed(run);
    },
    recordImplementationWorkspace: (_runId, input) => {
      events.push("ImplementationWorkspacePrepared");
      if (options.failRecordWorkspace === true) {
        return Effect.fail(
          new RunLedgerPersistenceError({
            operation: "recordImplementationWorkspace",
            message: "workspace ledger failed",
          }),
        );
      }
      run = {
        ...run,
        workspacePath: input.workspacePath,
        worktreePath: input.worktreePath,
        branch: input.branch,
      };
      return Effect.succeed(run);
    },
    recordMergeRequest: (_runId, input) => {
      events.push("DraftMergeRequestCreated");
      if (options.failRecordMergeRequest === true) {
        return Effect.fail(
          new RunLedgerPersistenceError({
            operation: "recordMergeRequest",
            message: "MR ledger failed",
          }),
        );
      }
      run = {
        ...run,
        mergeRequestRef: input.reference,
        mergeRequestUrl: input.url,
      };
      return Effect.succeed(run);
    },
    writeRunArtifacts: () => {
      events.push("RunArtifactsWritten");
      run = {
        ...run,
        transcriptPath: "/tmp/morpheus/transcript.txt",
        artifactPath: "/tmp/morpheus/artifact.json",
      };
      return Effect.succeed(run);
    },
    finishRun: (_runId, input) => {
      events.push(input.terminalEvent ?? "ImplementationFailed");
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
        transcriptPath: "",
        transcript: "",
      }),
    getRunArtifact: () =>
      Effect.succeed({
        runId: run.id,
        artifactPath: run.artifactPath ?? "",
        artifact: "{}",
      }),
    listRuns: () => Effect.succeed([run]),
    getRun: () => Effect.succeed(run),
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
    events,
    get run() {
      return run;
    },
    layer: Layer.succeed(RunLedger, service),
  };
};

const fakeAgentRunner = (
  scenario: "implemented" | "malformed" | "empty_evidence" | "verification_failed" = "implemented",
) => {
  const calls: string[] = [];
  const service: AgentRunnerService = {
    prepareIssue: () => Effect.die("not used"),
    implementIssue: (input) => {
      calls.push(`implement:${input.issue.id}:${input.mergeRequest.reference}`);
      if (scenario === "malformed") {
        return Effect.succeed({
          status: "implemented",
          implementationEvidence: [{ summary: "missing files" }],
          verificationEvidence: [],
          transcript: "malformed transcript",
          artifact: { status: "malformed" },
        });
      }
      if (scenario === "empty_evidence") {
        return Effect.succeed({
          status: "implemented",
          implementationEvidence: [],
          verificationEvidence: [],
          transcript: "empty evidence transcript",
          artifact: { status: "empty_evidence" },
        });
      }

      return Effect.succeed({
        status: "implemented",
        implementationEvidence: [
          {
            summary: "Fake implementation complete.",
            files: ["packages/runtime/src/index.ts"],
          },
        ],
        verificationEvidence: [
          {
            command: "pnpm check",
            status: scenario === "verification_failed" ? "failed" : "passed",
            output: scenario === "verification_failed" ? "failed" : "passed",
          },
        ],
        transcript: "fake implementation transcript",
        artifact: { status: scenario },
      });
    },
  };

  return {
    calls,
    layer: Layer.succeed(AgentRunner, service),
  };
};

const fakeWorkspaceRuntime = (): {
  readonly calls: string[];
  readonly layer: Layer.Layer<WorkspaceRuntime>;
} => {
  const calls: string[] = [];
  const service: WorkspaceRuntimeService = {
    prepareImplementationWorkspace: ({ issueId, runId }) => {
      calls.push(`prepare:${issueId}:${runId}`);
      return Effect.succeed({
        workspacePath: "/repo",
        worktreePath: "/repo",
        branch: "morpheus/morph-7ky",
        targetBranch: "main",
        remote: "origin",
      });
    },
    prepareReviewWorkspace: () => Effect.die("not used"),
  };

  return {
    calls,
    layer: Layer.succeed(WorkspaceRuntime, service),
  };
};

const fakeMergeRequestClient = (scenario: "success" | "operator_access") => {
  const calls: string[] = [];
  const descriptions: string[] = [];
  const service: MergeRequestClientService = {
    createDraftMergeRequest: (input) => {
      calls.push(input.sourceBranch);
      if (scenario === "operator_access") {
        return Effect.fail(
          new MergeRequestClientError({
            operation: "createDraftMergeRequest",
            failureKind: "operator_access",
            message: "not logged in",
          }),
        );
      }

      return Effect.succeed({
        reference: "!42",
        url: "https://gitlab.example.com/group/project/-/merge_requests/42",
      });
    },
    updateDescription: (input) => {
      calls.push(`update:${input.reference}`);
      descriptions.push(input.description);
      return Effect.succeed({
        reference: input.reference,
      });
    },
  };

  return {
    calls,
    descriptions,
    layer: Layer.succeed(MergeRequestClient, service),
  };
};

const fakeMissingContractIssueTracker = (initialLabels: readonly string[]) => {
  let labels = [...initialLabels];
  const service: IssueTrackerService = {
    listRunnableIssues: () => Effect.succeed([trackedIssue(labels)]),
    getIssue: () => Effect.succeed(trackedIssue(labels)),
    applyAgentState: (issueId, transitionPlan) => {
      if (transitionPlan.status !== "planned") {
        return Effect.succeed({
          status: "rejected",
          issueId,
          reason: transitionPlan.status,
          plan: transitionPlan,
        });
      }
      labels = [...transitionPlan.finalLabels];
      return Effect.succeed({
        status: "applied",
        issueId,
        addLabels: transitionPlan.addLabels,
        removeLabels: transitionPlan.removeLabels,
      });
    },
    writeContract: (issueId) => Effect.succeed({ status: "written", issueId }),
    readContract: (issueId) =>
      Effect.succeed({
        status: "missing" as const,
        issueId,
      }),
  };

  return Layer.succeed(IssueTracker, service);
};

const testLayer = (
  tracker: Layer.Layer<IssueTracker>,
  ledger: Layer.Layer<RunLedger>,
  workspace: Layer.Layer<WorkspaceRuntime>,
  mergeRequests: Layer.Layer<MergeRequestClient>,
  runner: Layer.Layer<AgentRunner>,
) => Layer.mergeAll(tracker, ledger, workspace, mergeRequests, runner);

describe("startImplementation", () => {
  it("prepares workspace, creates Draft MR, records refs, then moves issue to running", async () => {
    const tracker = fakeIssueTracker(["agent:prepared", "ready-for-agent"]);
    const ledger = fakeRunLedger();
    const workspace = fakeWorkspaceRuntime();
    const mergeRequests = fakeMergeRequestClient("success");
    const runner = fakeAgentRunner();

    const result = await Effect.runPromise(
      startImplementation("morph-7ky").pipe(
        Effect.provide(
          testLayer(
            tracker.layer,
            ledger.layer,
            workspace.layer,
            mergeRequests.layer,
            runner.layer,
          ),
        ),
      ),
    );

    expect(result.status).toBe("started");
    expect(tracker.labels).toEqual(["ready-for-agent", "agent:running"]);
    expect(ledger.run).toMatchObject({
      issueId: "morph-7ky",
      lane: "implementation",
      status: "running",
      workspacePath: "/repo",
      worktreePath: "/repo",
      branch: "morpheus/morph-7ky",
      mergeRequestRef: "!42",
      mergeRequestUrl: "https://gitlab.example.com/group/project/-/merge_requests/42",
    });
    expect(ledger.events).toEqual([
      "ImplementationStarted",
      "ImplementationWorkspacePrepared",
      "DraftMergeRequestCreated",
      "RunArtifactsWritten",
    ]);
    expect(workspace.calls).toEqual(["prepare:morph-7ky:run_01KRGGDQ6JQN2GMD6KJQ5SFXR6"]);
    expect(mergeRequests.calls).toEqual(["morpheus/morph-7ky", "update:!42"]);
    expect(mergeRequests.descriptions[0]).toContain("Fake implementation complete.");
    expect(mergeRequests.descriptions[0]).toContain("passed: pnpm check - passed");
    expect(mergeRequests.descriptions[0]).toContain("Review verdict: pending");
    expect(runner.calls).toEqual(["implement:morph-7ky:!42"]);
  });

  it("rejects malformed implementation evidence before updating MR evidence", async () => {
    const tracker = fakeIssueTracker(["agent:prepared"]);
    const ledger = fakeRunLedger();
    const workspace = fakeWorkspaceRuntime();
    const mergeRequests = fakeMergeRequestClient("success");
    const runner = fakeAgentRunner("malformed");

    const result = await Effect.runPromise(
      startImplementation("morph-7ky").pipe(
        Effect.provide(
          testLayer(
            tracker.layer,
            ledger.layer,
            workspace.layer,
            mergeRequests.layer,
            runner.layer,
          ),
        ),
      ),
    );

    expect(result).toMatchObject({
      status: "failed",
      failureKind: "agent_contract_error",
      message: expect.stringContaining("Invalid implementation result"),
    });
    expect(tracker.labels).toEqual(["agent:failed"]);
    expect(mergeRequests.calls).toEqual(["morpheus/morph-7ky"]);
    expect(ledger.run.status).toBe("failed");
  });

  it("rejects empty implementation evidence before updating MR evidence", async () => {
    const tracker = fakeIssueTracker(["agent:prepared"]);
    const ledger = fakeRunLedger();
    const workspace = fakeWorkspaceRuntime();
    const mergeRequests = fakeMergeRequestClient("success");
    const runner = fakeAgentRunner("empty_evidence");

    const result = await Effect.runPromise(
      startImplementation("morph-7ky").pipe(
        Effect.provide(
          testLayer(
            tracker.layer,
            ledger.layer,
            workspace.layer,
            mergeRequests.layer,
            runner.layer,
          ),
        ),
      ),
    );

    expect(result).toMatchObject({
      status: "failed",
      failureKind: "agent_contract_error",
      message: expect.stringContaining("Invalid implementation result"),
    });
    expect(tracker.labels).toEqual(["agent:failed"]);
    expect(mergeRequests.calls).toEqual(["morpheus/morph-7ky"]);
  });

  it("records implementation artifacts but fails the run when verification fails", async () => {
    const tracker = fakeIssueTracker(["agent:prepared"]);
    const ledger = fakeRunLedger();
    const workspace = fakeWorkspaceRuntime();
    const mergeRequests = fakeMergeRequestClient("success");
    const runner = fakeAgentRunner("verification_failed");

    const result = await Effect.runPromise(
      startImplementation("morph-7ky").pipe(
        Effect.provide(
          testLayer(
            tracker.layer,
            ledger.layer,
            workspace.layer,
            mergeRequests.layer,
            runner.layer,
          ),
        ),
      ),
    );

    expect(result).toMatchObject({
      status: "failed",
      failureKind: "verification_error",
      message: "Implementation verification failed: pnpm check",
    });
    expect(tracker.labels).toEqual(["agent:failed"]);
    expect(ledger.run).toMatchObject({
      status: "failed",
      failureKind: "verification_error",
      transcriptPath: "/tmp/morpheus/transcript.txt",
      artifactPath: "/tmp/morpheus/artifact.json",
    });
    expect(mergeRequests.calls).toEqual(["morpheus/morph-7ky", "update:!42"]);
    expect(mergeRequests.descriptions[0]).toContain("Fake implementation complete.");
    expect(mergeRequests.descriptions[0]).toContain("failed: pnpm check - failed");
    expect(mergeRequests.descriptions[0]).toContain("Review verdict: pending");
    expect(ledger.events).toEqual([
      "ImplementationStarted",
      "ImplementationWorkspacePrepared",
      "DraftMergeRequestCreated",
      "RunArtifactsWritten",
      "ImplementationFailed",
    ]);
  });

  it("fails before running when workspace ledger recording fails", async () => {
    const tracker = fakeIssueTracker(["agent:prepared"]);
    const ledger = fakeRunLedger({ failRecordWorkspace: true });
    const workspace = fakeWorkspaceRuntime();
    const mergeRequests = fakeMergeRequestClient("success");
    const runner = fakeAgentRunner();

    const result = await Effect.runPromise(
      startImplementation("morph-7ky").pipe(
        Effect.provide(
          testLayer(
            tracker.layer,
            ledger.layer,
            workspace.layer,
            mergeRequests.layer,
            runner.layer,
          ),
        ),
      ),
    );

    expect(result).toMatchObject({
      status: "failed",
      failureKind: "runtime_error",
      message: expect.stringContaining("workspace ledger failed"),
    });
    expect(tracker.labels).toEqual(["agent:failed"]);
    expect(mergeRequests.calls).toEqual([]);
    expect(ledger.run.status).toBe("failed");
    expect(ledger.run.failureKind).toBe("runtime_error");
  });

  it("fails before running when Draft MR ledger recording fails", async () => {
    const tracker = fakeIssueTracker(["agent:prepared"]);
    const ledger = fakeRunLedger({ failRecordMergeRequest: true });
    const workspace = fakeWorkspaceRuntime();
    const mergeRequests = fakeMergeRequestClient("success");
    const runner = fakeAgentRunner();

    const result = await Effect.runPromise(
      startImplementation("morph-7ky").pipe(
        Effect.provide(
          testLayer(
            tracker.layer,
            ledger.layer,
            workspace.layer,
            mergeRequests.layer,
            runner.layer,
          ),
        ),
      ),
    );

    expect(result).toMatchObject({
      status: "failed",
      failureKind: "runtime_error",
      message: expect.stringContaining("MR ledger failed"),
    });
    expect(tracker.labels).toEqual(["agent:failed"]);
    expect(mergeRequests.calls).toEqual(["morpheus/morph-7ky"]);
    expect(ledger.run.status).toBe("failed");
    expect(ledger.run.failureKind).toBe("runtime_error");
  });

  it("fails before running when contract metadata cannot be read", async () => {
    const tracker = fakeIssueTracker(["agent:prepared"], {
      failReadContract: true,
    });
    const ledger = fakeRunLedger();
    const workspace = fakeWorkspaceRuntime();
    const mergeRequests = fakeMergeRequestClient("success");
    const runner = fakeAgentRunner();

    const result = await Effect.runPromise(
      startImplementation("morph-7ky").pipe(
        Effect.provide(
          testLayer(
            tracker.layer,
            ledger.layer,
            workspace.layer,
            mergeRequests.layer,
            runner.layer,
          ),
        ),
      ),
    );

    expect(result).toMatchObject({
      status: "failed",
      failureKind: "runtime_error",
      message: expect.stringContaining("Agent-Ready Contract read failed"),
    });
    expect(tracker.labels).toEqual(["agent:failed"]);
    expect(mergeRequests.calls).toEqual([]);
    expect(ledger.run.status).toBe("failed");
    expect(ledger.run.failureKind).toBe("runtime_error");
  });

  it("fails before running when contract metadata is missing", async () => {
    const ledger = fakeRunLedger();
    const workspace = fakeWorkspaceRuntime();
    const mergeRequests = fakeMergeRequestClient("success");
    const runner = fakeAgentRunner();

    const result = await Effect.runPromise(
      startImplementation("morph-7ky").pipe(
        Effect.provide(
          testLayer(
            fakeMissingContractIssueTracker(["agent:prepared"]),
            ledger.layer,
            workspace.layer,
            mergeRequests.layer,
            runner.layer,
          ),
        ),
      ),
    );

    expect(result).toMatchObject({
      status: "failed",
      failureKind: "agent_contract_error",
      message: "Agent-Ready Contract metadata missing.",
    });
    expect(mergeRequests.calls).toEqual([]);
    expect(ledger.run.status).toBe("failed");
    expect(ledger.run.failureKind).toBe("agent_contract_error");
  });

  it("maps Draft MR auth/access failure to failed issue and operator_access run", async () => {
    const tracker = fakeIssueTracker(["agent:prepared"]);
    const ledger = fakeRunLedger();
    const workspace = fakeWorkspaceRuntime();
    const mergeRequests = fakeMergeRequestClient("operator_access");
    const runner = fakeAgentRunner();

    const result = await Effect.runPromise(
      startImplementation("morph-7ky").pipe(
        Effect.provide(
          testLayer(
            tracker.layer,
            ledger.layer,
            workspace.layer,
            mergeRequests.layer,
            runner.layer,
          ),
        ),
      ),
    );

    expect(result).toMatchObject({
      status: "failed",
      failureKind: "operator_access",
      message: expect.stringContaining("Draft MR creation failed"),
    });
    expect(tracker.labels).toEqual(["agent:failed"]);
    expect(ledger.run).toMatchObject({
      status: "failed",
      failureKind: "operator_access",
      workspacePath: "/repo",
      branch: "morpheus/morph-7ky",
    });
    expect(ledger.run).not.toHaveProperty("mergeRequestRef");
    expect(ledger.events).toEqual([
      "ImplementationStarted",
      "ImplementationWorkspacePrepared",
      "ImplementationFailed",
    ]);
  });
});
