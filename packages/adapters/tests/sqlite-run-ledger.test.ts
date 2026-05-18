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

const insertRawRun = (input: {
  readonly runId: string;
  readonly lane: string;
  readonly status: string;
  readonly failureKind: string | null;
}) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`
      INSERT INTO runs (id, issue_id, lane, status, summary, started_at, failure_kind)
      VALUES (
        ${input.runId},
        ${"morph-corrupt"},
        ${input.lane},
        ${input.status},
        ${"Corrupt persisted run"},
        ${new Date().toISOString()},
        ${input.failureKind}
      )
    `;
  });

const prunePolicy = {
  completedIntermediate: { keepDays: 0, keepLast: 0 },
  failed: "manual",
  reviewCandidate: "until-mr-closed-or-manual",
  active: "never",
} as const;

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

  it("records implementation workspace, branch, and Draft MR refs", async () => {
    await withTempDir(async (dir) => {
      const { events, run } = await runWithLedger(
        dir,
        Effect.gen(function* () {
          const ledger = yield* RunLedger;
          const run = yield* ledger.createImplementationRun({
            issueId: "morph-7ky",
            summary: "Create Draft MR before implementation",
          });
          yield* ledger.recordImplementationWorkspace(run.id, {
            workspacePath: "/repo",
            worktreePath: "/repo",
            branch: "morpheus/morph-7ky",
          });
          const updated = yield* ledger.recordMergeRequest(run.id, {
            reference: "!42",
            url: "https://gitlab.example.com/group/project/-/merge_requests/42",
          });
          return {
            run: updated,
            events: yield* ledger.getRunEvents(run.id),
          };
        }),
      );

      expect(run).toMatchObject({
        issueId: "morph-7ky",
        lane: "implementation",
        status: "running",
        workspacePath: "/repo",
        worktreePath: "/repo",
        branch: "morpheus/morph-7ky",
        mergeRequestRef: "!42",
        mergeRequestUrl: "https://gitlab.example.com/group/project/-/merge_requests/42",
      });
      expect(events).toMatchObject([
        {
          sequence: 1,
          type: "ImplementationStarted",
        },
        {
          sequence: 2,
          type: "ImplementationWorkspacePrepared",
          message: "morpheus/morph-7ky",
        },
        {
          sequence: 3,
          type: "DraftMergeRequestCreated",
          message: "!42",
        },
      ]);
    });
  });

  it("creates a review run with an ordered start event", async () => {
    await withTempDir(async (dir) => {
      const { events, run } = await runWithLedger(
        dir,
        Effect.gen(function* () {
          const ledger = yield* RunLedger;
          const run = yield* ledger.createReviewRun({
            issueId: "morph-wv6",
            summary: "Run read-only review",
          });
          return {
            run,
            events: yield* ledger.getRunEvents(run.id),
          };
        }),
      );

      expect(run).toMatchObject({
        issueId: "morph-wv6",
        lane: "review",
        status: "running",
        summary: "Run read-only review",
      });
      expect(events).toMatchObject([
        {
          sequence: 1,
          type: "StartReview",
        },
      ]);
    });
  });

  it("rejects implementation refs on terminal runs", async () => {
    await withTempDir(async (dir) => {
      const { events, recordMergeRequestResult, recordWorkspaceResult, run } = await runWithLedger(
        dir,
        Effect.gen(function* () {
          const ledger = yield* RunLedger;
          const run = yield* ledger.createImplementationRun({
            issueId: "morph-7ky",
            summary: "Create Draft MR before implementation",
          });
          const failed = yield* ledger.finishRun(run.id, {
            status: "failed",
            failureKind: "runtime_error",
            terminalEvent: "ImplementationFailed",
            message: "setup failed",
          });
          const recordWorkspaceResult = yield* ledger
            .recordImplementationWorkspace(run.id, {
              workspacePath: "/repo",
              worktreePath: "/repo",
              branch: "morpheus/morph-7ky",
            })
            .pipe(Effect.either);
          const recordMergeRequestResult = yield* ledger
            .recordMergeRequest(run.id, {
              reference: "!42",
            })
            .pipe(Effect.either);

          return {
            run: yield* ledger.getRun(run.id),
            failed,
            events: yield* ledger.getRunEvents(run.id),
            recordWorkspaceResult,
            recordMergeRequestResult,
          };
        }),
      );

      expect(recordWorkspaceResult).toMatchObject({
        _tag: "Left",
        left: {
          _tag: "RunLedgerInvalidStateError",
          status: "failed",
          operation: "recordImplementationWorkspace",
        },
      });
      expect(recordMergeRequestResult).toMatchObject({
        _tag: "Left",
        left: {
          _tag: "RunLedgerInvalidStateError",
          status: "failed",
          operation: "recordMergeRequest",
        },
      });
      expect(run).toMatchObject({
        status: "failed",
        workspacePath: undefined,
        mergeRequestRef: undefined,
      });
      expect(events).toMatchObject([
        {
          sequence: 1,
          type: "ImplementationStarted",
        },
        {
          sequence: 2,
          type: "ImplementationFailed",
          message: "setup failed",
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
            terminalEvent: "PreparationBlocked",
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
          type: "PreparationBlocked",
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
      const { artifact, events, logs, run, updated } = await runWithLedger(
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
            artifact: yield* ledger.getRunArtifact(run.id),
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
      expect(artifact).toEqual({
        runId: run.id,
        artifactPath: updated?.artifactPath,
        artifact: JSON.stringify({ result: "blocked" }),
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

  it("dry-runs eligible terminal run pruning without mutating events or artifacts", async () => {
    await withTempDir(async (dir) => {
      const result = await runWithLedger(
        dir,
        Effect.gen(function* () {
          const ledger = yield* RunLedger;
          const run = yield* ledger.createPreparationRun({
            issueId: "morph-51k",
            summary: "Prune terminal run",
          });
          const withArtifacts = yield* ledger.writeRunArtifacts(run.id, {
            transcript: "dry-run transcript",
            artifact: JSON.stringify({ prune: "dry-run" }),
          });
          yield* ledger.finishRun(run.id, {
            status: "succeeded",
            message: "done",
          });
          const beforeEvents = yield* ledger.getRunEvents(run.id);
          const preview = yield* ledger.pruneRuns({
            apply: false,
            policy: prunePolicy,
            prunedBy: "operator",
            reason: "operator dry-run",
          });

          return {
            beforeEvents,
            preview,
            run: yield* ledger.getRun(run.id),
            afterEvents: yield* ledger.getRunEvents(run.id),
            transcriptPath: withArtifacts.transcriptPath,
            artifactPath: withArtifacts.artifactPath,
          };
        }),
      );

      expect(result.preview).toMatchObject({
        applied: false,
        eligibleRuns: [
          {
            issueId: "morph-51k",
            lane: "preparation",
            status: "succeeded",
            artifactBytes:
              "dry-run transcript".length + JSON.stringify({ prune: "dry-run" }).length,
          },
        ],
        totalArtifactBytes:
          "dry-run transcript".length + JSON.stringify({ prune: "dry-run" }).length,
      });
      expect(result.afterEvents).toEqual(result.beforeEvents);
      expect(result.run?.transcriptPath).toBe(result.transcriptPath);
      expect(result.run?.artifactPath).toBe(result.artifactPath);
      expect(existsSync(result.transcriptPath ?? "")).toBe(true);
      expect(existsSync(result.artifactPath ?? "")).toBe(true);
    });
  });

  it("applies tombstone pruning, replaces detailed events, clears paths, and deletes files", async () => {
    await withTempDir(async (dir) => {
      const result = await runWithLedger(
        dir,
        Effect.gen(function* () {
          const ledger = yield* RunLedger;
          const run = yield* ledger.createPreparationRun({
            issueId: "morph-51k",
            summary: "Apply prune",
          });
          const withArtifacts = yield* ledger.writeRunArtifacts(run.id, {
            transcript: "apply transcript",
            artifact: JSON.stringify({ prune: "apply" }),
          });
          const terminal = yield* ledger.finishRun(run.id, {
            status: "failed",
            failureKind: "runtime_error",
            message: "failed",
          });
          const pruned = yield* ledger.pruneRuns({
            apply: true,
            policy: prunePolicy,
            prunedBy: "operator",
            reason: "manual prune",
          });

          return {
            terminal,
            pruned,
            run: yield* ledger.getRun(run.id),
            events: yield* ledger.getRunEvents(run.id),
            transcriptPath: withArtifacts.transcriptPath,
            artifactPath: withArtifacts.artifactPath,
          };
        }),
      );

      const expectedBytes = "apply transcript".length + JSON.stringify({ prune: "apply" }).length;
      expect(result.pruned.totalArtifactBytes).toBe(expectedBytes);
      expect(result.run).toMatchObject({
        id: result.terminal.id,
        issueId: "morph-51k",
        lane: "preparation",
        status: "failed",
        failureKind: "runtime_error",
        prunedBy: "operator",
        pruneReason: "manual prune",
        artifactBytesDeleted: expectedBytes,
        transcriptPath: undefined,
        artifactPath: undefined,
      });
      expect(result.run?.prunedAt).toEqual(expect.any(String));
      expect(result.run?.eventsPrunedAt).toEqual(result.run?.prunedAt);
      expect(result.run?.artifactsPrunedAt).toEqual(result.run?.prunedAt);
      expect(result.events).toMatchObject([
        {
          sequence: 1,
          type: "RunPruned",
          message: "manual prune",
        },
      ]);
      expect(existsSync(result.transcriptPath ?? "")).toBe(false);
      expect(existsSync(result.artifactPath ?? "")).toBe(false);
    });
  });

  it("does not prune active or already-pruned runs", async () => {
    await withTempDir(async (dir) => {
      const result = await runWithLedger(
        dir,
        Effect.gen(function* () {
          const ledger = yield* RunLedger;
          const active = yield* ledger.createPreparationRun({
            issueId: "morph-active",
            summary: "Active run",
          });
          const terminal = yield* ledger.createPreparationRun({
            issueId: "morph-terminal",
            summary: "Terminal run",
          });
          yield* ledger.finishRun(terminal.id, {
            status: "failed",
            failureKind: "runtime_error",
            message: "failed",
          });
          yield* ledger.pruneRuns({
            apply: true,
            policy: prunePolicy,
            prunedBy: "operator",
            reason: "first prune",
          });
          const second = yield* ledger.pruneRuns({
            apply: true,
            policy: prunePolicy,
            prunedBy: "operator",
            reason: "second prune",
          });

          return {
            active: yield* ledger.getRun(active.id),
            activeEvents: yield* ledger.getRunEvents(active.id),
            second,
          };
        }),
      );

      expect(result.active).toMatchObject({
        issueId: "morph-active",
        status: "running",
        prunedAt: undefined,
      });
      expect(result.activeEvents).toMatchObject([
        {
          type: "PreparationStarted",
        },
      ]);
      expect(result.second.eligibleRuns).toEqual([]);
      expect(result.second.totalArtifactBytes).toBe(0);
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

  it.each(["not-a-lane", "none"])(
    "rejects corrupt persisted run rows with invalid lane %s",
    async (lane) => {
      await withTempDir(async (dir) => {
        const runId = "run_01HX0000000000000000000001";
        const result = await runWithLedgerAndSql(
          dir,
          Effect.gen(function* () {
            const ledger = yield* RunLedger;
            yield* insertRawRun({
              runId,
              lane,
              status: "running",
              failureKind: null,
            });

            return {
              getRun: yield* ledger.getRun(runId).pipe(Effect.either),
              listRuns: yield* ledger.listRuns().pipe(Effect.either),
            };
          }),
        );

        expect(result.getRun).toMatchObject({
          _tag: "Left",
          left: {
            _tag: "RunLedgerPersistenceError",
            operation: "getRun",
            message: expect.stringContaining("lane"),
          },
        });
        expect(result.listRuns).toMatchObject({
          _tag: "Left",
          left: {
            _tag: "RunLedgerPersistenceError",
            operation: "listRuns",
            message: expect.stringContaining("lane"),
          },
        });
      });
    },
  );

  it("rejects corrupt persisted run rows with an invalid status", async () => {
    await withTempDir(async (dir) => {
      const runId = "run_01HX0000000000000000000002";
      const result = await runWithLedgerAndSql(
        dir,
        Effect.gen(function* () {
          const ledger = yield* RunLedger;
          yield* insertRawRun({
            runId,
            lane: "preparation",
            status: "stuck",
            failureKind: null,
          });

          return {
            getRun: yield* ledger.getRun(runId).pipe(Effect.either),
            listRuns: yield* ledger.listRuns().pipe(Effect.either),
          };
        }),
      );

      expect(result.getRun).toMatchObject({
        _tag: "Left",
        left: {
          _tag: "RunLedgerPersistenceError",
          operation: "getRun",
          message: expect.stringContaining("status"),
        },
      });
      expect(result.listRuns).toMatchObject({
        _tag: "Left",
        left: {
          _tag: "RunLedgerPersistenceError",
          operation: "listRuns",
          message: expect.stringContaining("status"),
        },
      });
    });
  });

  it("rejects corrupt persisted run rows with an invalid failure kind", async () => {
    await withTempDir(async (dir) => {
      const runId = "run_01HX0000000000000000000003";
      const result = await runWithLedgerAndSql(
        dir,
        Effect.gen(function* () {
          const ledger = yield* RunLedger;
          yield* insertRawRun({
            runId,
            lane: "preparation",
            status: "failed",
            failureKind: "bad_failure_kind",
          });

          return {
            getRun: yield* ledger.getRun(runId).pipe(Effect.either),
            listRuns: yield* ledger.listRuns().pipe(Effect.either),
          };
        }),
      );

      expect(result.getRun).toMatchObject({
        _tag: "Left",
        left: {
          _tag: "RunLedgerPersistenceError",
          operation: "getRun",
          message: expect.stringContaining("failure_kind"),
        },
      });
      expect(result.listRuns).toMatchObject({
        _tag: "Left",
        left: {
          _tag: "RunLedgerPersistenceError",
          operation: "listRuns",
          message: expect.stringContaining("failure_kind"),
        },
      });
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
