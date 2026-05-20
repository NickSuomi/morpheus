import { deriveIssueState, deriveLane, type AgentReadyContract } from "@morpheus/core";
import { Effect, Layer } from "effect";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AgentRunner,
  GitLabIssueSource,
  initMorpheusRepo,
  IssueTracker,
  loadMorpheusConfig,
  MergeRequestClient,
  RunLedger,
  runDaemonOnce,
  runDaemonOnceForCli,
  WorkspaceRuntime,
  type AgentRunnerService,
  type GitLabIssueInput,
  type GitLabIssueSourceService,
  type IssueTrackerService,
  type MergeRequestClientService,
  type RunArtifact,
  type RunLedgerService,
  type RunLogs,
  type RunSummary,
  type TrackedIssue,
  type WorkspaceRuntimeService,
} from "../src/index.js";

const contract: AgentReadyContract = {
  category: "task",
  summary: "Run daemon lane flow.",
  currentBehavior: "Operator runs lanes manually.",
  desiredBehavior: "Daemon runs selected lanes.",
  keyInterfaces: ["IssueTracker", "RunLedger", "AgentRunner"],
  acceptanceCriteria: ["Daemon dispatches selected lane work."],
  outOfScope: ["Auto-merge", "Auto-retry"],
  verificationPlan: ["pnpm test"],
  blockedBy: "None",
  hitlDecisions: "None",
  riskLevel: "medium",
};

const trackedIssue = (id: string, labels: readonly string[]): TrackedIssue => {
  const derivedState = deriveIssueState(labels);
  return {
    id,
    title: id,
    labels,
    derivedState,
    lane: derivedState.status === "active" ? deriveLane(derivedState.state) : "none",
  };
};

const fakeIssueTracker = (initialIssues: Record<string, readonly string[]>) => {
  const labelsByIssue = new Map(
    Object.entries(initialIssues).map(([id, labels]) => [id, [...labels]]),
  );
  const calls: string[] = [];
  let importedCreateCount = 0;
  const service: IssueTrackerService = {
    listRunnableIssues: () => {
      calls.push("listRunnableIssues");
      return Effect.succeed(
        [...labelsByIssue.entries()].map(([id, labels]) => trackedIssue(id, labels)),
      );
    },
    getIssue: (issueId) => {
      calls.push(`getIssue:${issueId}`);
      return Effect.succeed(trackedIssue(issueId, labelsByIssue.get(issueId) ?? []));
    },
    applyAgentState: (issueId, transitionPlan) => {
      calls.push(`apply:${issueId}:${transitionPlan.status}`);
      if (transitionPlan.status !== "planned") {
        return Effect.succeed({
          status: "rejected",
          issueId,
          reason: transitionPlan.status,
          plan: transitionPlan,
        });
      }
      labelsByIssue.set(issueId, [...transitionPlan.finalLabels]);
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
        status: "present",
        issueId,
        contract,
      }),
    listImportedGitLabIssues: () => Effect.succeed([]),
    upsertImportedGitLabIssue: (input) => {
      const issueId = `morph-gl-${input.source.iid}`;
      if (labelsByIssue.has(issueId)) {
        return Effect.succeed({ status: "skipped", issueId, reason: "unchanged" });
      }
      importedCreateCount += 1;
      labelsByIssue.set(issueId, ["agent:ready"]);
      return Effect.succeed({ status: "created", issueId, addedReadyLabel: true });
    },
  };

  return {
    calls,
    importedCreateCount: () => importedCreateCount,
    labelsOf: (issueId: string) => labelsByIssue.get(issueId) ?? [],
    layer: Layer.succeed(IssueTracker, service),
  };
};

const implementationArtifact = JSON.stringify({
  status: "implemented",
  implementationEvidence: [{ summary: "Implemented by daemon.", files: ["src/index.ts"] }],
  verificationEvidence: [{ command: "pnpm test", status: "passed" }],
  mergeRequest: { reference: "!7", url: "https://gitlab.example/mr/7" },
});

const fakeRunLedger = () => {
  let nextId = 1;
  const runs: RunSummary[] = [
    {
      id: "run_seed_impl",
      issueId: "morph-review",
      lane: "implementation",
      status: "running",
      summary: "morph-review",
      startedAt: "2026-05-19T00:00:00.000Z",
      artifactPath: "/tmp/implementation.json",
      mergeRequestRef: "!7",
    },
  ];
  const artifacts = new Map<string, string>([["run_seed_impl", implementationArtifact]]);
  const service: RunLedgerService = {
    createPreparationRun: (input) => {
      const run: RunSummary = {
        id: `run_${nextId++}`,
        issueId: input.issueId,
        lane: "preparation",
        status: "running",
        summary: input.summary,
        startedAt: "2026-05-19T00:00:00.000Z",
      };
      runs.push(run);
      return Effect.succeed(run);
    },
    createImplementationRun: (input) => {
      const run: RunSummary = {
        id: `run_${nextId++}`,
        issueId: input.issueId,
        lane: "implementation",
        status: "running",
        summary: input.summary,
        startedAt: "2026-05-19T00:00:00.000Z",
      };
      runs.push(run);
      return Effect.succeed(run);
    },
    createReviewRun: (input) => {
      const run: RunSummary = {
        id: `run_${nextId++}`,
        issueId: input.issueId,
        lane: "review",
        status: "running",
        summary: input.summary,
        startedAt: "2026-05-19T00:00:00.000Z",
      };
      runs.push(run);
      return Effect.succeed(run);
    },
    recordImplementationWorkspace: (runId, input) => {
      const run = runs.find((candidate) => candidate.id === runId);
      Object.assign(run ?? {}, {
        workspacePath: input.workspacePath,
        worktreePath: input.worktreePath,
        branch: input.branch,
      });
      return Effect.succeed(run as RunSummary);
    },
    recordMergeRequest: (runId, input) => {
      const run = runs.find((candidate) => candidate.id === runId);
      Object.assign(run ?? {}, {
        mergeRequestRef: input.reference,
        mergeRequestUrl: input.url,
      });
      return Effect.succeed(run as RunSummary);
    },
    finishRun: (runId, input) => {
      const run = runs.find((candidate) => candidate.id === runId);
      Object.assign(run ?? {}, {
        status: input.status,
        failureKind: input.status === "failed" ? input.failureKind : undefined,
        endedAt: "2026-05-19T00:00:01.000Z",
      });
      return Effect.succeed(run as RunSummary);
    },
    writeRunArtifacts: (runId, input) => {
      const run = runs.find((candidate) => candidate.id === runId);
      artifacts.set(runId, input.artifact);
      Object.assign(run ?? {}, {
        transcriptPath: `/tmp/${runId}.txt`,
        artifactPath: `/tmp/${runId}.json`,
      });
      return Effect.succeed(run as RunSummary);
    },
    getRunLogs: (runId): Effect.Effect<RunLogs> =>
      Effect.succeed({ runId, transcriptPath: `/tmp/${runId}.txt`, transcript: "" }),
    getRunArtifact: (runId): Effect.Effect<RunArtifact> =>
      Effect.succeed({
        runId,
        artifactPath: `/tmp/${runId}.json`,
        artifact: artifacts.get(runId) ?? "{}",
      }),
    listRuns: () => Effect.succeed(runs),
    getRun: (runId) => Effect.succeed(runs.find((run) => run.id === runId)),
    getRunEvents: () => Effect.succeed([]),
    pruneRuns: () => Effect.succeed({ applied: false, eligibleRuns: [], totalArtifactBytes: 0 }),
  };

  return Layer.succeed(RunLedger, service);
};

const fakeAgentRunner = (
  statuses: {
    readonly prepare?: "prepared" | "blocked" | "failed";
    readonly implement?: "implemented" | "failed";
    readonly review?: "passed" | "blocked" | "failed";
  } = {},
): Layer.Layer<AgentRunner> => {
  const service: AgentRunnerService = {
    prepareIssue: () => {
      if (statuses.prepare === "blocked") {
        return Effect.succeed({
          status: "blocked",
          reason: "Needs human detail.",
          transcript: "blocked",
          artifact: { status: "blocked" },
        });
      }
      if (statuses.prepare === "failed") {
        return Effect.succeed({
          status: "failed",
          failureKind: "runtime_error",
          message: "Preparation failed.",
          transcript: "failed",
          artifact: { status: "failed" },
        });
      }
      return Effect.succeed({
        status: "prepared",
        contract,
        transcript: "prepared",
        artifact: { status: "prepared" },
      });
    },
    implementIssue: () => {
      if (statuses.implement === "failed") {
        return Effect.succeed({
          status: "failed",
          failureKind: "runtime_error",
          message: "Implementation failed.",
          transcript: "implementation failed",
          artifact: { status: "failed" },
        });
      }

      return Effect.succeed({
        status: "implemented",
        implementationEvidence: [{ summary: "Implemented by daemon.", files: ["src/index.ts"] }],
        verificationEvidence: [{ command: "pnpm test", status: "passed" }],
        transcript: "implemented",
        artifact: { status: "implemented" },
      });
    },
    reviewIssue: () => {
      if (statuses.review === "blocked") {
        return Effect.succeed({
          status: "blocked",
          reason: "Review blocked.",
          findings: [{ severity: "warning", summary: "Needs follow-up." }],
          transcript: "review blocked",
          artifact: { status: "blocked" },
        });
      }

      if (statuses.review === "failed") {
        return Effect.succeed({
          status: "failed",
          failureKind: "runtime_error",
          message: "Review failed.",
          findings: [],
          transcript: "review failed",
          artifact: { status: "failed" },
        });
      }

      return Effect.succeed({
        status: "passed",
        findings: [],
        transcript: "reviewed",
        artifact: { status: "passed" },
      });
    },
  };

  return Layer.succeed(AgentRunner, service);
};

const supportLayer = (
  statuses: Parameters<typeof fakeAgentRunner>[0] = {},
  gitlabIssues: readonly GitLabIssueInput[] = [],
) =>
  Layer.mergeAll(
    Layer.succeed(GitLabIssueSource, {
      listReadyIssues: () => Effect.succeed(gitlabIssues),
    } satisfies GitLabIssueSourceService),
    fakeRunLedger(),
    fakeAgentRunner(statuses),
    Layer.succeed(WorkspaceRuntime, {
      prepareImplementationWorkspace: ({ issueId }) =>
        Effect.succeed({
          workspacePath: `/tmp/${issueId}`,
          branch: `feature/${issueId}`,
          targetBranch: "main",
          remote: "origin",
        }),
      prepareReviewWorkspace: ({ implementationRun }) =>
        Effect.succeed({
          workspacePath: implementationRun.workspacePath ?? "/tmp/review",
          branch: implementationRun.branch,
          permissions: "read-only",
        }),
    } satisfies WorkspaceRuntimeService),
    Layer.succeed(MergeRequestClient, {
      createDraftMergeRequest: () =>
        Effect.succeed({ reference: "!42", url: "https://gitlab.example/mr/42" }),
      updateDescription: (input) =>
        Effect.succeed({ reference: input.reference, url: "https://gitlab.example/mr/42" }),
    } satisfies MergeRequestClientService),
  );

describe("runDaemonOnce", () => {
  it("smokes init to sync to daemon review candidate with fake adapters", async () => {
    const targetRepo = mkdtempSync(join(tmpdir(), "morpheus-e2e-"));
    try {
      const init = initMorpheusRepo({
        target: targetRepo,
        gitlabProject: "group/project",
      });
      expect(init.status).toBe("initialized");

      const loaded = loadMorpheusConfig({ targetRepo });
      expect(loaded.status).toBe("loaded");
      if (loaded.status === "error") {
        throw new Error(`${loaded.error.kind}: ${loaded.error.path}`);
      }

      const tracker = fakeIssueTracker({});
      const layer = Layer.mergeAll(
        tracker.layer,
        supportLayer({}, [
          {
            project: "group/project",
            iid: 42,
            title: "Implement imported issue",
            description: "Ready for Morpheus.",
            webUrl: "https://gitlab.example.com/group/project/-/issues/42",
            labels: ["agent:ready"],
          },
        ]),
      );

      for (let tick = 0; tick < 3; tick += 1) {
        await Effect.runPromise(
          runDaemonOnce({
            project: loaded.config.gitlab.project,
            readyLabel: loaded.config.gitlab.readyLabel,
            syncedAt: `2026-05-19T00:00:0${tick}.000Z`,
          }).pipe(Effect.provide(layer)),
        );
      }

      expect(tracker.labelsOf("morph-gl-42")).toEqual(["agent:review-candidate"]);
      expect(tracker.importedCreateCount()).toBe(1);
    } finally {
      rmSync(targetRepo, { force: true, recursive: true });
    }
  });

  it("syncs first, schedules runnable Beads issues, and dispatches selected lanes", async () => {
    const tracker = fakeIssueTracker({
      "morph-prepare": ["agent:ready"],
      "morph-implement": ["agent:prepared"],
      "morph-review": ["agent:running"],
    });

    const result = await Effect.runPromise(
      runDaemonOnce({
        project: "group/project",
        readyLabel: "agent:ready",
        syncedAt: "2026-05-19T00:00:00.000Z",
      }).pipe(Effect.provide(Layer.mergeAll(tracker.layer, supportLayer()))),
    );

    expect(result.executions.map((execution) => `${execution.lane}:${execution.issueId}`)).toEqual(
      expect.arrayContaining([
        "preparation:morph-prepare",
        "implementation:morph-implement",
        "review:morph-review",
      ]),
    );
    expect(result.executions).toHaveLength(3);
    expect(tracker.calls[0]).toBe("listRunnableIssues");
    expect(tracker.labelsOf("morph-prepare")).toEqual(["agent:prepared"]);
    expect(tracker.labelsOf("morph-implement")).toEqual(["agent:running"]);
    expect(tracker.labelsOf("morph-review")).toEqual(["agent:review-candidate"]);
  });

  it("leaves blocked preparation terminal and does no work on next tick", async () => {
    const tracker = fakeIssueTracker({ "morph-blocked": ["agent:ready"] });
    const layer = Layer.mergeAll(tracker.layer, supportLayer({ prepare: "blocked" }));

    const first = await Effect.runPromise(
      runDaemonOnce({
        project: "group/project",
        readyLabel: "agent:ready",
      }).pipe(Effect.provide(layer)),
    );
    const second = await Effect.runPromise(
      runDaemonOnce({
        project: "group/project",
        readyLabel: "agent:ready",
      }).pipe(Effect.provide(layer)),
    );

    expect(first.executions[0]?.result.status).toBe("blocked");
    expect(tracker.labelsOf("morph-blocked")).toEqual(["agent:blocked"]);
    expect(second.executions).toEqual([]);
  });

  it("leaves failed preparation terminal and does no work on next tick", async () => {
    const tracker = fakeIssueTracker({ "morph-failed": ["agent:ready"] });
    const layer = Layer.mergeAll(tracker.layer, supportLayer({ prepare: "failed" }));

    const first = await Effect.runPromise(
      runDaemonOnce({
        project: "group/project",
        readyLabel: "agent:ready",
      }).pipe(Effect.provide(layer)),
    );
    const second = await Effect.runPromise(
      runDaemonOnce({
        project: "group/project",
        readyLabel: "agent:ready",
      }).pipe(Effect.provide(layer)),
    );

    expect(first.executions[0]?.result.status).toBe("failed");
    expect(tracker.labelsOf("morph-failed")).toEqual(["agent:failed"]);
    expect(second.executions).toEqual([]);
  });

  it("leaves failed implementation terminal and does no work on next tick", async () => {
    const tracker = fakeIssueTracker({ "morph-impl-failed": ["agent:prepared"] });
    const layer = Layer.mergeAll(tracker.layer, supportLayer({ implement: "failed" }));

    const first = await Effect.runPromise(
      runDaemonOnce({
        project: "group/project",
        readyLabel: "agent:ready",
      }).pipe(Effect.provide(layer)),
    );
    const second = await Effect.runPromise(
      runDaemonOnce({
        project: "group/project",
        readyLabel: "agent:ready",
      }).pipe(Effect.provide(layer)),
    );

    expect(first.executions[0]?.result.status).toBe("failed");
    expect(tracker.labelsOf("morph-impl-failed")).toEqual(["agent:failed"]);
    expect(second.executions).toEqual([]);
  });

  it("leaves blocked review terminal and does no work on next tick", async () => {
    const tracker = fakeIssueTracker({ "morph-review": ["agent:running"] });
    const layer = Layer.mergeAll(tracker.layer, supportLayer({ review: "blocked" }));

    const first = await Effect.runPromise(
      runDaemonOnce({
        project: "group/project",
        readyLabel: "agent:ready",
      }).pipe(Effect.provide(layer)),
    );
    const second = await Effect.runPromise(
      runDaemonOnce({
        project: "group/project",
        readyLabel: "agent:ready",
      }).pipe(Effect.provide(layer)),
    );

    expect(first.executions[0]?.result.status).toBe("blocked");
    expect(tracker.labelsOf("morph-review")).toEqual(["agent:blocked"]);
    expect(second.executions).toEqual([]);
  });

  it("renders useful no-work output for one-shot mode", async () => {
    const tracker = fakeIssueTracker({});

    const output = await Effect.runPromise(
      runDaemonOnceForCli({
        project: "group/project",
        readyLabel: "agent:ready",
      }).pipe(Effect.provide(Layer.mergeAll(tracker.layer, supportLayer()))),
    );

    expect(output).toContain("Morpheus daemon tick");
    expect(output).toContain("selected: preparation=0 implementation=0 review=0");
    expect(output).toContain("work: None");
  });
});
