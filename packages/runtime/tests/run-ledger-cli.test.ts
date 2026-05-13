import { describe, expect, it } from "vitest"
import {
  listRunsForCli,
  showRunForCli,
  showRunLogsForCli,
  type RunLedger,
  type RunSummary
} from "../src/index.js"

const run: RunSummary = {
  id: "run_01KRGGDQ6JQN2GMD6KJQ5SFXR6",
  issueId: "morph-7o3",
  lane: "preparation",
  status: "failed",
  summary: "Record fake preparation run in RunLedger",
  startedAt: "2026-05-13T11:09:18.418Z",
  endedAt: "2026-05-13T11:09:19.418Z",
  failureKind: "agent_contract_error",
  transcriptPath:
    "/tmp/.morpheus/runs/run_01KRGGDQ6JQN2GMD6KJQ5SFXR6/transcript.txt"
}

const fakeLedger = (overrides: Partial<RunLedger> = {}): RunLedger => ({
  async createPreparationRun() {
    return run
  },
  async finishRun() {
    return run
  },
  async writeRunArtifacts() {
    return run
  },
  async getRunLogs() {
    return {
      runId: run.id,
      transcriptPath: run.transcriptPath ?? "",
      transcript: "fake preparation transcript"
    }
  },
  async listRuns() {
    return [run]
  },
  async getRun() {
    return run
  },
  async getRunEvents() {
    return [
      {
        sequence: 1,
        runId: run.id,
        type: "PreparationStarted",
        occurredAt: "2026-05-13T11:09:18.418Z"
      },
      {
        sequence: 2,
        runId: run.id,
        type: "RunArtifactsWritten",
        occurredAt: "2026-05-13T11:09:18.818Z",
        message: "Transcript and artifact written."
      },
      {
        sequence: 3,
        runId: run.id,
        type: "PreparationFailed",
        occurredAt: "2026-05-13T11:09:19.418Z",
        message: "Fake preparation could not produce a valid contract."
      }
    ]
  },
  ...overrides
})

describe("RunLedger CLI rendering", () => {
  it("renders an empty run list", async () => {
    await expect(
      listRunsForCli(
        fakeLedger({
          async listRuns() {
            return []
          }
        })
      )
    ).resolves.toBe("No Morpheus runs")
  })

  it("renders run summaries", async () => {
    await expect(listRunsForCli(fakeLedger())).resolves.toContain(
      `${run.id} morph-7o3 preparation failed Record fake preparation run in RunLedger`
    )
  })

  it("renders one run with events and failure kind", async () => {
    const output = await showRunForCli(fakeLedger(), run.id)

    expect(output).toContain(`Run ${run.id}`)
    expect(output).toContain("failureKind: agent_contract_error")
    expect(output).toContain("1. PreparationStarted")
    expect(output).toContain("2. RunArtifactsWritten - Transcript and artifact written.")
    expect(output).toContain(
      "3. PreparationFailed - Fake preparation could not produce a valid contract."
    )
  })

  it("renders run logs", async () => {
    await expect(showRunLogsForCli(fakeLedger(), run.id)).resolves.toBe(
      "fake preparation transcript"
    )
  })

  it("throws typed messages for missing run data", async () => {
    await expect(
      showRunForCli(
        fakeLedger({
          async getRun() {
            return undefined
          }
        }),
        run.id
      )
    ).rejects.toThrow(`Run not found: ${run.id}`)

    await expect(
      showRunLogsForCli(
        fakeLedger({
          async getRunLogs() {
            return undefined
          }
        }),
        run.id
      )
    ).rejects.toThrow(`Run logs not found: ${run.id}`)
  })
})
