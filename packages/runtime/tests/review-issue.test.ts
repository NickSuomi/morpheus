import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deriveIssueState, deriveLane, type AgentReadyContract } from "@morpheus/core";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import {
  AgentRunner,
  IssueTracker,
  MergeRequestClient,
  reviewIssue,
  RunLedger,
  WorkspaceRuntime,
  type AgentRunnerService,
  type IssueTrackerService,
  type MergeRequestClientService,
  type ReviewAgentInput,
  type RunLedgerService,
  type RunSummary,
  type TrackedIssue,
  type WorkspaceRuntimeService,
} from "../src/index.js";

const contract: AgentReadyContract = {
  category: "task",
  summary: "Review implementation evidence.",
  currentBehavior: "Implementation has produced MR evidence.",
  desiredBehavior: "Morpheus runs a read-only reviewer and records typed findings.",
  keyInterfaces: ["AgentRunner", "RunLedger", "MergeRequestClient"],
  acceptanceCriteria: ["Review findings update the MR."],
  outOfScope: ["Human merge"],
  verificationPlan: ["pnpm check"],
  blockedBy: "None",
  hitlDecisions: "None",
  riskLevel: "medium",
};

const trackedIssue = (labels: readonly string[]): TrackedIssue => {
  const derivedState = deriveIssueState(labels);
  return {
    id: "morph-wv6",
    title: "Run read-only review",
    labels,
    derivedState,
    lane: derivedState.status === "active" ? deriveLane(derivedState.state) : "none",
  };
};

const fakeIssueTracker = () => {
  let labels = ["agent:running"];
  const service: IssueTrackerService = {
    listRunnableIssues: () => Effect.succeed([trackedIssue(labels)]),
    getIssue: () => Effect.succeed(trackedIssue(labels)),
    applyAgentState: (issueId, transitionPlan) => {
      if (transitionPlan.status !== "planned") {
        return Effect.succeed({
          status: "rejected" as const,
          issueId,
          reason: transitionPlan.status,
          plan: transitionPlan,
        });
      }
      labels = [...transitionPlan.finalLabels];
      return Effect.succeed({
        status: "applied" as const,
        issueId,
        addLabels: transitionPlan.addLabels,
        removeLabels: transitionPlan.removeLabels,
      });
    },
    writeContract: (issueId) => Effect.succeed({ status: "written" as const, issueId }),
    readContract: (issueId) =>
      Effect.succeed({
        status: "present" as const,
        issueId,
        contract,
      }),
    listImportedGitLabIssues: () => Effect.succeed([]),
    upsertImportedGitLabIssue: () =>
      Effect.succeed({ status: "skipped", issueId: "morph-skip", reason: "unchanged" }),
  };

  return {
    get labels() {
      return labels;
    },
    layer: Layer.succeed(IssueTracker, service),
  };
};

const withImplementationArtifact = async <A>(
  fn: (artifactPath: string) => Promise<A>,
): Promise<A> => {
  const dir = mkdtempSync(join(tmpdir(), "morpheus-review-"));
  try {
    const artifactPath = join(dir, "artifact.json");
    writeFileSync(
      artifactPath,
      JSON.stringify({
        status: "implemented",
        implementationEvidence: [
          { summary: "Implemented review workflow.", files: ["packages/runtime/src/index.ts"] },
        ],
        verificationEvidence: [{ command: "pnpm check", status: "passed", output: "passed" }],
        mergeRequest: { reference: "!42", url: "https://gitlab.example/mr/42" },
      }),
    );
    return await fn(artifactPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const fakeRunLedger = (artifactPath: string) => {
  const events: string[] = [];
  const implementationRun: RunSummary = {
    id: "run_implementation",
    issueId: "morph-wv6",
    lane: "implementation",
    status: "running",
    summary: "Run read-only review",
    startedAt: "2026-05-18T00:00:00.000Z",
    artifactPath,
    workspacePath: "/repo",
    worktreePath: "/repo",
    branch: "feature/beads-sequential",
    mergeRequestRef: "!42",
    mergeRequestUrl: "https://gitlab.example/mr/42",
  };
  let reviewRun: RunSummary = {
    id: "run_review",
    issueId: "morph-wv6",
    lane: "review",
    status: "running",
    summary: "Run read-only review",
    startedAt: "2026-05-18T00:00:01.000Z",
  };
  const service: RunLedgerService = {
    createPreparationRun: () => Effect.succeed({ ...reviewRun, lane: "preparation" }),
    createImplementationRun: () => Effect.succeed(implementationRun),
    createReviewRun: (input) => {
      events.push("StartReview");
      reviewRun = { ...reviewRun, issueId: input.issueId, summary: input.summary };
      return Effect.succeed(reviewRun);
    },
    recordImplementationWorkspace: () => Effect.succeed(reviewRun),
    recordMergeRequest: (_runId, input) => {
      events.push("DraftMergeRequestCreated");
      reviewRun = { ...reviewRun, mergeRequestRef: input.reference, mergeRequestUrl: input.url };
      return Effect.succeed(reviewRun);
    },
    writeRunArtifacts: () => {
      events.push("RunArtifactsWritten");
      reviewRun = {
        ...reviewRun,
        transcriptPath: "/tmp/review.txt",
        artifactPath: "/tmp/review.json",
      };
      return Effect.succeed(reviewRun);
    },
    finishRun: (_runId, input) => {
      events.push(input.terminalEvent ?? "ReviewFailed");
      reviewRun = {
        ...reviewRun,
        status: input.status,
        failureKind: input.status === "failed" ? input.failureKind : undefined,
        endedAt: "2026-05-18T00:00:02.000Z",
      };
      return Effect.succeed(reviewRun);
    },
    getRunLogs: () => Effect.succeed({ runId: reviewRun.id, transcriptPath: "", transcript: "" }),
    getRunArtifact: (runId) =>
      Effect.succeed({
        runId,
        artifactPath,
        artifact: readFileSync(artifactPath, "utf8"),
      }),
    listRuns: () => Effect.succeed([implementationRun, reviewRun]),
    getRun: () => Effect.succeed(reviewRun),
    getRunEvents: () =>
      Effect.succeed(
        events.map((type, index) => ({
          sequence: index + 1,
          runId: reviewRun.id,
          type,
          occurredAt: "2026-05-18T00:00:00.000Z",
        })),
      ),
    pruneRuns: (input) =>
      Effect.succeed({
        applied: input.apply,
        eligibleRuns: [],
        totalArtifactBytes: 0,
      }),
  };

  return {
    events,
    get run() {
      return reviewRun;
    },
    layer: Layer.succeed(RunLedger, service),
  };
};

const fakeWorkspaceRuntime = () => {
  const calls: string[] = [];
  const service: WorkspaceRuntimeService = {
    prepareImplementationWorkspace: () => Effect.die("not used"),
    prepareReviewWorkspace: ({ issueId, runId, implementationRun }) => {
      calls.push(`review:${issueId}:${runId}`);
      return Effect.succeed({
        workspacePath: implementationRun.workspacePath ?? ".",
        worktreePath: implementationRun.worktreePath,
        branch: implementationRun.branch,
        permissions: "read-only" as const,
      });
    },
  };
  return {
    calls,
    layer: Layer.succeed(WorkspaceRuntime, service),
  };
};

const fakeMergeRequests = () => {
  const descriptions: string[] = [];
  const service: MergeRequestClientService = {
    createDraftMergeRequest: () => Effect.die("not used"),
    updateDescription: (input) => {
      descriptions.push(input.description);
      return Effect.succeed({ reference: input.reference });
    },
  };
  return {
    descriptions,
    layer: Layer.succeed(MergeRequestClient, service),
  };
};

const fakeAgentRunner = (scenario: "passed" | "blocked" | "failed" | "malformed") => {
  const inputs: ReviewAgentInput[] = [];
  const service: AgentRunnerService = {
    prepareIssue: () => Effect.die("not used"),
    reviewIssue: (input) => {
      inputs.push(input);
      if (scenario === "malformed") {
        return Effect.succeed({
          status: "passed",
          findings: [{ severity: "critical", summary: "bad severity" }],
          transcript: "malformed",
          artifact: {},
        });
      }
      if (scenario === "blocked") {
        return Effect.succeed({
          status: "blocked",
          reason: "Needs human product decision.",
          findings: [{ severity: "warning", summary: "Decision missing." }],
          transcript: "blocked",
          artifact: {},
        });
      }
      if (scenario === "failed") {
        return Effect.succeed({
          status: "failed",
          failureKind: "verification_error",
          message: "Verification claim is false.",
          findings: [{ severity: "error", summary: "Verification mismatch." }],
          transcript: "failed",
          artifact: {},
        });
      }
      return Effect.succeed({
        status: "passed",
        findings: [{ severity: "info", summary: "Review passed." }],
        transcript: "passed",
        artifact: {},
      });
    },
  };
  return {
    inputs,
    layer: Layer.succeed(AgentRunner, service),
  };
};

const runReview = async (scenario: "passed" | "blocked" | "failed" | "malformed") =>
  withImplementationArtifact(async (artifactPath) => {
    const tracker = fakeIssueTracker();
    const ledger = fakeRunLedger(artifactPath);
    const mergeRequests = fakeMergeRequests();
    const runner = fakeAgentRunner(scenario);
    const workspace = fakeWorkspaceRuntime();
    const result = await Effect.runPromise(
      reviewIssue("morph-wv6").pipe(
        Effect.provide(
          Layer.mergeAll(
            tracker.layer,
            ledger.layer,
            mergeRequests.layer,
            runner.layer,
            workspace.layer,
          ),
        ),
      ),
    );
    return { result, tracker, ledger, mergeRequests, runner, workspace };
  });

describe("reviewIssue", () => {
  it("moves running work through reviewing to review-candidate with typed findings", async () => {
    const { result, tracker, ledger, mergeRequests } = await runReview("passed");

    expect(result.status).toBe("review_candidate");
    expect(tracker.labels).toEqual(["agent:review-candidate"]);
    expect(ledger.run.status).toBe("succeeded");
    expect(ledger.events).toEqual([
      "StartReview",
      "DraftMergeRequestCreated",
      "RunArtifactsWritten",
      "ReviewPassed",
    ]);
    expect(mergeRequests.descriptions[0]).toContain("- [info] Review passed.");
    expect(mergeRequests.descriptions[0]).toContain("Review verdict: passed");
    expect(mergeRequests.descriptions[0]).toContain("Implemented review workflow.");
  });

  it("passes read-only workspace permissions to the reviewer", async () => {
    const { runner, workspace } = await runReview("passed");

    expect(runner.inputs[0]?.workspace).toMatchObject({
      workspacePath: "/repo",
      branch: "feature/beads-sequential",
      permissions: "read-only",
    });
    expect(workspace.calls).toEqual(["review:morph-wv6:run_review"]);
  });

  it("transitions blocked review to agent:blocked with ledger evidence", async () => {
    const { result, tracker, ledger, mergeRequests } = await runReview("blocked");

    expect(result).toMatchObject({ status: "blocked", reason: "Needs human product decision." });
    expect(tracker.labels).toEqual(["agent:blocked"]);
    expect(ledger.run).toMatchObject({ status: "failed", failureKind: "agent_contract_error" });
    expect(ledger.events).toContain("ReviewBlocked");
    expect(mergeRequests.descriptions[0]).toContain("- [warning] Decision missing.");
    expect(mergeRequests.descriptions[0]).toContain("Review verdict: blocked");
  });

  it("transitions failed review to agent:failed with ledger evidence", async () => {
    const { result, tracker, ledger, mergeRequests } = await runReview("failed");

    expect(result).toMatchObject({ status: "failed", failureKind: "verification_error" });
    expect(tracker.labels).toEqual(["agent:failed"]);
    expect(ledger.run).toMatchObject({ status: "failed", failureKind: "verification_error" });
    expect(ledger.events).toContain("ReviewFailed");
    expect(mergeRequests.descriptions[0]).toContain("- [error] Verification mismatch.");
    expect(mergeRequests.descriptions[0]).toContain("Review verdict: failed");
  });

  it("rejects malformed review findings before updating the MR", async () => {
    const { result, tracker, ledger, mergeRequests } = await runReview("malformed");

    expect(result).toMatchObject({
      status: "failed",
      failureKind: "agent_contract_error",
      message: expect.stringContaining("Invalid review result"),
    });
    expect(tracker.labels).toEqual(["agent:failed"]);
    expect(ledger.events).toContain("ReviewFailed");
    expect(mergeRequests.descriptions).toEqual([]);
  });
});
