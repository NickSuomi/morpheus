import { deriveIssueState, deriveLane } from "@morpheus/core";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import {
  IssueTracker,
  OperatorHealth,
  operatorDoctorForCli,
  operatorSliceForCli,
  operatorStatusForCli,
  RunLedger,
  type IssueTrackerService,
  type RunEvent,
  type RunLedgerService,
  type RunSummary,
  type TrackedIssue,
} from "../src/index.js";

const trackedIssue = (
  id: string,
  labels: readonly string[],
  options: {
    readonly title?: string;
    readonly dependencyCount?: number;
    readonly dependentCount?: number;
    readonly dependencyIds?: readonly string[];
    readonly dependentIds?: readonly string[];
  } = {},
): TrackedIssue => {
  const derivedState = deriveIssueState(labels);

  return {
    id,
    title: options.title ?? id,
    labels,
    dependencyCount: options.dependencyCount,
    dependentCount: options.dependentCount,
    dependencyIds: options.dependencyIds,
    dependentIds: options.dependentIds,
    derivedState,
    lane: derivedState.status === "active" ? deriveLane(derivedState.state) : "none",
  };
};

const issues = [
  trackedIssue("morph-ready", ["agent:ready"], { title: "Prepare issue" }),
  trackedIssue("morph-prepared", ["agent:prepared"], { title: "Implement issue" }),
  trackedIssue("morph-running", ["agent:running"], {
    title: "Review issue",
    dependencyCount: 2,
    dependentCount: 1,
    dependencyIds: ["morph-prepared", "morph-ready"],
  }),
  trackedIssue("morph-dependent", ["agent:ready"], {
    title: "Dependent issue",
    dependencyIds: ["morph-running"],
  }),
  trackedIssue("morph-blocked", ["agent:blocked"]),
  trackedIssue("morph-failed", ["agent:failed"]),
];

const runs: readonly RunSummary[] = [
  {
    id: "run_preparation",
    issueId: "morph-running",
    lane: "preparation",
    status: "succeeded",
    summary: "Prepared review issue",
    startedAt: "2026-05-13T11:09:18.418Z",
    transcriptPath: "/tmp/run_preparation/transcript.txt",
    artifactPath: "/tmp/run_preparation/artifact.json",
  },
  {
    id: "run_implementation",
    issueId: "morph-running",
    lane: "implementation",
    status: "succeeded",
    summary: "Implemented review issue",
    startedAt: "2026-05-13T11:10:18.418Z",
    mergeRequestRef: "!42",
    mergeRequestUrl: "https://gitlab.example/mr/42",
  },
  {
    id: "run_review",
    issueId: "morph-running",
    lane: "review",
    status: "failed",
    summary: "Reviewed issue",
    startedAt: "2026-05-13T11:11:18.418Z",
    failureKind: "verification_error",
    transcriptPath: "/tmp/run_review/transcript.txt",
    artifactPath: "/tmp/run_review/artifact.json",
  },
  {
    id: "run_current",
    issueId: "morph-ready",
    lane: "preparation",
    status: "running",
    summary: "Current preparation",
    startedAt: "2026-05-13T11:12:18.418Z",
  },
];

const events: Record<string, readonly RunEvent[]> = {
  run_preparation: [{ sequence: 1, runId: "run_preparation", type: "PreparationSucceeded", occurredAt: "2026-05-13T11:09:19.418Z" }],
  run_implementation: [{ sequence: 1, runId: "run_implementation", type: "ImplementationReadyForReview", occurredAt: "2026-05-13T11:10:19.418Z" }],
  run_review: [{ sequence: 1, runId: "run_review", type: "RunPruned", occurredAt: "2026-05-13T11:12:19.418Z" }],
  run_current: [],
};

const issueTrackerLayer = Layer.succeed(IssueTracker, {
  listRunnableIssues: () => Effect.succeed(issues),
  getIssue: (issueId) => Effect.succeed(issues.find((issue) => issue.id === issueId) ?? issues[0]),
  applyAgentState: (issueId, transitionPlan) =>
    Effect.succeed({
      status: "applied",
      issueId,
      addLabels: transitionPlan.status === "planned" ? transitionPlan.addLabels : [],
      removeLabels: transitionPlan.status === "planned" ? transitionPlan.removeLabels : [],
    }),
  writeContract: (issueId) => Effect.succeed({ status: "written", issueId }),
  readContract: (issueId) => Effect.succeed({ status: "missing", issueId }),
} satisfies IssueTrackerService);

const runLedgerLayer = Layer.succeed(RunLedger, {
  createPreparationRun: () => Effect.succeed(runs[0]),
  createImplementationRun: () => Effect.succeed(runs[1]),
  createReviewRun: () => Effect.succeed(runs[2]),
  recordImplementationWorkspace: () => Effect.succeed(runs[1]),
  recordMergeRequest: () => Effect.succeed(runs[1]),
  finishRun: () => Effect.succeed(runs[2]),
  writeRunArtifacts: () => Effect.succeed(runs[2]),
  getRunLogs: () =>
    Effect.succeed({
      runId: "run_review",
      transcriptPath: "/tmp/run_review/transcript.txt",
      transcript: "review transcript",
    }),
  getRunArtifact: () =>
    Effect.succeed({
      runId: "run_review",
      artifactPath: "/tmp/run_review/artifact.json",
      artifact: "{}",
    }),
  listRuns: () => Effect.succeed(runs),
  getRun: (runId) => Effect.succeed(runs.find((run) => run.id === runId)),
  getRunEvents: (runId) => Effect.succeed(events[runId] ?? []),
} satisfies RunLedgerService);

const healthLayer = Layer.succeed(OperatorHealth, {
  check: () =>
    Effect.succeed([
      { name: "beads", status: "ok", detail: "bd readable" },
      { name: "gitlab", status: "warn", detail: "glab auth unavailable" },
      { name: "docker", status: "ok", detail: "docker reachable" },
      { name: "workspace", status: "ok", detail: "workspace readable" },
      { name: "labels", status: "ok", detail: "agent labels readable" },
      { name: "daemon", status: "ok", detail: "daemon assumptions readable" },
      { name: "containers", status: "ok", detail: "containers readable" },
      { name: "worktrees", status: "ok", detail: "worktrees readable" },
      { name: "config", status: "ok", detail: "config loaded" },
    ]),
});

const operatorLayer = Layer.mergeAll(issueTrackerLayer, runLedgerLayer, healthLayer);

describe("operator CLI rendering", () => {
  it("renders read-only status with lanes, runnable counts, blocked/failed counts, and runs", async () => {
    const output = await Effect.runPromise(operatorStatusForCli().pipe(Effect.provide(operatorLayer)));

    expect(output).toContain("lanes: preparation=2 implementation=1 review=1");
    expect(output).toContain("runnable: preparation=1 implementation=1 review=1");
    expect(output).toContain("blocked=1 failed=1");
    expect(output).toContain("- run_current morph-ready preparation running Current preparation");
  });

  it("renders an issue slice with lane runs, MR, failure, paths, and tombstone events", async () => {
    const output = await Effect.runPromise(
      operatorSliceForCli("morph-running").pipe(Effect.provide(operatorLayer)),
    );

    expect(output).toContain("Morpheus slice morph-running");
    expect(output).toContain("dependencies: morph-prepared, morph-ready");
    expect(output).toContain("dependents: morph-dependent");
    expect(output).toContain("preparation: succeeded run_preparation");
    expect(output).toContain("implementation: succeeded run_implementation");
    expect(output).toContain("review: failed run_review tombstone=2026-05-13T11:12:19.418Z");
    expect(output).toContain("mergeRequest: !42");
    expect(output).toContain("failure: verification_error");
    expect(output).toContain("transcript: /tmp/run_review/transcript.txt");
    expect(output).toContain("artifact: /tmp/run_review/artifact.json");
  });

  it("renders doctor health checks including ledger state", async () => {
    const output = await Effect.runPromise(operatorDoctorForCli.pipe(Effect.provide(operatorLayer)));

    expect(output).toContain("OK beads: bd readable");
    expect(output).toContain("WARN gitlab: glab auth unavailable");
    expect(output).toContain("OK ledger: run ledger readable");
  });
});
