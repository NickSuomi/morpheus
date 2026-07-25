import {
  ExecutionObserverError,
  type ExecutionObserverService,
  type RunEvent,
  type RunLedgerService,
  type RunSummary,
} from "@morpheus/runtime";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createObservedRunLedger } from "../src/index.js";

const startedRun: RunSummary = {
  id: "run_local_1",
  issueId: "private-target#113",
  lane: "preparation",
  status: "running",
  summary: "Private issue title",
  startedAt: "2026-07-25T00:00:00.000Z",
};

const startedEvent: RunEvent = {
  runId: startedRun.id,
  sequence: 1,
  type: "PreparationStarted",
  occurredAt: startedRun.startedAt,
};

const fakeLedger = (): RunLedgerService => {
  let run = startedRun;
  let events: readonly RunEvent[] = [startedEvent];

  return {
    createPreparationRun: () => Effect.succeed(run),
    createImplementationRun: () => Effect.succeed(run),
    createReviewRun: () => Effect.succeed(run),
    recordImplementationWorkspace: () => Effect.succeed(run),
    recordMergeRequest: () => Effect.succeed(run),
    finishRun: (_runId, input) => {
      const endedAt = "2026-07-25T00:01:00.000Z";
      run = {
        ...run,
        status: input.status,
        endedAt,
        failureKind: input.status === "failed" ? input.failureKind : undefined,
      };
      events = [
        ...events,
        {
          runId: run.id,
          sequence: 2,
          type: input.terminalEvent ?? "PreparationSucceeded",
          occurredAt: endedAt,
        },
      ];
      return Effect.succeed(run);
    },
    writeRunArtifacts: () => Effect.succeed(run),
    getRunLogs: () => Effect.die("unused"),
    getRunArtifact: () => Effect.die("unused"),
    listRuns: () => Effect.succeed([run]),
    getRun: () => Effect.succeed(run),
    getRunEvents: () => Effect.succeed(events),
    pruneRuns: () => Effect.die("unused"),
  };
};

describe("createObservedRunLedger", () => {
  it("projects durable run start and terminal snapshots without changing ledger results", async () => {
    const snapshots: Parameters<ExecutionObserverService["observe"]>[0][] = [];
    const observer: ExecutionObserverService = {
      observe: (snapshot) =>
        Effect.sync(() => {
          snapshots.push(snapshot);
        }),
      reconcile: () => Effect.succeed({ delivered: 0, pending: 0 }),
    };
    const ledger = createObservedRunLedger(fakeLedger(), observer);

    const created = await Effect.runPromise(
      ledger.createPreparationRun({
        issueId: startedRun.issueId,
        summary: startedRun.summary,
      }),
    );
    const finished = await Effect.runPromise(
      ledger.finishRun(created.id, {
        status: "succeeded",
        terminalEvent: "PreparationReady",
      }),
    );

    expect(finished.status).toBe("succeeded");
    expect(snapshots).toEqual([
      {
        schemaVersion: 1,
        runId: startedRun.id,
        issueId: startedRun.issueId,
        lane: "preparation",
        status: "running",
        morpheusState: "agent:preparing",
        eventSequence: 1,
        startedAt: startedRun.startedAt,
        requiredHumanAction: null,
      },
      {
        schemaVersion: 1,
        runId: startedRun.id,
        issueId: startedRun.issueId,
        lane: "preparation",
        status: "succeeded",
        morpheusState: "agent:prepared",
        eventSequence: 2,
        startedAt: startedRun.startedAt,
        endedAt: "2026-07-25T00:01:00.000Z",
        requiredHumanAction: null,
      },
    ]);
  });

  it("fails open when the observer is unavailable and retries pending delivery on list", async () => {
    let observeAttempts = 0;
    let reconcileAttempts = 0;
    const observer: ExecutionObserverService = {
      observe: () => {
        observeAttempts += 1;
        return Effect.fail(
          new ExecutionObserverError({
            operation: "observe",
            message: "dashboard unavailable",
          }),
        );
      },
      reconcile: () => {
        reconcileAttempts += 1;
        return Effect.fail(
          new ExecutionObserverError({
            operation: "reconcile",
            message: "dashboard unavailable",
          }),
        );
      },
    };
    const ledger = createObservedRunLedger(fakeLedger(), observer);

    const created = await Effect.runPromise(
      ledger.createPreparationRun({
        issueId: startedRun.issueId,
        summary: startedRun.summary,
      }),
    );
    const listed = await Effect.runPromise(ledger.listRuns());

    expect(created.id).toBe(startedRun.id);
    expect(listed).toHaveLength(1);
    expect(observeAttempts).toBe(1);
    expect(reconcileAttempts).toBe(1);
  });
});
