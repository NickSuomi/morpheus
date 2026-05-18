import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { SqlClient } from "@effect/sql";
import { SqliteClient } from "@effect/sql-sqlite-node";
import { failureKinds, runnableLanes, type FailureKind, type RunnableLane } from "@morpheus/core";
import {
  RunLedger,
  RunLedgerArtifactNotFoundError,
  RunLedgerInvalidStateError,
  RunLedgerLogsNotFoundError,
  RunLedgerNotFoundError,
  RunLedgerPersistenceError,
  type FinishRunInput,
  type RunEvent,
  type RunLedgerService,
  type RunPruneCandidate,
  type RunPruneInput,
  type RunStatus,
  type RunSummary,
  runStatuses,
} from "@morpheus/runtime";
import { Effect, Layer } from "effect";
import { ulid } from "ulid";

export type SqliteRunLedgerOptions = {
  readonly ledgerPath: string;
  readonly runsDirectory: string;
};

type RunRow = {
  readonly id: string;
  readonly issue_id: string;
  readonly lane: string;
  readonly status: string;
  readonly summary: string;
  readonly started_at: string;
  readonly ended_at: string | null;
  readonly failure_kind: string | null;
  readonly transcript_path: string | null;
  readonly artifact_path: string | null;
  readonly workspace_path: string | null;
  readonly worktree_path: string | null;
  readonly branch: string | null;
  readonly merge_request_ref: string | null;
  readonly merge_request_url: string | null;
  readonly pruned_at: string | null;
  readonly pruned_by: string | null;
  readonly prune_reason: string | null;
  readonly events_pruned_at: string | null;
  readonly artifacts_pruned_at: string | null;
  readonly artifact_bytes_deleted: number | null;
};

type RunEventRow = {
  readonly sequence: number;
  readonly run_id: string;
  readonly type: string;
  readonly occurred_at: string;
  readonly message: string | null;
};

type SequenceRow = {
  readonly sequence: number;
};

type RunStatusRow = {
  readonly status: string;
};

type TableInfoRow = {
  readonly name: string;
};

const maybe = <T>(value: T | null): T | undefined => (value === null ? undefined : value);

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const persistenceError = (operation: string, error: unknown): RunLedgerPersistenceError =>
  new RunLedgerPersistenceError({
    operation,
    message: errorMessage(error),
  });

const mapPersistenceError = <A, E, R>(
  operation: string,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, RunLedgerPersistenceError, R> =>
  effect.pipe(Effect.mapError((error) => persistenceError(operation, error)));

const trySync = <A>(
  operation: string,
  evaluate: () => A,
): Effect.Effect<A, RunLedgerPersistenceError> =>
  Effect.try({
    try: evaluate,
    catch: (error) => persistenceError(operation, error),
  });

const ignoreCleanupFailure = <E, R>(
  effect: Effect.Effect<void, E, R>,
): Effect.Effect<void, never, R> => effect.pipe(Effect.catchAll(() => Effect.void));

const includes = <T extends string>(values: readonly T[], value: string): value is T =>
  values.includes(value as T);

const invalidRowValueError = (
  operation: string,
  row: RunRow,
  column: string,
  value: string,
): RunLedgerPersistenceError =>
  new RunLedgerPersistenceError({
    operation,
    message: `Invalid persisted run row ${row.id} ${column}: ${value}`,
  });

const decodeLane = (
  operation: string,
  row: RunRow,
): Effect.Effect<RunnableLane, RunLedgerPersistenceError> =>
  includes(runnableLanes, row.lane)
    ? Effect.succeed(row.lane)
    : Effect.fail(invalidRowValueError(operation, row, "lane", row.lane));

const decodeRunStatus = (
  operation: string,
  row: RunRow,
): Effect.Effect<RunStatus, RunLedgerPersistenceError> =>
  includes(runStatuses, row.status)
    ? Effect.succeed(row.status)
    : Effect.fail(invalidRowValueError(operation, row, "status", row.status));

const decodeFailureKind = (
  operation: string,
  row: RunRow,
): Effect.Effect<FailureKind | undefined, RunLedgerPersistenceError> => {
  if (row.failure_kind === null) {
    return Effect.succeed(undefined);
  }

  return includes(failureKinds, row.failure_kind)
    ? Effect.succeed(row.failure_kind)
    : Effect.fail(invalidRowValueError(operation, row, "failure_kind", row.failure_kind));
};

const runSummaryFromRow = (
  operation: string,
  row: RunRow,
): Effect.Effect<RunSummary, RunLedgerPersistenceError> =>
  Effect.gen(function* () {
    const lane = yield* decodeLane(operation, row);
    const status = yield* decodeRunStatus(operation, row);
    const failureKind = yield* decodeFailureKind(operation, row);

    return {
      id: row.id,
      issueId: row.issue_id,
      lane,
      status,
      summary: row.summary,
      startedAt: row.started_at,
      endedAt: maybe(row.ended_at),
      failureKind,
      transcriptPath: maybe(row.transcript_path),
      artifactPath: maybe(row.artifact_path),
      workspacePath: maybe(row.workspace_path),
      worktreePath: maybe(row.worktree_path),
      branch: maybe(row.branch),
      mergeRequestRef: maybe(row.merge_request_ref),
      mergeRequestUrl: maybe(row.merge_request_url),
      prunedAt: maybe(row.pruned_at),
      prunedBy: maybe(row.pruned_by),
      pruneReason: maybe(row.prune_reason),
      eventsPrunedAt: maybe(row.events_pruned_at),
      artifactsPrunedAt: maybe(row.artifacts_pruned_at),
      artifactBytesDeleted: row.artifact_bytes_deleted ?? undefined,
    };
  });

const runEventFromRow = (row: RunEventRow): RunEvent => ({
  sequence: row.sequence,
  runId: row.run_id,
  type: row.type,
  occurredAt: row.occurred_at,
  message: maybe(row.message),
});

const createRunId = (): string => `run_${ulid()}`;

const setupSchema = Effect.fn("SqliteRunLedger.setupSchema")(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL,
      lane TEXT NOT NULL,
      status TEXT NOT NULL,
      summary TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      failure_kind TEXT,
      transcript_path TEXT,
      artifact_path TEXT,
      workspace_path TEXT,
      worktree_path TEXT,
      branch TEXT,
      merge_request_ref TEXT,
      merge_request_url TEXT,
      pruned_at TEXT,
      pruned_by TEXT,
      prune_reason TEXT,
      events_pruned_at TEXT,
      artifacts_pruned_at TEXT,
      artifact_bytes_deleted INTEGER
    );
  `);
  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS run_events (
      run_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      type TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      message TEXT,
      PRIMARY KEY (run_id, sequence),
      FOREIGN KEY (run_id) REFERENCES runs(id)
    );
  `);
  const columns = yield* sql<TableInfoRow>`PRAGMA table_info(runs)`;
  const columnNames = new Set(columns.map((column) => column.name));
  if (!columnNames.has("workspace_path")) {
    yield* sql.unsafe(`ALTER TABLE runs ADD COLUMN workspace_path TEXT`);
  }
  if (!columnNames.has("worktree_path")) {
    yield* sql.unsafe(`ALTER TABLE runs ADD COLUMN worktree_path TEXT`);
  }
  if (!columnNames.has("branch")) {
    yield* sql.unsafe(`ALTER TABLE runs ADD COLUMN branch TEXT`);
  }
  if (!columnNames.has("merge_request_ref")) {
    yield* sql.unsafe(`ALTER TABLE runs ADD COLUMN merge_request_ref TEXT`);
  }
  if (!columnNames.has("merge_request_url")) {
    yield* sql.unsafe(`ALTER TABLE runs ADD COLUMN merge_request_url TEXT`);
  }
  if (!columnNames.has("pruned_at")) {
    yield* sql.unsafe(`ALTER TABLE runs ADD COLUMN pruned_at TEXT`);
  }
  if (!columnNames.has("pruned_by")) {
    yield* sql.unsafe(`ALTER TABLE runs ADD COLUMN pruned_by TEXT`);
  }
  if (!columnNames.has("prune_reason")) {
    yield* sql.unsafe(`ALTER TABLE runs ADD COLUMN prune_reason TEXT`);
  }
  if (!columnNames.has("events_pruned_at")) {
    yield* sql.unsafe(`ALTER TABLE runs ADD COLUMN events_pruned_at TEXT`);
  }
  if (!columnNames.has("artifacts_pruned_at")) {
    yield* sql.unsafe(`ALTER TABLE runs ADD COLUMN artifacts_pruned_at TEXT`);
  }
  if (!columnNames.has("artifact_bytes_deleted")) {
    yield* sql.unsafe(`ALTER TABLE runs ADD COLUMN artifact_bytes_deleted INTEGER`);
  }
});

const terminalStatuses = ["succeeded", "failed"] as const;

const isTerminalStatus = (status: RunStatus): boolean =>
  terminalStatuses.includes(status as (typeof terminalStatuses)[number]);

const completedRetentionCutoff = (
  input: RunPruneInput,
  terminalCompletedRuns: readonly RunSummary[],
): Set<string> => {
  const keepLast = Math.max(0, input.policy.completedIntermediate.keepLast);
  const keepDays = Math.max(0, input.policy.completedIntermediate.keepDays);
  const cutoffMs = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  const keptByCount = new Set(
    [...terminalCompletedRuns]
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      .slice(0, keepLast)
      .map((run) => run.id),
  );

  return new Set(
    terminalCompletedRuns
      .filter((run) => !keptByCount.has(run.id))
      .filter((run) => new Date(run.startedAt).getTime() <= cutoffMs)
      .map((run) => run.id),
  );
};

const artifactPathsForRun = (run: RunSummary): readonly string[] =>
  [run.transcriptPath, run.artifactPath].filter((path): path is string => path !== undefined);

const artifactBytesForPaths = (paths: readonly string[]): number =>
  paths.reduce((total, path) => {
    try {
      return total + statSync(path).size;
    } catch {
      return total;
    }
  }, 0);

const toPruneCandidate = (run: RunSummary, reason: string): RunPruneCandidate => {
  const artifactPaths = artifactPathsForRun(run);

  return {
    runId: run.id,
    issueId: run.issueId,
    lane: run.lane,
    status: run.status,
    artifactPaths,
    artifactBytes: artifactBytesForPaths(artifactPaths),
    reason,
  };
};

export const createSqliteRunLedger = ({
  ledgerPath,
  runsDirectory,
}: SqliteRunLedgerOptions): Effect.Effect<
  RunLedgerService,
  RunLedgerPersistenceError,
  SqlClient.SqlClient
> =>
  Effect.gen(function* () {
    yield* trySync("createSqliteRunLedger", () => {
      mkdirSync(dirname(ledgerPath), { recursive: true });
      mkdirSync(runsDirectory, { recursive: true });
    });
    yield* mapPersistenceError("setupSchema", setupSchema());
    const sql = yield* SqlClient.SqlClient;

    const getRun = Effect.fn("SqliteRunLedger.getRun")(function* (runId: string) {
      const rows = yield* mapPersistenceError(
        "getRun",
        sql<RunRow>`SELECT * FROM runs WHERE id = ${runId}`,
      );
      if (rows[0] === undefined) {
        return undefined;
      }
      return yield* runSummaryFromRow("getRun", rows[0]);
    });

    const getRunEvents = Effect.fn("SqliteRunLedger.getRunEvents")(function* (runId: string) {
      const rows = yield* mapPersistenceError(
        "getRunEvents",
        sql<RunEventRow>`
          SELECT * FROM run_events
          WHERE run_id = ${runId}
          ORDER BY sequence ASC
        `,
      );
      return rows.map(runEventFromRow);
    });

    const createRun = Effect.fn("SqliteRunLedger.createRun")(function* (input: {
      readonly issueId: string;
      readonly lane: RunnableLane;
      readonly summary: string;
      readonly eventType: string;
    }) {
      const runId = createRunId();
      const now = new Date().toISOString();
      yield* mapPersistenceError(
        "createRun",
        sql.withTransaction(
          Effect.gen(function* () {
            yield* sql`
              INSERT INTO runs (id, issue_id, lane, status, summary, started_at)
              VALUES (${runId}, ${input.issueId}, ${input.lane}, ${"running"}, ${input.summary}, ${now})
            `;
            yield* sql`
              INSERT INTO run_events (run_id, sequence, type, occurred_at)
              VALUES (${runId}, ${1}, ${input.eventType}, ${now})
            `;
          }),
        ),
      );

      const run = yield* getRun(runId);
      if (run === undefined) {
        return yield* new RunLedgerPersistenceError({
          operation: "createRun",
          message: `Run was not created: ${runId}`,
        });
      }
      return run;
    });

    return {
      createPreparationRun: Effect.fn("SqliteRunLedger.createPreparationRun")(function* (input) {
        return yield* createRun({
          issueId: input.issueId,
          lane: "preparation",
          summary: input.summary,
          eventType: "PreparationStarted",
        });
      }),

      createImplementationRun: Effect.fn("SqliteRunLedger.createImplementationRun")(
        function* (input) {
          return yield* createRun({
            issueId: input.issueId,
            lane: "implementation",
            summary: input.summary,
            eventType: "ImplementationStarted",
          });
        },
      ),

      createReviewRun: Effect.fn("SqliteRunLedger.createReviewRun")(function* (input) {
        return yield* createRun({
          issueId: input.issueId,
          lane: "review",
          summary: input.summary,
          eventType: "StartReview",
        });
      }),

      recordImplementationWorkspace: Effect.fn("SqliteRunLedger.recordImplementationWorkspace")(
        function* (runId, input) {
          const now = new Date().toISOString();
          yield* sql
            .withTransaction(
              Effect.gen(function* () {
                const [runStatusRow] = yield* sql<RunStatusRow>`
                  SELECT status
                  FROM runs
                  WHERE id = ${runId}
                `;

                if (runStatusRow === undefined) {
                  return yield* new RunLedgerNotFoundError({ runId });
                }
                if (runStatusRow.status !== "running") {
                  return yield* new RunLedgerInvalidStateError({
                    runId,
                    status: runStatusRow.status,
                    operation: "recordImplementationWorkspace",
                  });
                }

                const [sequenceRow] = yield* sql<SequenceRow>`
                  SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence
                  FROM run_events
                  WHERE run_id = ${runId}
                `;
                yield* sql`
                  INSERT INTO run_events (run_id, sequence, type, occurred_at, message)
                  VALUES (${runId}, ${sequenceRow?.sequence ?? 1}, ${"ImplementationWorkspacePrepared"}, ${now}, ${input.branch})
                `;
                yield* sql`
                  UPDATE runs
                  SET workspace_path = ${input.workspacePath},
                      worktree_path = ${input.worktreePath ?? null},
                      branch = ${input.branch}
                  WHERE id = ${runId}
                `;
              }),
            )
            .pipe(
              Effect.mapError((error) =>
                error instanceof RunLedgerInvalidStateError ||
                error instanceof RunLedgerNotFoundError
                  ? error
                  : persistenceError("recordImplementationWorkspace", error),
              ),
            );

          const run = yield* getRun(runId);
          if (run === undefined) {
            return yield* new RunLedgerNotFoundError({ runId });
          }
          return run;
        },
      ),

      recordMergeRequest: Effect.fn("SqliteRunLedger.recordMergeRequest")(function* (runId, input) {
        const now = new Date().toISOString();
        yield* sql
          .withTransaction(
            Effect.gen(function* () {
              const [runStatusRow] = yield* sql<RunStatusRow>`
                SELECT status
                FROM runs
                WHERE id = ${runId}
              `;

              if (runStatusRow === undefined) {
                return yield* new RunLedgerNotFoundError({ runId });
              }
              if (runStatusRow.status !== "running") {
                return yield* new RunLedgerInvalidStateError({
                  runId,
                  status: runStatusRow.status,
                  operation: "recordMergeRequest",
                });
              }

              const [sequenceRow] = yield* sql<SequenceRow>`
                SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence
                FROM run_events
                WHERE run_id = ${runId}
              `;
              yield* sql`
                INSERT INTO run_events (run_id, sequence, type, occurred_at, message)
                VALUES (${runId}, ${sequenceRow?.sequence ?? 1}, ${"DraftMergeRequestCreated"}, ${now}, ${input.reference})
              `;
              yield* sql`
                UPDATE runs
                SET merge_request_ref = ${input.reference},
                    merge_request_url = ${input.url ?? null}
                WHERE id = ${runId}
              `;
            }),
          )
          .pipe(
            Effect.mapError((error) =>
              error instanceof RunLedgerInvalidStateError || error instanceof RunLedgerNotFoundError
                ? error
                : persistenceError("recordMergeRequest", error),
            ),
          );

        const run = yield* getRun(runId);
        if (run === undefined) {
          return yield* new RunLedgerNotFoundError({ runId });
        }
        return run;
      }),

      finishRun: Effect.fn("SqliteRunLedger.finishRun")(function* (
        runId: string,
        input: FinishRunInput,
      ) {
        const endedAt = new Date().toISOString();
        const eventType =
          input.terminalEvent ??
          (input.status === "succeeded" ? "PreparationSucceeded" : "PreparationFailed");
        const failureKind = input.status === "failed" ? input.failureKind : null;
        yield* sql
          .withTransaction(
            Effect.gen(function* () {
              const [runStatusRow] = yield* sql<RunStatusRow>`
                SELECT status
                FROM runs
                WHERE id = ${runId}
              `;

              if (runStatusRow === undefined) {
                return yield* new RunLedgerNotFoundError({ runId });
              }

              if (runStatusRow.status !== "running") {
                return yield* new RunLedgerInvalidStateError({
                  runId,
                  status: runStatusRow.status,
                  operation: "finishRun",
                });
              }

              const [sequenceRow] = yield* sql<SequenceRow>`
                SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence
                FROM run_events
                WHERE run_id = ${runId}
              `;
              yield* sql`
                INSERT INTO run_events (run_id, sequence, type, occurred_at, message)
                VALUES (${runId}, ${sequenceRow?.sequence ?? 1}, ${eventType}, ${endedAt}, ${input.message ?? null})
              `;
              yield* sql`
                UPDATE runs
                SET status = ${input.status}, ended_at = ${endedAt}, failure_kind = ${failureKind}
                WHERE id = ${runId} AND status = ${"running"}
              `;
            }),
          )
          .pipe(
            Effect.mapError((error) =>
              error instanceof RunLedgerInvalidStateError || error instanceof RunLedgerNotFoundError
                ? error
                : persistenceError("finishRun", error),
            ),
          );

        const run = yield* getRun(runId);
        if (run === undefined) {
          return yield* new RunLedgerNotFoundError({ runId });
        }
        return run;
      }),

      writeRunArtifacts: Effect.fn("SqliteRunLedger.writeRunArtifacts")(function* (
        runId: string,
        input,
      ) {
        const existingRun = yield* getRun(runId);
        if (existingRun === undefined) {
          return yield* new RunLedgerNotFoundError({ runId });
        }

        const runDirectory = join(runsDirectory, runId);
        const transcriptPath = join(runDirectory, "transcript.txt");
        const artifactPath = join(runDirectory, "artifact.json");
        const runDirectoryExisted = existsSync(runDirectory);
        const transcriptExisted = existsSync(transcriptPath);
        const artifactExisted = existsSync(artifactPath);

        const cleanupCreatedArtifacts = ignoreCleanupFailure(
          trySync("writeRunArtifacts.cleanup", () => {
            if (!transcriptExisted) {
              rmSync(transcriptPath, { force: true });
            }
            if (!artifactExisted) {
              rmSync(artifactPath, { force: true });
            }
            if (!runDirectoryExisted) {
              rmSync(runDirectory, { force: true, recursive: true });
            }
          }),
        );

        yield* trySync("writeRunArtifacts", () => {
          mkdirSync(runDirectory, { recursive: true });
          writeFileSync(transcriptPath, input.transcript);
          writeFileSync(artifactPath, input.artifact);
        });

        const recordArtifacts = mapPersistenceError(
          "writeRunArtifacts",
          sql.withTransaction(
            Effect.gen(function* () {
              const [sequenceRow] = yield* sql<SequenceRow>`
                SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence
                FROM run_events
                WHERE run_id = ${runId}
              `;
              yield* sql`
                INSERT INTO run_events (run_id, sequence, type, occurred_at, message)
                VALUES (${runId}, ${sequenceRow?.sequence ?? 1}, ${"RunArtifactsWritten"}, ${new Date().toISOString()}, ${"Transcript and artifact written."})
              `;
              yield* sql`
                UPDATE runs
                SET transcript_path = ${transcriptPath}, artifact_path = ${artifactPath}
                WHERE id = ${runId}
              `;
            }),
          ),
        );

        yield* recordArtifacts.pipe(
          Effect.catchAll((error) =>
            cleanupCreatedArtifacts.pipe(Effect.zipRight(Effect.fail(error))),
          ),
        );

        const run = yield* getRun(runId);
        if (run === undefined) {
          yield* cleanupCreatedArtifacts;
          return yield* new RunLedgerNotFoundError({ runId });
        }
        return run;
      }),

      getRunLogs: Effect.fn("SqliteRunLedger.getRunLogs")(function* (runId: string) {
        const run = yield* getRun(runId);
        const transcriptPath = run?.transcriptPath;
        if (transcriptPath === undefined) {
          return yield* new RunLedgerLogsNotFoundError({ runId });
        }

        const transcript = yield* trySync("getRunLogs", () => readFileSync(transcriptPath, "utf8"));

        return {
          runId,
          transcriptPath,
          transcript,
        };
      }),

      getRunArtifact: Effect.fn("SqliteRunLedger.getRunArtifact")(function* (runId: string) {
        const run = yield* getRun(runId);
        const artifactPath = run?.artifactPath;
        if (artifactPath === undefined) {
          return yield* new RunLedgerArtifactNotFoundError({ runId });
        }

        const artifact = yield* trySync("getRunArtifact", () => readFileSync(artifactPath, "utf8"));

        return {
          runId,
          artifactPath,
          artifact,
        };
      }),

      listRuns: Effect.fn("SqliteRunLedger.listRuns")(function* () {
        const rows = yield* mapPersistenceError(
          "listRuns",
          sql<RunRow>`
            SELECT * FROM runs
            ORDER BY started_at DESC, id ASC
          `,
        );
        return yield* Effect.forEach(rows, (row) => runSummaryFromRow("listRuns", row));
      }),

      pruneRuns: Effect.fn("SqliteRunLedger.pruneRuns")(function* (input) {
        const runs = yield* Effect.forEach(
          yield* mapPersistenceError(
            "pruneRuns",
            sql<RunRow>`
              SELECT * FROM runs
              ORDER BY started_at DESC, id ASC
            `,
          ),
          (row) => runSummaryFromRow("pruneRuns", row),
        );
        const completedEligibleIds = completedRetentionCutoff(
          input,
          runs.filter(
            (run) =>
              run.status === "succeeded" && run.prunedAt === undefined && run.lane !== "review",
          ),
        );
        const candidates = runs
          .filter((run) => isTerminalStatus(run.status))
          .filter((run) => run.prunedAt === undefined)
          .flatMap((run) => {
            if (run.status === "failed") {
              return [toPruneCandidate(run, input.reason)];
            }
            if (run.lane === "review") {
              return [toPruneCandidate(run, input.reason)];
            }
            if (completedEligibleIds.has(run.id)) {
              return [toPruneCandidate(run, input.reason)];
            }
            return [];
          });

        if (input.apply) {
          for (const candidate of candidates) {
            const now = new Date().toISOString();
            yield* trySync("pruneRuns.deleteArtifacts", () => {
              for (const path of candidate.artifactPaths) {
                rmSync(path, { force: true });
              }
            });
            yield* mapPersistenceError(
              "pruneRuns",
              sql.withTransaction(
                Effect.gen(function* () {
                  yield* sql`
                    DELETE FROM run_events
                    WHERE run_id = ${candidate.runId}
                  `;
                  yield* sql`
                    INSERT INTO run_events (run_id, sequence, type, occurred_at, message)
                    VALUES (${candidate.runId}, ${1}, ${"RunPruned"}, ${now}, ${input.reason})
                  `;
                  yield* sql`
                    UPDATE runs
                    SET pruned_at = ${now},
                        pruned_by = ${input.prunedBy},
                        prune_reason = ${input.reason},
                        events_pruned_at = ${now},
                        artifacts_pruned_at = ${now},
                        artifact_bytes_deleted = ${candidate.artifactBytes},
                        transcript_path = NULL,
                        artifact_path = NULL
                    WHERE id = ${candidate.runId}
                      AND status <> ${"running"}
                      AND pruned_at IS NULL
                  `;
                }),
              ),
            );
          }
        }

        return {
          applied: input.apply,
          eligibleRuns: candidates,
          totalArtifactBytes: candidates.reduce((total, run) => total + run.artifactBytes, 0),
        };
      }),

      getRun,
      getRunEvents,
    };
  });

export const sqliteRunLedgerLayer = (
  options: SqliteRunLedgerOptions,
): Layer.Layer<RunLedger, RunLedgerPersistenceError> =>
  Layer.unwrapEffect(
    trySync("sqliteRunLedgerLayer", () => {
      mkdirSync(dirname(options.ledgerPath), { recursive: true });
      mkdirSync(options.runsDirectory, { recursive: true });
    }).pipe(
      Effect.map(() =>
        Layer.effect(RunLedger, createSqliteRunLedger(options)).pipe(
          Layer.provide(SqliteClient.layer({ filename: options.ledgerPath })),
          Layer.mapError((error) => persistenceError("sqliteRunLedgerLayer", error)),
        ),
      ),
    ),
  );
