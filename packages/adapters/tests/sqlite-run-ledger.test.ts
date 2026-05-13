import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqlClient } from "@effect/sql";
import { SqliteClient } from "@effect/sql-sqlite-node";
import { describe, expect, it } from "vitest";
import { Effect, Layer } from "effect";
import { RunLedger } from "@morpheus/runtime";
import { createSqliteRunLedger, sqliteRunLedgerLayer } from "../src/sqlite-ledger/index.js";

const withTempDir = async (fn: (dir: string) => Promise<void>) => {
  const dir = mkdtempSync(join(tmpdir(), "morpheus-ledger-"));
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
};

const runWithLedger = <A>(dir: string, program: Effect.Effect<A, unknown, RunLedger>) =>
  Effect.runPromise(
    program.pipe(
      Effect.provide(
        sqliteRunLedgerLayer({
          ledgerPath: join(dir, "ledger.sqlite"),
          runsDirectory: join(dir, ".morpheus", "runs"),
        }),
      ),
    ),
  );

const runWithLedgerAndSql = <A>(
  dir: string,
  program: Effect.Effect<A, unknown, RunLedger | SqlClient.SqlClient>,
) => {
  const sqliteLayer = SqliteClient.layer({ filename: join(dir, "ledger.sqlite") });
  const ledgerLayer = Layer.effect(
    RunLedger,
    createSqliteRunLedger({
      ledgerPath: join(dir, "ledger.sqlite"),
      runsDirectory: join(dir, ".morpheus", "runs"),
    }),
  ).pipe(Layer.provide(sqliteLayer));

  return Effect.runPromise(program.pipe(Effect.provide(Layer.merge(ledgerLayer, sqliteLayer))));
};

describe("SqliteRunLedger", () => {
  it("creates a fake preparation run with an ordered start event", async () => {
    await withTempDir(async (dir) => {
      const { events, run, stored } = await runWithLedger(
        dir,
        Effect.gen(function* () {
          const ledger = yield* RunLedger;
          const run = yield* ledger.createPreparationRun({
            issueId: "morph-7o3",
            summary: "Record fake preparation run in RunLedger",
          });
          return {
            run,
            stored: yield* ledger.getRun(run.id),
            events: yield* ledger.getRunEvents(run.id),
          };
        }),
      );

      expect(run.id).toMatch(/^run_[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(run).toMatchObject({
        issueId: "morph-7o3",
        lane: "preparation",
        status: "running",
        summary: "Record fake preparation run in RunLedger",
      });

      expect(stored).toMatchObject(run);
      expect(events).toMatchObject([
        {
          sequence: 1,
          runId: run.id,
          type: "PreparationStarted",
        },
      ]);
    });
  });

  it("records terminal result events and updates the summary", async () => {
    await withTempDir(async (dir) => {
      const { events, run } = await runWithLedger(
        dir,
        Effect.gen(function* () {
          const ledger = yield* RunLedger;
          const run = yield* ledger.createPreparationRun({
            issueId: "morph-7o3",
            summary: "Record fake preparation run in RunLedger",
          });
          const updated = yield* ledger.finishRun(run.id, {
            status: "failed",
            failureKind: "agent_contract_error",
            message: "Fake preparation could not produce a valid contract.",
          });
          return {
            run: updated,
            events: yield* ledger.getRunEvents(run.id),
          };
        }),
      );

      expect(run).toMatchObject({
        id: run.id,
        status: "failed",
        failureKind: "agent_contract_error",
      });
      expect(events).toMatchObject([
        {
          sequence: 1,
          type: "PreparationStarted",
        },
        {
          sequence: 2,
          type: "PreparationFailed",
          message: "Fake preparation could not produce a valid contract.",
        },
      ]);
    });
  });

  it("rejects finishing a missing run without appending events", async () => {
    await withTempDir(async (dir) => {
      const missingRunId = "run_01HX0000000000000000000000";

      const { events, result } = await runWithLedger(
        dir,
        Effect.gen(function* () {
          const ledger = yield* RunLedger;
          const result = yield* ledger
            .finishRun(missingRunId, {
              status: "succeeded",
              message: "Should not be recorded.",
            })
            .pipe(Effect.either);

          return {
            result,
            events: yield* ledger.getRunEvents(missingRunId),
          };
        }),
      );

      expect(result).toMatchObject({
        _tag: "Left",
        left: {
          _tag: "RunLedgerNotFoundError",
          runId: missingRunId,
        },
      });
      expect(events).toEqual([]);
    });
  });

  it("rejects double-finish on a succeeded run without changing summary or event history", async () => {
    await withTempDir(async (dir) => {
      const { afterInvalidFinish, events, firstFinish, result } = await runWithLedger(
        dir,
        Effect.gen(function* () {
          const ledger = yield* RunLedger;
          const run = yield* ledger.createPreparationRun({
            issueId: "morph-7o3",
            summary: "Record fake preparation run in RunLedger",
          });
          const firstFinish = yield* ledger.finishRun(run.id, {
            status: "succeeded",
            message: "Fake preparation produced a valid contract.",
          });
          const result = yield* ledger
            .finishRun(run.id, {
              status: "failed",
              failureKind: "runtime_error",
              message: "Should not be recorded.",
            })
            .pipe(Effect.either);

          return {
            firstFinish,
            afterInvalidFinish: yield* ledger.getRun(run.id),
            events: yield* ledger.getRunEvents(run.id),
            result,
          };
        }),
      );

      expect(result).toMatchObject({
        _tag: "Left",
        left: {
          _tag: "RunLedgerInvalidStateError",
          status: "succeeded",
          operation: "finishRun",
        },
      });
      expect(afterInvalidFinish).toEqual(firstFinish);
      expect(events).toMatchObject([
        {
          sequence: 1,
          type: "PreparationStarted",
        },
        {
          sequence: 2,
          type: "PreparationSucceeded",
          message: "Fake preparation produced a valid contract.",
        },
      ]);
    });
  });

  it("rejects double-finish on a failed run without changing summary or event history", async () => {
    await withTempDir(async (dir) => {
      const { afterInvalidFinish, events, firstFinish, result } = await runWithLedger(
        dir,
        Effect.gen(function* () {
          const ledger = yield* RunLedger;
          const run = yield* ledger.createPreparationRun({
            issueId: "morph-7o3",
            summary: "Record fake preparation run in RunLedger",
          });
          const firstFinish = yield* ledger.finishRun(run.id, {
            status: "failed",
            failureKind: "agent_contract_error",
            message: "Fake preparation could not produce a valid contract.",
          });
          const result = yield* ledger
            .finishRun(run.id, {
              status: "succeeded",
              message: "Should not be recorded.",
            })
            .pipe(Effect.either);

          return {
            firstFinish,
            afterInvalidFinish: yield* ledger.getRun(run.id),
            events: yield* ledger.getRunEvents(run.id),
            result,
          };
        }),
      );

      expect(result).toMatchObject({
        _tag: "Left",
        left: {
          _tag: "RunLedgerInvalidStateError",
          status: "failed",
          operation: "finishRun",
        },
      });
      expect(afterInvalidFinish).toEqual(firstFinish);
      expect(events).toMatchObject([
        {
          sequence: 1,
          type: "PreparationStarted",
        },
        {
          sequence: 2,
          type: "PreparationFailed",
          message: "Fake preparation could not produce a valid contract.",
        },
      ]);
    });
  });

  it("writes transcript and artifact refs under the configured run directory", async () => {
    await withTempDir(async (dir) => {
      const { events, logs, run, updated } = await runWithLedger(
        dir,
        Effect.gen(function* () {
          const ledger = yield* RunLedger;
          const run = yield* ledger.createPreparationRun({
            issueId: "morph-7o3",
            summary: "Record fake preparation run in RunLedger",
          });
          const updated = yield* ledger.writeRunArtifacts(run.id, {
            transcript: "fake preparation transcript",
            artifact: JSON.stringify({ result: "blocked" }),
          });
          return {
            run,
            updated,
            logs: yield* ledger.getRunLogs(run.id),
            events: yield* ledger.getRunEvents(run.id),
          };
        }),
      );

      expect(updated?.transcriptPath).toBe(
        join(dir, ".morpheus", "runs", run.id, "transcript.txt"),
      );
      expect(updated?.artifactPath).toBe(join(dir, ".morpheus", "runs", run.id, "artifact.json"));
      expect(existsSync(updated?.transcriptPath ?? "")).toBe(true);
      expect(existsSync(updated?.artifactPath ?? "")).toBe(true);
      expect(logs).toEqual({
        runId: run.id,
        transcriptPath: updated?.transcriptPath,
        transcript: "fake preparation transcript",
      });
      expect(events).toMatchObject([
        {
          sequence: 1,
          type: "PreparationStarted",
        },
        {
          sequence: 2,
          type: "RunArtifactsWritten",
          message: "Transcript and artifact written.",
        },
      ]);
    });
  });

  it("rejects missing-run artifact writes without creating run artifacts", async () => {
    await withTempDir(async (dir) => {
      const missingRunId = "run_01HX0000000000000000000000";
      const missingRunDirectory = join(dir, ".morpheus", "runs", missingRunId);

      const result = await runWithLedger(
        dir,
        Effect.gen(function* () {
          const ledger = yield* RunLedger;
          yield* ledger.writeRunArtifacts(missingRunId, {
            transcript: "orphan transcript",
            artifact: JSON.stringify({ orphan: true }),
          });
        }).pipe(Effect.either),
      );

      expect(result).toMatchObject({
        _tag: "Left",
        left: {
          _tag: "RunLedgerNotFoundError",
          runId: missingRunId,
        },
      });

      expect(existsSync(missingRunDirectory)).toBe(false);
      expect(existsSync(join(missingRunDirectory, "transcript.txt"))).toBe(false);
      expect(existsSync(join(missingRunDirectory, "artifact.json"))).toBe(false);
    });
  });

  it("cleans newly written artifacts when recording artifact paths fails", async () => {
    await withTempDir(async (dir) => {
      const result = await runWithLedgerAndSql(
        dir,
        Effect.gen(function* () {
          const ledger = yield* RunLedger;
          const sql = yield* SqlClient.SqlClient;
          const run = yield* ledger.createPreparationRun({
            issueId: "morph-7o3",
            summary: "Record fake preparation run in RunLedger",
          });

          yield* sql.unsafe(`
            CREATE TRIGGER fail_artifact_path_update
            BEFORE UPDATE OF transcript_path ON runs
            BEGIN
              SELECT RAISE(FAIL, 'forced artifact path update failure');
            END;
          `);

          const writeResult = yield* ledger
            .writeRunArtifacts(run.id, {
              transcript: "transcript that should be removed",
              artifact: JSON.stringify({ cleanup: true }),
            })
            .pipe(Effect.either);

          return {
            events: yield* ledger.getRunEvents(run.id),
            run: yield* ledger.getRun(run.id),
            runDirectory: join(dir, ".morpheus", "runs", run.id),
            writeResult,
          };
        }),
      );

      expect(result.writeResult).toMatchObject({
        _tag: "Left",
        left: {
          _tag: "RunLedgerPersistenceError",
          operation: "writeRunArtifacts",
        },
      });
      expect(result.run?.transcriptPath).toBeUndefined();
      expect(result.run?.artifactPath).toBeUndefined();
      expect(result.events).toMatchObject([
        {
          sequence: 1,
          type: "PreparationStarted",
        },
      ]);
      expect(existsSync(join(result.runDirectory, "transcript.txt"))).toBe(false);
      expect(existsSync(join(result.runDirectory, "artifact.json"))).toBe(false);
    });
  });

  it("orders artifact and terminal events in one run history", async () => {
    await withTempDir(async (dir) => {
      const events = await runWithLedger(
        dir,
        Effect.gen(function* () {
          const ledger = yield* RunLedger;
          const run = yield* ledger.createPreparationRun({
            issueId: "morph-7o3",
            summary: "Record fake preparation run in RunLedger",
          });
          yield* ledger.writeRunArtifacts(run.id, {
            transcript: "fake preparation transcript",
            artifact: JSON.stringify({ result: "blocked" }),
          });
          yield* ledger.finishRun(run.id, {
            status: "failed",
            failureKind: "agent_contract_error",
            message: "Fake preparation could not produce a valid contract.",
          });
          return yield* ledger.getRunEvents(run.id);
        }),
      );

      expect(events).toMatchObject([
        {
          sequence: 1,
          type: "PreparationStarted",
        },
        {
          sequence: 2,
          type: "RunArtifactsWritten",
        },
        {
          sequence: 3,
          type: "PreparationFailed",
        },
      ]);
    });
  });
});
