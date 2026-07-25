import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteClient } from "@effect/sql-sqlite-node";
import {
  ExecutionObserverError,
  type ExecutionObserverService,
  type ExecutionProjectionSnapshot,
  RunLedger,
} from "@morpheus/runtime";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  createTriggerDevExecutionObserver,
  sqliteRunLedgerLayer,
  triggerDevObservedRunLedgerLayer,
  type TriggerDevObserverClient,
  type TriggerDevRunStatus,
} from "../src/index.js";

const runningSnapshot: ExecutionProjectionSnapshot = {
  schemaVersion: 1,
  runId: "run_private_123",
  issueId: "private-group/private-project#113",
  lane: "implementation",
  status: "running",
  morpheusState: "agent:running",
  eventSequence: 3,
  startedAt: "2026-07-25T00:00:00.000Z",
  requiredHumanAction: null,
};

const terminalSnapshot: ExecutionProjectionSnapshot = {
  ...runningSnapshot,
  status: "failed",
  morpheusState: "agent:failed",
  eventSequence: 4,
  endedAt: "2026-07-25T00:02:00.000Z",
  failureKind: "verification_error",
  requiredHumanAction: "inspect-morpheus-run",
};

type RecordedCall =
  | { readonly operation: "createWaitpoint"; readonly input: unknown }
  | { readonly operation: "triggerObserver"; readonly input: unknown }
  | { readonly operation: "updateRunMetadata"; readonly input: unknown }
  | { readonly operation: "completeWaitpoint"; readonly input: unknown }
  | { readonly operation: "retrieveRun"; readonly input: unknown };

const recordingClient = (
  calls: RecordedCall[],
  options: {
    readonly failCreateWaitpoint?: () => boolean;
    readonly runLookup?: () =>
      | { readonly found: true; readonly status: TriggerDevRunStatus }
      | { readonly found: false };
  } = {},
): TriggerDevObserverClient => ({
  createWaitpoint: (input) => {
    calls.push({ operation: "createWaitpoint", input });
    return options.failCreateWaitpoint?.() === true
      ? Effect.fail(
          new ExecutionObserverError({
            operation: "createWaitpoint",
            message: "Trigger.dev unavailable",
          }),
        )
      : Effect.succeed({ id: "waitpoint_1" });
  },
  triggerObserver: (input) => {
    calls.push({ operation: "triggerObserver", input });
    return Effect.succeed({ id: "trigger_run_1" });
  },
  updateRunMetadata: (runId, metadata) => {
    calls.push({ operation: "updateRunMetadata", input: { runId, metadata } });
    return Effect.void;
  },
  completeWaitpoint: (waitpointId, data) => {
    calls.push({ operation: "completeWaitpoint", input: { waitpointId, data } });
    return Effect.void;
  },
  retrieveRun: (runId) => {
    calls.push({ operation: "retrieveRun", input: { runId } });
    return Effect.succeed(options.runLookup?.() ?? { found: true, status: "FROZEN" });
  },
});

const withObserver = <A>(
  ledgerPath: string,
  client: TriggerDevObserverClient,
  use: (observer: ExecutionObserverService) => Effect.Effect<A, ExecutionObserverError>,
) =>
  Effect.gen(function* () {
    const observer = yield* createTriggerDevExecutionObserver({
      targetIdentity: "private-group/private-project",
      environment: "production",
      taskIdentifier: "morpheus-execution-observer-v1",
      correlationSecret: "test-only-correlation-secret",
      waitpointTimeout: "4w",
      idempotencyKeyTTL: "30d",
      client,
    });
    return yield* use(observer);
  }).pipe(Effect.provide(SqliteClient.layer({ filename: ledgerPath })));

describe("createTriggerDevExecutionObserver", () => {
  it("decorates the production SQLite ledger with the observer outbox", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-trigger-ledger-layer-"));
    const calls: RecordedCall[] = [];
    const run = await Effect.runPromise(
      Effect.gen(function* () {
        const ledger = yield* RunLedger;
        return yield* ledger.createPreparationRun({
          issueId: "private-group/private-project#113",
          summary: "Private issue title",
        });
      }).pipe(
        Effect.provide(
          triggerDevObservedRunLedgerLayer({
            ledgerPath: join(dir, "ledger.sqlite"),
            runsDirectory: join(dir, "runs"),
            targetIdentity: "private-group/private-project",
            environment: "production",
            taskIdentifier: "morpheus-execution-observer-v1",
            correlationSecret: "test-only-correlation-secret",
            waitpointTimeout: "4w",
            idempotencyKeyTTL: "30d",
            client: recordingClient(calls),
          }),
        ),
      ),
    );

    expect(run.status).toBe("running");
    expect(calls.map((call) => call.operation)).toEqual([
      "createWaitpoint",
      "triggerObserver",
      "updateRunMetadata",
    ]);
    expect(JSON.stringify(calls)).not.toContain("private-group");
    expect(JSON.stringify(calls)).not.toContain("Private issue title");
  });

  it("backfills a ledger mutation that crashed before observer enqueue", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-trigger-crash-gap-"));
    const ledgerPath = join(dir, "ledger.sqlite");
    const runsDirectory = join(dir, "runs");
    await Effect.runPromise(
      withObserver(ledgerPath, recordingClient([]), (observer) => observer.reconcile()),
    );
    await new Promise((resolve) => setTimeout(resolve, 2));
    await Effect.runPromise(
      Effect.gen(function* () {
        const ledger = yield* RunLedger;
        yield* ledger.createPreparationRun({
          issueId: "private-group/private-project#113",
          summary: "Crash gap",
        });
      }).pipe(Effect.provide(sqliteRunLedgerLayer({ ledgerPath, runsDirectory }))),
    );

    const calls: RecordedCall[] = [];
    await Effect.runPromise(
      Effect.gen(function* () {
        const ledger = yield* RunLedger;
        yield* ledger.listRuns();
      }).pipe(
        Effect.provide(
          triggerDevObservedRunLedgerLayer({
            ledgerPath,
            runsDirectory,
            targetIdentity: "private-group/private-project",
            environment: "production",
            taskIdentifier: "morpheus-execution-observer-v1",
            correlationSecret: "test-only-correlation-secret",
            waitpointTimeout: "4w",
            idempotencyKeyTTL: "30d",
            client: recordingClient(calls),
          }),
        ),
      ),
    );

    expect(calls.map((call) => call.operation)).toEqual([
      "createWaitpoint",
      "triggerObserver",
      "updateRunMetadata",
    ]);
  });

  it("projects idempotent redacted snapshots and completes the same waitpoint terminally", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-trigger-observer-"));
    const calls: RecordedCall[] = [];
    await Effect.runPromise(
      withObserver(join(dir, "ledger.sqlite"), recordingClient(calls), (observer) =>
        Effect.gen(function* () {
          yield* observer.observe(runningSnapshot);
          yield* observer.observe(runningSnapshot);
          yield* observer.observe(terminalSnapshot);
        }),
      ),
    );

    expect(calls.map((call) => call.operation)).toEqual([
      "createWaitpoint",
      "triggerObserver",
      "updateRunMetadata",
      "retrieveRun",
      "updateRunMetadata",
      "completeWaitpoint",
    ]);
    const serialized = JSON.stringify(calls);
    expect(serialized).not.toContain(runningSnapshot.runId);
    expect(serialized).not.toContain(runningSnapshot.issueId);
    expect(serialized).not.toContain("private-group");
    expect(serialized).not.toContain("private-project");
    expect(serialized).not.toContain("Private issue title");
    expect(serialized).toContain('"authority":"morpheus"');
    expect(serialized).toContain('"projectionKind":"execution-observer"');
    expect(serialized).toContain('"failureKind":"verification_error"');

    const trigger = calls.find((call) => call.operation === "triggerObserver");
    expect(trigger).toEqual({
      operation: "triggerObserver",
      input: expect.objectContaining({
        taskIdentifier: "morpheus-execution-observer-v1",
        idempotencyKeyTTL: "30d",
        tags: expect.arrayContaining([
          "morpheus:projection",
          "schema:v1",
          "lane:implementation",
          "environment:production",
        ]),
      }),
    });
  });

  it("keeps outage work pending and reconciles it after a new observer instance starts", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-trigger-reconcile-"));
    const ledgerPath = join(dir, "ledger.sqlite");
    const failedCalls: RecordedCall[] = [];
    const failed = await Effect.runPromise(
      Effect.either(
        withObserver(
          ledgerPath,
          recordingClient(failedCalls, {
            failCreateWaitpoint: () => true,
          }),
          (observer) => observer.observe(runningSnapshot),
        ),
      ),
    );
    expect(failed._tag).toBe("Left");

    const recoveredCalls: RecordedCall[] = [];
    const reconciled = await Effect.runPromise(
      withObserver(ledgerPath, recordingClient(recoveredCalls), (observer) => observer.reconcile()),
    );

    expect(reconciled).toEqual({ delivered: 1, pending: 0 });
    expect(recoveredCalls.map((call) => call.operation)).toEqual([
      "createWaitpoint",
      "triggerObserver",
      "updateRunMetadata",
    ]);
  });

  it("creates a new projection generation when dashboard cancel stops only the wrapper", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-trigger-cancel-"));
    const calls: RecordedCall[] = [];
    let status: TriggerDevRunStatus = "FROZEN";
    const reconciled = await Effect.runPromise(
      withObserver(
        join(dir, "ledger.sqlite"),
        recordingClient(calls, {
          runLookup: () => ({ found: true, status }),
        }),
        (observer) =>
          Effect.gen(function* () {
            yield* observer.observe(runningSnapshot);
            calls.length = 0;
            status = "CANCELED";
            return yield* observer.reconcile();
          }),
      ),
    );

    expect(reconciled).toEqual({ delivered: 1, pending: 0 });
    expect(calls.map((call) => call.operation)).toEqual([
      "retrieveRun",
      "createWaitpoint",
      "triggerObserver",
      "updateRunMetadata",
    ]);
    expect(JSON.stringify(calls)).toContain('"generation":2');
  });

  it("continues reconciling later rows when one pending row is poisoned", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-trigger-poison-row-"));
    const ledgerPath = join(dir, "ledger.sqlite");
    const secondSnapshot: ExecutionProjectionSnapshot = {
      ...runningSnapshot,
      runId: "run_private_456",
      issueId: "private-group/private-project#114",
    };

    for (const snapshot of [runningSnapshot, secondSnapshot]) {
      await Effect.runPromise(
        Effect.either(
          withObserver(
            ledgerPath,
            recordingClient([], { failCreateWaitpoint: () => true }),
            (observer) => observer.observe(snapshot),
          ),
        ),
      );
    }

    let createAttempts = 0;
    const calls: RecordedCall[] = [];
    const baseClient = recordingClient(calls);
    const client: TriggerDevObserverClient = {
      ...baseClient,
      createWaitpoint: (input) => {
        createAttempts += 1;
        calls.push({ operation: "createWaitpoint", input });
        return createAttempts === 1
          ? Effect.fail(
              new ExecutionObserverError({
                operation: "createWaitpoint",
                message: "permanent row failure",
              }),
            )
          : Effect.succeed({ id: "waitpoint_2" });
      },
    };
    const reconciled = await Effect.runPromise(
      withObserver(ledgerPath, client, (observer) => observer.reconcile()),
    );

    expect(reconciled).toEqual({ delivered: 1, pending: 1 });
    expect(calls.filter((call) => call.operation === "createWaitpoint")).toHaveLength(2);
    expect(calls.map((call) => call.operation)).toContain("updateRunMetadata");
  });

  it("replaces a missing wrapper with a new projection generation", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-trigger-missing-run-"));
    const calls: RecordedCall[] = [];
    let found = true;
    const reconciled = await Effect.runPromise(
      withObserver(
        join(dir, "ledger.sqlite"),
        recordingClient(calls, {
          runLookup: () => (found ? { found: true, status: "FROZEN" } : { found: false }),
        }),
        (observer) =>
          Effect.gen(function* () {
            yield* observer.observe(runningSnapshot);
            calls.length = 0;
            found = false;
            return yield* observer.reconcile();
          }),
      ),
    );

    expect(reconciled).toEqual({ delivered: 1, pending: 0 });
    expect(calls.map((call) => call.operation)).toEqual([
      "retrieveRun",
      "createWaitpoint",
      "triggerObserver",
      "updateRunMetadata",
    ]);
    expect(JSON.stringify(calls)).toContain('"generation":2');
  });

  it("replaces a cancelled wrapper even when Morpheus became terminal before reconciliation", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-trigger-terminal-race-"));
    const calls: RecordedCall[] = [];
    let status: TriggerDevRunStatus = "FROZEN";
    await Effect.runPromise(
      withObserver(
        join(dir, "ledger.sqlite"),
        recordingClient(calls, {
          runLookup: () => ({ found: true, status }),
        }),
        (observer) =>
          Effect.gen(function* () {
            yield* observer.observe(runningSnapshot);
            calls.length = 0;
            status = "CANCELED";
            yield* observer.observe(terminalSnapshot);
          }),
      ),
    );

    expect(calls.map((call) => call.operation)).toEqual([
      "retrieveRun",
      "createWaitpoint",
      "triggerObserver",
      "updateRunMetadata",
      "completeWaitpoint",
    ]);
    expect(JSON.stringify(calls)).toContain('"generation":2');
  });

  it("serializes concurrent metadata writes and preserves the newest event sequence", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-trigger-serialized-"));
    const calls: RecordedCall[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const baseClient = recordingClient(calls);
    const client: TriggerDevObserverClient = {
      ...baseClient,
      updateRunMetadata: (runId, metadata) =>
        Effect.gen(function* () {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          calls.push({ operation: "updateRunMetadata", input: { runId, metadata } });
          yield* Effect.sleep("5 millis");
          inFlight -= 1;
        }),
    };

    await Effect.runPromise(
      withObserver(join(dir, "ledger.sqlite"), client, (observer) =>
        Effect.gen(function* () {
          yield* observer.observe(runningSnapshot);
          calls.length = 0;
          yield* Effect.all(
            [
              observer.observe({ ...runningSnapshot, eventSequence: 4 }),
              observer.observe({ ...runningSnapshot, eventSequence: 5 }),
            ],
            { concurrency: "unbounded" },
          );
        }),
      ),
    );

    const metadataCalls = calls.filter((call) => call.operation === "updateRunMetadata");
    expect(maxInFlight).toBe(1);
    expect(JSON.stringify(metadataCalls.at(-1))).toContain('"eventSequence":5');
  });
});
