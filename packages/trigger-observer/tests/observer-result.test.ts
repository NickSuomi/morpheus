import { describe, expect, it } from "vitest";
import { observerResult, type ObserverProjection } from "../src/model.js";

const projection: ObserverProjection = {
  schemaVersion: 1,
  authority: "morpheus",
  projectionKind: "execution-observer",
  targetId: "target_opaque",
  issueId: "issue_opaque",
  runId: "run_opaque",
  generation: 1,
  lane: "review",
  status: "succeeded",
  morpheusState: "agent:review-candidate",
  eventSequence: 5,
  startedAt: "2026-07-25T00:00:00.000Z",
  endedAt: "2026-07-25T00:02:00.000Z",
  requiredHumanAction: "review-in-gitlab",
};

describe("observerResult", () => {
  it("returns a redacted success projection", () => {
    expect(observerResult(projection)).toEqual({
      kind: "succeeded",
      projection,
    });
  });

  it("returns a bounded failure without copying source text", () => {
    expect(
      observerResult({
        ...projection,
        status: "failed",
        morpheusState: "agent:failed",
        failureKind: "verification_error",
        requiredHumanAction: "inspect-morpheus-run",
      }),
    ).toEqual({
      kind: "failed",
      failureKind: "verification_error",
      projection: expect.objectContaining({
        runId: "run_opaque",
      }),
    });
  });

  it("rejects non-terminal waitpoint output", () => {
    expect(() =>
      observerResult({
        ...projection,
        status: "running",
        endedAt: undefined,
        requiredHumanAction: null,
      }),
    ).toThrow("terminal projection");
  });
});
