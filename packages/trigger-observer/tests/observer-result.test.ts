import { describe, expect, it } from "vitest";
import { observerResult, parseObserverProjection, type ObserverProjection } from "../src/model.js";

const projection: ObserverProjection = {
  schemaVersion: 1,
  authority: "morpheus",
  projectionKind: "execution-observer",
  targetId: "target_0123456789abcdef0123456789abcdef",
  issueId: "issue_0123456789abcdef0123456789abcdef",
  runId: "run_0123456789abcdef0123456789abcdef",
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
        runId: "run_0123456789abcdef0123456789abcdef",
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

  it("rejects untrusted values outside the opaque and curated projection schema", () => {
    expect(() =>
      parseObserverProjection({
        ...projection,
        runId: "private/group#113",
      }),
    ).toThrow("invalid execution projection");
    expect(() =>
      parseObserverProjection({
        ...projection,
        failureKind: "private exception text",
      }),
    ).toThrow("invalid execution projection");
    expect(() =>
      parseObserverProjection({
        ...projection,
        lane: "deploy",
      }),
    ).toThrow("invalid execution projection");
  });
});
