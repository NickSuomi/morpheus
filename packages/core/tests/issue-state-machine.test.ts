import { describe, expect, it } from "vitest";
import {
  type AgentEvent,
  type AgentState,
  deriveIssueState,
  deriveLane,
  planAgentStateTransition,
} from "../src/index.js";

const validTransitions: ReadonlyArray<{
  readonly from: AgentState;
  readonly event: AgentEvent;
  readonly to: AgentState;
}> = [
  {
    from: "agent:ready",
    event: "DuplicateImportDetected",
    to: "agent:failed",
  },
  {
    from: "agent:ready",
    event: "StartPreparation",
    to: "agent:preparing",
  },
  {
    from: "agent:preparing",
    event: "PreparationReady",
    to: "agent:prepared",
  },
  {
    from: "agent:preparing",
    event: "PreparationBlocked",
    to: "agent:blocked",
  },
  {
    from: "agent:preparing",
    event: "PreparationFailed",
    to: "agent:failed",
  },
  {
    from: "agent:prepared",
    event: "DuplicateImportDetected",
    to: "agent:failed",
  },
  {
    from: "agent:prepared",
    event: "StartImplementation",
    to: "agent:running",
  },
  {
    from: "agent:prepared",
    event: "ImplementationFailed",
    to: "agent:failed",
  },
  {
    from: "agent:running",
    event: "DuplicateImportDetected",
    to: "agent:failed",
  },
  {
    from: "agent:running",
    event: "ImplementationReadyForReview",
    to: "agent:reviewing",
  },
  {
    from: "agent:running",
    event: "ImplementationBlocked",
    to: "agent:blocked",
  },
  {
    from: "agent:running",
    event: "ImplementationFailed",
    to: "agent:failed",
  },
  {
    from: "agent:reviewing",
    event: "ReviewPassed",
    to: "agent:review-candidate",
  },
  {
    from: "agent:reviewing",
    event: "ReviewBlocked",
    to: "agent:blocked",
  },
  {
    from: "agent:reviewing",
    event: "ReviewFailed",
    to: "agent:failed",
  },
  {
    from: "agent:review-candidate",
    event: "ReviewGateFailed",
    to: "agent:failed",
  },
  {
    from: "agent:blocked",
    event: "HumanRequeued",
    to: "agent:ready",
  },
  {
    from: "agent:blocked",
    event: "HumanRetryFailed",
    to: "agent:ready",
  },
  {
    from: "agent:failed",
    event: "HumanRequeued",
    to: "agent:ready",
  },
  {
    from: "agent:failed",
    event: "HumanRetryFailed",
    to: "agent:ready",
  },
];

describe("IssueStateMachine", () => {
  it("fails closed when multiple active agent states are present", () => {
    const result = deriveIssueState(["agent:ready", "agent:running"]);

    expect(result).toEqual({
      status: "conflict",
      failureKind: "state_conflict",
      activeStates: ["agent:ready", "agent:running"],
    });
  });

  it("accepts exactly one active agent state", () => {
    const result = deriveIssueState(["agent:ready"]);

    expect(result).toEqual({
      status: "active",
      state: "agent:ready",
    });
  });

  it("plans valid transitions as label mutations without applying them", () => {
    const result = planAgentStateTransition(
      ["agent:ready", "bug", "ready-for-agent"],
      "StartPreparation",
    );

    expect(result).toEqual({
      status: "planned",
      event: "StartPreparation",
      from: "agent:ready",
      to: "agent:preparing",
      addLabels: ["agent:preparing"],
      removeLabels: ["agent:ready"],
      finalLabels: ["bug", "ready-for-agent", "agent:preparing"],
    });
  });

  it("repairs stale duplicate lifecycle labels when exactly one active state can handle the event", () => {
    const result = planAgentStateTransition(
      ["agent:prepared", "agent:preparing", "bug"],
      "StartImplementation",
    );

    expect(result).toEqual({
      status: "planned",
      event: "StartImplementation",
      from: "agent:prepared",
      to: "agent:running",
      addLabels: ["agent:running"],
      removeLabels: ["agent:prepared", "agent:preparing"],
      finalLabels: ["bug", "agent:running"],
    });
  });

  it("rejects invalid transitions without guessing", () => {
    const result = planAgentStateTransition(["agent:ready"], "StartImplementation");

    expect(result).toEqual({
      status: "invalid_transition",
      from: "agent:ready",
      event: "StartImplementation",
    });
  });

  it.each(validTransitions)("plans $event from $from to $to", ({ from, event, to }) => {
    const result = planAgentStateTransition([from], event);

    expect(result).toEqual({
      status: "planned",
      event,
      from,
      to,
      addLabels: [to],
      removeLabels: [from],
      finalLabels: [to],
    });
  });

  it("does not transition review candidates automatically", () => {
    const result = planAgentStateTransition(["agent:review-candidate"], "HumanRequeued");

    expect(result).toEqual({
      status: "invalid_transition",
      from: "agent:review-candidate",
      event: "HumanRequeued",
    });
  });

  it("treats missing agent state as non-runnable instead of conflict", () => {
    const result = deriveIssueState(["bug", "ready-for-agent"]);

    expect(result).toEqual({
      status: "missing",
    });
  });

  it("derives runnable lanes from active issue state", () => {
    expect(deriveLane("agent:ready")).toBe("preparation");
    expect(deriveLane("agent:prepared")).toBe("implementation");
    expect(deriveLane("agent:running")).toBe("review");
    expect(deriveLane("agent:blocked")).toBe("none");
    expect(deriveLane("agent:review-candidate")).toBe("none");
  });
});
