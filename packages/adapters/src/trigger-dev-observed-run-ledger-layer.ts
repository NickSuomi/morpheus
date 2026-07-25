import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SqliteClient } from "@effect/sql-sqlite-node";
import { RunLedger, RunLedgerPersistenceError } from "@morpheus/runtime";
import { Effect, Layer } from "effect";
import { createObservedRunLedger } from "./execution-observed-run-ledger.js";
import { createSqliteRunLedger } from "./sqlite-ledger/index.js";
import {
  createTriggerDevExecutionObserver,
  type TriggerDevExecutionObserverOptions,
} from "./trigger-dev-execution-observer.js";

export type TriggerDevObservedRunLedgerLayerOptions = TriggerDevExecutionObserverOptions & {
  readonly ledgerPath: string;
  readonly runsDirectory: string;
};

const persistenceError = (operation: string, message: string): RunLedgerPersistenceError =>
  new RunLedgerPersistenceError({ operation, message });

export const triggerDevObservedRunLedgerLayer = (
  options: TriggerDevObservedRunLedgerLayerOptions,
): Layer.Layer<RunLedger, RunLedgerPersistenceError> =>
  Layer.unwrapEffect(
    Effect.try({
      try: () => {
        mkdirSync(dirname(options.ledgerPath), { recursive: true });
        mkdirSync(options.runsDirectory, { recursive: true });
      },
      catch: () =>
        persistenceError(
          "triggerDevObservedRunLedgerLayer",
          "Unable to initialize local run storage.",
        ),
    }).pipe(
      Effect.map(() => {
        const sqliteLayer = SqliteClient.layer({ filename: options.ledgerPath });
        return Layer.effect(
          RunLedger,
          Effect.gen(function* () {
            const ledger = yield* createSqliteRunLedger({
              ledgerPath: options.ledgerPath,
              runsDirectory: options.runsDirectory,
            });
            const observer = yield* createTriggerDevExecutionObserver(options);
            return createObservedRunLedger(ledger, observer);
          }).pipe(
            Effect.mapError((error) =>
              error._tag === "RunLedgerPersistenceError"
                ? error
                : persistenceError(
                    "triggerDevObservedRunLedgerLayer",
                    "Unable to initialize the local execution projection outbox.",
                  ),
            ),
          ),
        ).pipe(
          Layer.provide(sqliteLayer),
          Layer.mapError((error) =>
            error._tag === "RunLedgerPersistenceError"
              ? error
              : persistenceError(
                  "triggerDevObservedRunLedgerLayer",
                  "Unable to initialize local run storage.",
                ),
          ),
        );
      }),
    ),
  );
