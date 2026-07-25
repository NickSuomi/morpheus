import { createHmac } from "node:crypto";
import { SqlClient } from "@effect/sql";
import {
  ExecutionObserverError,
  type ExecutionObserverService,
  type ExecutionProjectionSnapshot,
} from "@morpheus/runtime";
import { Effect } from "effect";

export type TriggerDevRunStatus =
  | "PENDING_VERSION"
  | "DELAYED"
  | "QUEUED"
  | "EXECUTING"
  | "REATTEMPTING"
  | "FROZEN"
  | "COMPLETED"
  | "CANCELED"
  | "FAILED"
  | "CRASHED"
  | "SYSTEM_FAILURE"
  | "INTERRUPTED";

export type TriggerDevObserverClient = {
  readonly createWaitpoint: (input: {
    readonly idempotencyKey: string;
    readonly idempotencyKeyTTL: string;
    readonly timeout: string;
    readonly tags: readonly string[];
  }) => Effect.Effect<{ readonly id: string }, ExecutionObserverError>;
  readonly triggerObserver: (input: {
    readonly taskIdentifier: string;
    readonly idempotencyKey: string;
    readonly idempotencyKeyTTL: string;
    readonly tags: readonly string[];
    readonly payload: {
      readonly waitpointId: string;
      readonly projection: TriggerDevProjection;
    };
  }) => Effect.Effect<{ readonly id: string }, ExecutionObserverError>;
  readonly updateRunMetadata: (
    runId: string,
    metadata: TriggerDevProjection,
  ) => Effect.Effect<void, ExecutionObserverError>;
  readonly completeWaitpoint: (
    waitpointId: string,
    data: {
      readonly projection: TriggerDevProjection;
    },
  ) => Effect.Effect<void, ExecutionObserverError>;
  readonly retrieveRun: (
    runId: string,
  ) => Effect.Effect<{ readonly status: TriggerDevRunStatus }, ExecutionObserverError>;
};

export type TriggerDevProjection = Omit<ExecutionProjectionSnapshot, "runId" | "issueId"> & {
  readonly authority: "morpheus";
  readonly projectionKind: "execution-observer";
  readonly targetId: string;
  readonly issueId: string;
  readonly runId: string;
  readonly generation: number;
};

export type TriggerDevExecutionObserverOptions = {
  readonly targetIdentity: string;
  readonly environment: "development" | "staging" | "production" | "preview";
  readonly taskIdentifier: string;
  readonly correlationSecret: string;
  readonly waitpointTimeout: string;
  readonly idempotencyKeyTTL: string;
  readonly client: TriggerDevObserverClient;
};

type ProjectionRow = {
  readonly run_id: string;
  readonly generation: number;
  readonly snapshot_json: string;
  readonly event_sequence: number;
  readonly is_terminal: number;
  readonly trigger_run_id: string | null;
  readonly waitpoint_id: string | null;
  readonly delivered_sequence: number;
  readonly terminal_delivered: number;
  readonly last_error: string | null;
  readonly updated_at: string;
};

type CountRow = {
  readonly count: number;
};

type SettingsRow = {
  readonly enabled_at: string;
};

const setupProjectionSchema = Effect.fn("TriggerDevExecutionObserver.setupSchema")(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS execution_projection_outbox (
      run_id TEXT PRIMARY KEY,
      generation INTEGER NOT NULL,
      snapshot_json TEXT NOT NULL,
      event_sequence INTEGER NOT NULL,
      is_terminal INTEGER NOT NULL,
      trigger_run_id TEXT,
      waitpoint_id TEXT,
      delivered_sequence INTEGER NOT NULL DEFAULT 0,
      terminal_delivered INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      updated_at TEXT NOT NULL
    );
  `);
  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS execution_projection_settings (
      singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
      enabled_at TEXT NOT NULL
    );
  `);
  yield* sql`
    INSERT OR IGNORE INTO execution_projection_settings (singleton, enabled_at)
    VALUES (${1}, ${new Date().toISOString()})
  `;
});

const observerError = (operation: string, message: string): ExecutionObserverError =>
  new ExecutionObserverError({ operation, message });

const mapSqlError = <A, E, R>(
  operation: string,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, ExecutionObserverError, R> =>
  effect.pipe(
    Effect.mapError(() =>
      observerError(operation, "Local execution projection outbox is unavailable."),
    ),
  );

const parseSnapshot = (
  row: ProjectionRow,
): Effect.Effect<ExecutionProjectionSnapshot, ExecutionObserverError> =>
  Effect.try({
    try: () => JSON.parse(row.snapshot_json) as ExecutionProjectionSnapshot,
    catch: () => observerError("readOutbox", "Stored execution projection is invalid."),
  });

const terminalRunStatuses = new Set<TriggerDevRunStatus>([
  "COMPLETED",
  "CANCELED",
  "FAILED",
  "CRASHED",
  "SYSTEM_FAILURE",
  "INTERRUPTED",
]);

const isTerminalSnapshot = (snapshot: ExecutionProjectionSnapshot): boolean =>
  snapshot.status !== "running";

const hmacId = (
  secret: string,
  targetIdentity: string,
  kind: "target" | "issue" | "run",
  value: string,
): string =>
  `${kind}_${createHmac("sha256", secret)
    .update(`${kind}\0${targetIdentity}\0${value}`)
    .digest("hex")
    .slice(0, 32)}`;

const projectionFor = (
  options: TriggerDevExecutionObserverOptions,
  snapshot: ExecutionProjectionSnapshot,
  generation: number,
): TriggerDevProjection => ({
  ...snapshot,
  authority: "morpheus",
  projectionKind: "execution-observer",
  targetId: hmacId(
    options.correlationSecret,
    options.targetIdentity,
    "target",
    options.targetIdentity,
  ),
  issueId: hmacId(options.correlationSecret, options.targetIdentity, "issue", snapshot.issueId),
  runId: hmacId(options.correlationSecret, options.targetIdentity, "run", snapshot.runId),
  generation,
});

const tagsFor = (
  options: TriggerDevExecutionObserverOptions,
  projection: TriggerDevProjection,
): readonly string[] => [
  "morpheus:projection",
  "schema:v1",
  `environment:${options.environment}`,
  `lane:${projection.lane}`,
  `target:${projection.targetId}`,
  `issue:${projection.issueId}`,
  `run:${projection.runId}`,
  `generation:${projection.generation}`,
];

const idempotencyKeyFor = (
  projection: TriggerDevProjection,
  surface: "run" | "waitpoint",
): string => `morpheus:${projection.runId}:g${projection.generation}:${surface}`;

export const createTriggerDevExecutionObserver = (
  options: TriggerDevExecutionObserverOptions,
): Effect.Effect<ExecutionObserverService, ExecutionObserverError, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    yield* mapSqlError("setupOutbox", setupProjectionSchema());
    const sql = yield* SqlClient.SqlClient;
    const [settings] = yield* mapSqlError(
      "readProjectionSettings",
      sql<SettingsRow>`
        SELECT enabled_at
        FROM execution_projection_settings
        WHERE singleton = ${1}
      `,
    );
    if (settings === undefined) {
      return yield* observerError(
        "readProjectionSettings",
        "Execution projection settings are unavailable.",
      );
    }

    const getRow = Effect.fn("TriggerDevExecutionObserver.getRow")(function* (runId: string) {
      const rows = yield* mapSqlError(
        "readOutbox",
        sql<ProjectionRow>`
          SELECT *
          FROM execution_projection_outbox
          WHERE run_id = ${runId}
        `,
      );
      return rows[0];
    });

    const persistExternalId = Effect.fn("TriggerDevExecutionObserver.persistExternalId")(function* (
      runId: string,
      field: "trigger_run_id" | "waitpoint_id",
      value: string,
    ) {
      yield* mapSqlError(
        "updateOutbox",
        field === "trigger_run_id"
          ? sql`
                UPDATE execution_projection_outbox
                SET trigger_run_id = ${value}, last_error = NULL, updated_at = ${new Date().toISOString()}
                WHERE run_id = ${runId}
              `
          : sql`
                UPDATE execution_projection_outbox
                SET waitpoint_id = ${value}, last_error = NULL, updated_at = ${new Date().toISOString()}
                WHERE run_id = ${runId}
              `,
      );
    });

    const markError = Effect.fn("TriggerDevExecutionObserver.markError")(function* (
      runId: string,
      error: ExecutionObserverError,
    ) {
      yield* mapSqlError(
        "updateOutbox",
        sql`
          UPDATE execution_projection_outbox
          SET last_error = ${`${error.operation}: ${error.message}`},
              updated_at = ${new Date().toISOString()}
          WHERE run_id = ${runId}
        `,
      ).pipe(Effect.catchAll(() => Effect.void));
    });

    const resetGeneration = Effect.fn("TriggerDevExecutionObserver.resetGeneration")(function* (
      row: ProjectionRow,
    ) {
      yield* mapSqlError(
        "resetProjectionGeneration",
        sql`
            UPDATE execution_projection_outbox
            SET generation = ${row.generation + 1},
                trigger_run_id = NULL,
                waitpoint_id = NULL,
                delivered_sequence = 0,
                terminal_delivered = 0,
                last_error = NULL,
                updated_at = ${new Date().toISOString()}
            WHERE run_id = ${row.run_id}
          `,
      );
      const reset = yield* getRow(row.run_id);
      if (reset === undefined) {
        return yield* observerError(
          "resetProjectionGeneration",
          "Execution projection disappeared from the outbox.",
        );
      }
      return reset;
    });

    const deliver = Effect.fn("TriggerDevExecutionObserver.deliver")(function* (
      inputRow: ProjectionRow,
      inspectActive: boolean,
    ) {
      let row = inputRow;
      const snapshot = yield* parseSnapshot(row);
      let changed = false;

      if (
        inspectActive &&
        row.is_terminal === 0 &&
        row.trigger_run_id !== null &&
        row.delivered_sequence >= row.event_sequence
      ) {
        const remote = yield* options.client.retrieveRun(row.trigger_run_id);
        if (terminalRunStatuses.has(remote.status)) {
          row = yield* resetGeneration(row);
          changed = true;
        } else {
          return changed;
        }
      }

      const projection = projectionFor(options, snapshot, row.generation);
      const tags = tagsFor(options, projection);
      let waitpointId = row.waitpoint_id;
      if (waitpointId === null) {
        const waitpoint = yield* options.client.createWaitpoint({
          idempotencyKey: idempotencyKeyFor(projection, "waitpoint"),
          idempotencyKeyTTL: options.idempotencyKeyTTL,
          timeout: options.waitpointTimeout,
          tags,
        });
        waitpointId = waitpoint.id;
        yield* persistExternalId(row.run_id, "waitpoint_id", waitpointId);
        changed = true;
      }

      let triggerRunId = row.trigger_run_id;
      if (triggerRunId === null) {
        const triggerRun = yield* options.client.triggerObserver({
          taskIdentifier: options.taskIdentifier,
          idempotencyKey: idempotencyKeyFor(projection, "run"),
          idempotencyKeyTTL: options.idempotencyKeyTTL,
          tags,
          payload: {
            waitpointId,
            projection,
          },
        });
        triggerRunId = triggerRun.id;
        yield* persistExternalId(row.run_id, "trigger_run_id", triggerRunId);
        changed = true;
      }

      if (row.delivered_sequence < row.event_sequence) {
        yield* options.client.updateRunMetadata(triggerRunId, projection);
        yield* mapSqlError(
          "updateOutbox",
          sql`
            UPDATE execution_projection_outbox
            SET delivered_sequence = ${row.event_sequence},
                last_error = NULL,
                updated_at = ${new Date().toISOString()}
            WHERE run_id = ${row.run_id}
          `,
        );
        changed = true;
      }

      if (row.is_terminal === 1 && row.terminal_delivered === 0) {
        yield* options.client.completeWaitpoint(waitpointId, { projection });
        yield* mapSqlError(
          "updateOutbox",
          sql`
            UPDATE execution_projection_outbox
            SET terminal_delivered = 1,
                last_error = NULL,
                updated_at = ${new Date().toISOString()}
            WHERE run_id = ${row.run_id}
          `,
        );
        changed = true;
      }

      return changed;
    });

    const deliverWithPersistedError = (
      row: ProjectionRow,
      inspectActive: boolean,
    ): Effect.Effect<boolean, ExecutionObserverError> =>
      deliver(row, inspectActive).pipe(
        Effect.catchAll((error) =>
          markError(row.run_id, error).pipe(Effect.zipRight(Effect.fail(error))),
        ),
      );

    const enqueue = Effect.fn("TriggerDevExecutionObserver.enqueue")(function* (
      snapshot: ExecutionProjectionSnapshot,
    ) {
      const now = new Date().toISOString();
      yield* mapSqlError(
        "enqueueProjection",
        sql`
          INSERT INTO execution_projection_outbox (
            run_id,
            generation,
            snapshot_json,
            event_sequence,
            is_terminal,
            updated_at
          )
          VALUES (
            ${snapshot.runId},
            ${1},
            ${JSON.stringify(snapshot)},
            ${snapshot.eventSequence},
            ${isTerminalSnapshot(snapshot) ? 1 : 0},
            ${now}
          )
          ON CONFLICT(run_id) DO UPDATE SET
            snapshot_json = excluded.snapshot_json,
            event_sequence = excluded.event_sequence,
            is_terminal = excluded.is_terminal,
            updated_at = excluded.updated_at
          WHERE excluded.event_sequence >= execution_projection_outbox.event_sequence
        `,
      );
      const row = yield* getRow(snapshot.runId);
      if (row === undefined) {
        return yield* observerError(
          "enqueueProjection",
          "Execution projection was not written to the outbox.",
        );
      }
      return row;
    });

    return {
      observe: (snapshot) =>
        Effect.gen(function* () {
          const row = yield* enqueue(snapshot);
          yield* deliverWithPersistedError(row, false);
        }),
      reconcile: (snapshots = []) =>
        Effect.gen(function* () {
          for (const snapshot of snapshots) {
            const existing = yield* getRow(snapshot.runId);
            if (existing !== undefined || snapshot.startedAt >= settings.enabled_at) {
              yield* enqueue(snapshot);
            }
          }
          const rows = yield* mapSqlError(
            "reconcileOutbox",
            sql<ProjectionRow>`
              SELECT *
              FROM execution_projection_outbox
              WHERE is_terminal = 0
                 OR delivered_sequence < event_sequence
                 OR terminal_delivered = 0
              ORDER BY updated_at ASC, run_id ASC
            `,
          );
          let delivered = 0;
          for (const row of rows) {
            if (yield* deliverWithPersistedError(row, true)) {
              delivered += 1;
            }
          }
          const [count] = yield* mapSqlError(
            "countPendingOutbox",
            sql<CountRow>`
              SELECT COUNT(*) AS count
              FROM execution_projection_outbox
              WHERE delivered_sequence < event_sequence
                 OR (is_terminal = 1 AND terminal_delivered = 0)
            `,
          );
          return {
            delivered,
            pending: count?.count ?? 0,
          };
        }),
    };
  });
