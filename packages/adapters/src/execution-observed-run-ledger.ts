import {
  executionProjectionSnapshotFromRun,
  type ExecutionObserverService,
  type RunLedgerService,
  type RunSummary,
} from "@morpheus/runtime";
import { Effect } from "effect";

const observerWarning = (error: {
  readonly operation: string;
  readonly message: string;
}): Effect.Effect<void> =>
  Effect.logWarning(`Morpheus execution dashboard degraded: ${error.operation}: ${error.message}`);

const observeRun = (
  ledger: RunLedgerService,
  observer: ExecutionObserverService,
  run: RunSummary,
): Effect.Effect<RunSummary> =>
  ledger.getRunEvents(run.id).pipe(
    Effect.flatMap((events) => observer.observe(executionProjectionSnapshotFromRun(run, events))),
    Effect.catchAll(observerWarning),
    Effect.as(run),
  );

export const createObservedRunLedger = (
  ledger: RunLedgerService,
  observer: ExecutionObserverService,
): RunLedgerService => ({
  createPreparationRun: (input) =>
    ledger
      .createPreparationRun(input)
      .pipe(Effect.flatMap((run) => observeRun(ledger, observer, run))),
  createImplementationRun: (input) =>
    ledger
      .createImplementationRun(input)
      .pipe(Effect.flatMap((run) => observeRun(ledger, observer, run))),
  createReviewRun: (input) =>
    ledger.createReviewRun(input).pipe(Effect.flatMap((run) => observeRun(ledger, observer, run))),
  recordImplementationWorkspace: (runId, input) =>
    ledger
      .recordImplementationWorkspace(runId, input)
      .pipe(Effect.flatMap((run) => observeRun(ledger, observer, run))),
  recordMergeRequest: (runId, input) =>
    ledger
      .recordMergeRequest(runId, input)
      .pipe(Effect.flatMap((run) => observeRun(ledger, observer, run))),
  finishRun: (runId, input) =>
    ledger.finishRun(runId, input).pipe(Effect.flatMap((run) => observeRun(ledger, observer, run))),
  writeRunArtifacts: (runId, input) =>
    ledger
      .writeRunArtifacts(runId, input)
      .pipe(Effect.flatMap((run) => observeRun(ledger, observer, run))),
  getRunLogs: (runId) => ledger.getRunLogs(runId),
  getRunArtifact: (runId) => ledger.getRunArtifact(runId),
  listRuns: () =>
    Effect.gen(function* () {
      const runs = yield* ledger.listRuns();
      const snapshots = yield* Effect.forEach(
        runs,
        (run) =>
          ledger.getRunEvents(run.id).pipe(
            Effect.map((events) => executionProjectionSnapshotFromRun(run, events)),
            Effect.catchAll((error) => observerWarning(error).pipe(Effect.as(undefined))),
          ),
        { concurrency: 1 },
      );
      yield* observer
        .reconcile(
          snapshots.filter(
            (snapshot): snapshot is NonNullable<typeof snapshot> => snapshot !== undefined,
          ),
        )
        .pipe(Effect.catchAll(observerWarning));
      return runs;
    }),
  getRun: (runId) => ledger.getRun(runId),
  getRunEvents: (runId) => ledger.getRunEvents(runId),
  pruneRuns: (input) => ledger.pruneRuns(input),
});
