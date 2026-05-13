import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { SqlClient } from "@effect/sql"
import { SqliteClient } from "@effect/sql-sqlite-node"
import type { FailureKind, Lane } from "@morpheus/core"
import type {
  FinishRunInput,
  RunEvent,
  RunLedger,
  RunLogs,
  RunStatus,
  RunSummary
} from "@morpheus/runtime"
import { Effect } from "effect"
import { ulid } from "ulid"

export type SqliteRunLedgerOptions = {
  readonly ledgerPath: string
  readonly runsDirectory: string
}

type RunRow = {
  readonly id: string
  readonly issue_id: string
  readonly lane: string
  readonly status: string
  readonly summary: string
  readonly started_at: string
  readonly ended_at: string | null
  readonly failure_kind: string | null
  readonly transcript_path: string | null
  readonly artifact_path: string | null
}

type RunEventRow = {
  readonly sequence: number
  readonly run_id: string
  readonly type: string
  readonly occurred_at: string
  readonly message: string | null
}

type SequenceRow = {
  readonly sequence: number
}

const maybe = <T>(value: T | null): T | undefined =>
  value === null ? undefined : value

const runSummaryFromRow = (row: RunRow): RunSummary => ({
  id: row.id,
  issueId: row.issue_id,
  lane: row.lane as Lane,
  status: row.status as RunStatus,
  summary: row.summary,
  startedAt: row.started_at,
  endedAt: maybe(row.ended_at),
  failureKind: maybe(row.failure_kind) as FailureKind | undefined,
  transcriptPath: maybe(row.transcript_path),
  artifactPath: maybe(row.artifact_path)
})

const runEventFromRow = (row: RunEventRow): RunEvent => ({
  sequence: row.sequence,
  runId: row.run_id,
  type: row.type,
  occurredAt: row.occurred_at,
  message: maybe(row.message)
})

const createRunId = (): string => `run_${ulid()}`

export const createSqliteRunLedger = ({
  ledgerPath,
  runsDirectory
}: SqliteRunLedgerOptions): RunLedger => {
  mkdirSync(dirname(ledgerPath), { recursive: true })
  mkdirSync(runsDirectory, { recursive: true })

  const runEffect = <A>(effect: Effect.Effect<A, unknown, SqlClient.SqlClient>) =>
    Effect.runPromise(
      effect.pipe(Effect.provide(SqliteClient.layer({ filename: ledgerPath })))
    )

  const setup = runEffect(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
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
          artifact_path TEXT
        );
      `)
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
      `)
    })
  )

  const ensureSetup = () => setup

  const ledger: RunLedger = {
    async createPreparationRun(input) {
      await ensureSetup()
      const runId = createRunId()
      const now = new Date().toISOString()
      await runEffect(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql.withTransaction(
            Effect.gen(function* () {
              yield* sql`
                INSERT INTO runs (id, issue_id, lane, status, summary, started_at)
                VALUES (${runId}, ${input.issueId}, ${"preparation"}, ${"running"}, ${input.summary}, ${now})
              `
              yield* sql`
                INSERT INTO run_events (run_id, sequence, type, occurred_at)
                VALUES (${runId}, ${1}, ${"PreparationStarted"}, ${now})
              `
            })
          )
        })
      )

      const run = await ledger.getRun(runId)
      if (run === undefined) {
        throw new Error(`Run was not created: ${runId}`)
      }
      return run
    },
    async finishRun(runId, input: FinishRunInput) {
      await ensureSetup()
      const endedAt = new Date().toISOString()
      const eventType =
        input.status === "succeeded" ? "PreparationSucceeded" : "PreparationFailed"
      const failureKind = input.status === "failed" ? input.failureKind : null
      await runEffect(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql.withTransaction(
            Effect.gen(function* () {
              const [sequenceRow] = yield* sql<SequenceRow>`
                SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence
                FROM run_events
                WHERE run_id = ${runId}
              `
              yield* sql`
                INSERT INTO run_events (run_id, sequence, type, occurred_at, message)
                VALUES (${runId}, ${sequenceRow?.sequence ?? 1}, ${eventType}, ${endedAt}, ${input.message ?? null})
              `
              yield* sql`
                UPDATE runs
                SET status = ${input.status}, ended_at = ${endedAt}, failure_kind = ${failureKind}
                WHERE id = ${runId}
              `
            })
          )
        })
      )

      const run = await ledger.getRun(runId)
      if (run === undefined) {
        throw new Error(`Run does not exist: ${runId}`)
      }
      return run
    },
    async writeRunArtifacts(runId, input) {
      await ensureSetup()
      const runDirectory = join(runsDirectory, runId)
      const transcriptPath = join(runDirectory, "transcript.txt")
      const artifactPath = join(runDirectory, "artifact.json")

      mkdirSync(runDirectory, { recursive: true })
      writeFileSync(transcriptPath, input.transcript)
      writeFileSync(artifactPath, input.artifact)
      await runEffect(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql.withTransaction(
            Effect.gen(function* () {
              const [sequenceRow] = yield* sql<SequenceRow>`
                SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence
                FROM run_events
                WHERE run_id = ${runId}
              `
              yield* sql`
                INSERT INTO run_events (run_id, sequence, type, occurred_at, message)
                VALUES (${runId}, ${sequenceRow?.sequence ?? 1}, ${"RunArtifactsWritten"}, ${new Date().toISOString()}, ${"Transcript and artifact written."})
              `
              yield* sql`
                UPDATE runs
                SET transcript_path = ${transcriptPath}, artifact_path = ${artifactPath}
                WHERE id = ${runId}
              `
            })
          )
        })
      )

      const run = await ledger.getRun(runId)
      if (run === undefined) {
        throw new Error(`Run does not exist: ${runId}`)
      }
      return run
    },
    async getRunLogs(runId): Promise<RunLogs | undefined> {
      const run = await ledger.getRun(runId)
      if (run?.transcriptPath === undefined) {
        return undefined
      }
      return {
        runId,
        transcriptPath: run.transcriptPath,
        transcript: readFileSync(run.transcriptPath, "utf8")
      }
    },
    async listRuns() {
      await ensureSetup()
      const rows = await runEffect(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          return yield* sql<RunRow>`
            SELECT * FROM runs
            ORDER BY started_at DESC, id ASC
          `
        })
      )
      return rows.map(runSummaryFromRow)
    },
    async getRun(runId) {
      await ensureSetup()
      const rows = await runEffect(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          return yield* sql<RunRow>`SELECT * FROM runs WHERE id = ${runId}`
        })
      )
      return rows[0] === undefined ? undefined : runSummaryFromRow(rows[0])
    },
    async getRunEvents(runId) {
      await ensureSetup()
      const rows = await runEffect(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          return yield* sql<RunEventRow>`
            SELECT * FROM run_events
            WHERE run_id = ${runId}
            ORDER BY sequence ASC
          `
        })
      )
      return rows.map(runEventFromRow)
    }
  }

  return ledger
}
