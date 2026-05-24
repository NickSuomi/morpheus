import { deriveIssueState, deriveLane } from "@morpheus/core";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import {
  IssueTracker,
  scheduleLaneWork,
  type IssueTrackerService,
  type TrackedIssue,
} from "../src/index.js";

const trackedIssue = (
  id: string,
  labels: readonly string[],
  options: {
    readonly priority?: number;
    readonly createdAt?: string;
  } = {},
): TrackedIssue => {
  const derivedState = deriveIssueState(labels);

  return {
    id,
    title: id,
    labels,
    priority: options.priority,
    createdAt: options.createdAt,
    derivedState,
    lane: derivedState.status === "active" ? deriveLane(derivedState.state) : "none",
  };
};

const fakeIssueTracker = (issues: readonly TrackedIssue[]) => {
  const calls: string[] = [];
  const service: IssueTrackerService = {
    listRunnableIssues: () => {
      calls.push("listRunnableIssues");
      return Effect.succeed(issues);
    },
    getIssue: (issueId) =>
      Effect.succeed(issues.find((issue) => issue.id === issueId) ?? issues[0]),
    applyAgentState: (issueId, transitionPlan) =>
      Effect.succeed({
        status: "applied",
        issueId,
        addLabels: transitionPlan.status === "planned" ? transitionPlan.addLabels : [],
        removeLabels: transitionPlan.status === "planned" ? transitionPlan.removeLabels : [],
      }),
    writeContract: (issueId) => Effect.succeed({ status: "written", issueId }),
    readContract: (issueId) => Effect.succeed({ status: "missing", issueId }),
    listImportedGitLabIssues: () => Effect.succeed([]),
    upsertImportedGitLabIssue: () =>
      Effect.succeed({ status: "skipped", issueId: "morph-skip", reason: "unchanged" }),
  };

  return {
    calls,
    layer: Layer.succeed(IssueTracker, service),
  };
};

describe("scheduleLaneWork", () => {
  it("uses Beads issue state to schedule lanes without global sequential ownership", async () => {
    const tracker = fakeIssueTracker([
      trackedIssue("morph-a", ["agent:ready"], {
        priority: 2,
        createdAt: "2026-05-12T10:00:00Z",
      }),
      trackedIssue("morph-b", ["agent:ready"], {
        priority: 1,
        createdAt: "2026-05-12T10:00:00Z",
      }),
      trackedIssue("morph-c", ["agent:prepared"]),
      trackedIssue("morph-d", ["agent:running"]),
      trackedIssue("morph-e", ["agent:ready", "agent:running"]),
    ]);

    const tick = await Effect.runPromise(
      scheduleLaneWork({
        capacities: {
          preparation: 1,
          implementation: 1,
          review: 1,
        },
      }).pipe(Effect.provide(tracker.layer)),
    );

    expect(tracker.calls).toEqual(["listRunnableIssues"]);
    expect(tick.commands).toEqual({
      preparation: [{ lane: "preparation", issueId: "morph-b" }],
      implementation: [{ lane: "implementation", issueId: "morph-c" }],
      review: [{ lane: "review", issueId: "morph-d" }],
    });
    const schedule = tick.schedule;
    expect(schedule.selected.preparation.map((issue) => issue.id)).toEqual(["morph-b"]);
    expect(schedule.selected.implementation.map((issue) => issue.id)).toEqual(["morph-c"]);
    expect(schedule.selected.review.map((issue) => issue.id)).toEqual(["morph-d"]);
    expect(tick.reconciliation.excluded).toEqual([
      {
        issue: expect.objectContaining({
          id: "morph-e",
          labels: ["agent:ready", "agent:running"],
        }),
        reason: "state_conflict",
        activeStates: ["agent:ready", "agent:running"],
      },
    ]);
  });
});
