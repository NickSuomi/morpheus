import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { createSqliteRunLedger } from "../src/sqlite-ledger/index.js"

const withTempDir = async (fn: (dir: string) => Promise<void>) => {
  const dir = mkdtempSync(join(tmpdir(), "morpheus-ledger-"))
  try {
    await fn(dir)
  } finally {
    rmSync(dir, { force: true, recursive: true })
  }
}

describe("SqliteRunLedger", () => {
  it("creates a fake preparation run with an ordered start event", async () => {
    await withTempDir(async (dir) => {
      const ledger = createSqliteRunLedger({
        ledgerPath: join(dir, "ledger.sqlite"),
        runsDirectory: join(dir, ".morpheus", "runs")
      })

      const run = await ledger.createPreparationRun({
        issueId: "morph-7o3",
        summary: "Record fake preparation run in RunLedger"
      })

      expect(run.id).toMatch(/^run_[0-9A-HJKMNP-TV-Z]{26}$/)
      expect(run).toMatchObject({
        issueId: "morph-7o3",
        lane: "preparation",
        status: "running",
        summary: "Record fake preparation run in RunLedger"
      })

      await expect(ledger.getRun(run.id)).resolves.toMatchObject(run)
      await expect(ledger.getRunEvents(run.id)).resolves.toMatchObject([
        {
          sequence: 1,
          runId: run.id,
          type: "PreparationStarted"
        }
      ])
    })
  })

  it("records terminal result events and updates the summary", async () => {
    await withTempDir(async (dir) => {
      const ledger = createSqliteRunLedger({
        ledgerPath: join(dir, "ledger.sqlite"),
        runsDirectory: join(dir, ".morpheus", "runs")
      })
      const run = await ledger.createPreparationRun({
        issueId: "morph-7o3",
        summary: "Record fake preparation run in RunLedger"
      })

      await ledger.finishRun(run.id, {
        status: "failed",
        failureKind: "agent_contract_error",
        message: "Fake preparation could not produce a valid contract."
      })

      await expect(ledger.getRun(run.id)).resolves.toMatchObject({
        id: run.id,
        status: "failed",
        failureKind: "agent_contract_error"
      })
      await expect(ledger.getRunEvents(run.id)).resolves.toMatchObject([
        {
          sequence: 1,
          type: "PreparationStarted"
        },
        {
          sequence: 2,
          type: "PreparationFailed",
          message: "Fake preparation could not produce a valid contract."
        }
      ])
    })
  })

  it("writes transcript and artifact refs under the configured run directory", async () => {
    await withTempDir(async (dir) => {
      const ledger = createSqliteRunLedger({
        ledgerPath: join(dir, "ledger.sqlite"),
        runsDirectory: join(dir, ".morpheus", "runs")
      })
      const run = await ledger.createPreparationRun({
        issueId: "morph-7o3",
        summary: "Record fake preparation run in RunLedger"
      })

      await ledger.writeRunArtifacts(run.id, {
        transcript: "fake preparation transcript",
        artifact: JSON.stringify({ result: "blocked" })
      })

      const updated = await ledger.getRun(run.id)

      expect(updated?.transcriptPath).toBe(
        join(dir, ".morpheus", "runs", run.id, "transcript.txt")
      )
      expect(updated?.artifactPath).toBe(
        join(dir, ".morpheus", "runs", run.id, "artifact.json")
      )
      expect(existsSync(updated?.transcriptPath ?? "")).toBe(true)
      expect(existsSync(updated?.artifactPath ?? "")).toBe(true)
      await expect(ledger.getRunLogs(run.id)).resolves.toEqual({
        runId: run.id,
        transcriptPath: updated?.transcriptPath,
        transcript: "fake preparation transcript"
      })
      await expect(ledger.getRunEvents(run.id)).resolves.toMatchObject([
        {
          sequence: 1,
          type: "PreparationStarted"
        },
        {
          sequence: 2,
          type: "RunArtifactsWritten",
          message: "Transcript and artifact written."
        }
      ])
    })
  })

  it("orders artifact and terminal events in one run history", async () => {
    await withTempDir(async (dir) => {
      const ledger = createSqliteRunLedger({
        ledgerPath: join(dir, "ledger.sqlite"),
        runsDirectory: join(dir, ".morpheus", "runs")
      })
      const run = await ledger.createPreparationRun({
        issueId: "morph-7o3",
        summary: "Record fake preparation run in RunLedger"
      })

      await ledger.writeRunArtifacts(run.id, {
        transcript: "fake preparation transcript",
        artifact: JSON.stringify({ result: "blocked" })
      })
      await ledger.finishRun(run.id, {
        status: "failed",
        failureKind: "agent_contract_error",
        message: "Fake preparation could not produce a valid contract."
      })

      await expect(ledger.getRunEvents(run.id)).resolves.toMatchObject([
        {
          sequence: 1,
          type: "PreparationStarted"
        },
        {
          sequence: 2,
          type: "RunArtifactsWritten"
        },
        {
          sequence: 3,
          type: "PreparationFailed"
        }
      ])
    })
  })
})
