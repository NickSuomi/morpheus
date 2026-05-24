import { describe, expect, it } from "vitest";
import { scheduleLanes } from "../src/index.js";

describe("LaneScheduler", () => {
  it("selects preparation, implementation, and review work independently", () => {
    const schedule = scheduleLanes([
      {
        id: "morph-ready",
        labels: ["agent:ready"],
        priority: 2,
        createdAt: "2026-05-12T10:00:00Z",
      },
      {
        id: "morph-prepared",
        labels: ["agent:prepared"],
        priority: 2,
        createdAt: "2026-05-12T10:00:00Z",
      },
      {
        id: "morph-running",
        labels: ["agent:running"],
        priority: 2,
        createdAt: "2026-05-12T10:00:00Z",
      },
    ]);

    expect(schedule.selected.preparation.map((issue) => issue.id)).toEqual(["morph-ready"]);
    expect(schedule.selected.implementation.map((issue) => issue.id)).toEqual(["morph-prepared"]);
    expect(schedule.selected.review.map((issue) => issue.id)).toEqual(["morph-running"]);
  });

  it("defaults each lane capacity to one and accepts configured limits", () => {
    const issues = [
      { id: "morph-a", labels: ["agent:ready"] },
      { id: "morph-b", labels: ["agent:ready"] },
      { id: "morph-c", labels: ["agent:prepared"] },
      { id: "morph-d", labels: ["agent:prepared"] },
    ];

    expect(scheduleLanes(issues).selected.preparation).toHaveLength(1);
    expect(scheduleLanes(issues).selected.implementation).toHaveLength(1);

    const schedule = scheduleLanes(issues, {
      preparation: 2,
      implementation: 1,
      review: 1,
    });

    expect(schedule.capacities).toEqual({
      preparation: 2,
      implementation: 1,
      review: 1,
    });
    expect(schedule.selected.preparation).toHaveLength(2);
    expect(schedule.selected.implementation).toHaveLength(1);
  });

  it("rejects invalid capacity values", () => {
    expect(() =>
      scheduleLanes([{ id: "morph-a", labels: ["agent:ready"] }], {
        preparation: 0,
      }),
    ).toThrow("Lane capacity must be a positive integer");

    expect(() =>
      scheduleLanes([{ id: "morph-a", labels: ["agent:ready"] }], {
        preparation: 1.5,
      }),
    ).toThrow("Lane capacity must be a positive integer");
  });

  it("orders work by priority, then date, then issue id", () => {
    const schedule = scheduleLanes(
      [
        {
          id: "morph-c",
          labels: ["agent:ready"],
          priority: 2,
          createdAt: "2026-05-12T10:00:00Z",
        },
        {
          id: "morph-a",
          labels: ["agent:ready"],
          priority: 1,
          createdAt: "2026-05-12T11:00:00Z",
        },
        {
          id: "morph-b",
          labels: ["agent:ready"],
          priority: 1,
          createdAt: "2026-05-12T09:00:00Z",
        },
        {
          id: "morph-d",
          labels: ["agent:ready"],
          priority: 1,
          createdAt: "2026-05-12T09:00:00Z",
        },
      ],
      { preparation: 4 },
    );

    expect(schedule.selected.preparation.map((issue) => issue.id)).toEqual([
      "morph-b",
      "morph-d",
      "morph-a",
      "morph-c",
    ]);
  });

  it("excludes conflicting agent states fail-closed", () => {
    const schedule = scheduleLanes([
      {
        id: "morph-conflict",
        labels: ["agent:ready", "agent:running"],
      },
    ]);

    expect(schedule.selected.preparation).toEqual([]);
    expect(schedule.selected.review).toEqual([]);
    expect(schedule.excluded).toEqual([
      {
        issue: {
          id: "morph-conflict",
          labels: ["agent:ready", "agent:running"],
        },
        reason: "state_conflict",
        activeStates: ["agent:ready", "agent:running"],
      },
    ]);
  });

  it("returns empty queues when no issues are runnable", () => {
    const schedule = scheduleLanes([]);

    expect(schedule.queues).toEqual({
      preparation: [],
      implementation: [],
      review: [],
    });
    expect(schedule.selected).toEqual({
      preparation: [],
      implementation: [],
      review: [],
    });
    expect(schedule.excluded).toEqual([]);
  });
});
