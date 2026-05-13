import { beforeAll, describe, expect, it } from "vitest"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createSqliteRunLedger } from "../packages/adapters/src/index.js"

const runPnpm = (args: readonly string[]) =>
  execFileSync("pnpm", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  })

const buildCli = () => {
  runPnpm(["--filter", "@morpheus/runtime", "build"])
  runPnpm(["--filter", "@morpheus/cli", "build"])
}

describe("morpheus cli", () => {
  beforeAll(() => {
    buildCli()
  }, 20_000)

  it("prints help", () => {
    const output = runPnpm(["--filter", "@morpheus/cli", "morpheus", "--help"])

    expect(output).toContain("Morpheus")
  })

  it("prints version", () => {
    const output = runPnpm([
      "--filter",
      "@morpheus/cli",
      "morpheus",
      "--version"
    ])

    expect(output.trim().split("\n").at(-1)).toBe("0.1.0")
  })

  it("shows a validated config summary", () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-cli-config-"))
    try {
      const configPath = join(dir, "morpheus.config.json")
      writeFileSync(
        configPath,
        JSON.stringify(
          {
            targetRepo: ".",
            issueTracker: { kind: "beads" },
            mergeRequests: { kind: "gitlab-glab" },
            agentRunner: { kind: "sandcastle" },
            ledger: { path: ".morpheus/ledger.sqlite" },
            lanes: {
              preparation: { concurrency: 1 },
              implementation: { concurrency: 1 },
              review: { concurrency: 1 }
            },
            verification: { commands: [] },
            retention: {
              completedIntermediate: {
                keepDays: 14,
                keepLast: 100
              },
              failed: "manual",
              reviewCandidate: "until-mr-closed-or-manual",
              active: "never"
            }
          },
          null,
          2
        )
      )

      const output = runPnpm([
        "--filter",
        "@morpheus/cli",
        "morpheus",
        "config",
        "show",
        "--config",
        configPath
      ])

      expect(output).toContain("Morpheus config")
      expect(output).toContain("targetRepo: .")
      expect(output).toContain("ledger: .morpheus/ledger.sqlite")
      expect(output).toContain("issueTracker: beads")
      expect(output).toContain("mergeRequests: gitlab-glab")
      expect(output).toContain("agentRunner: sandcastle")
      expect(output).toContain("lanes: preparation=1 implementation=1 review=1")
    } finally {
      rmSync(dir, { force: true, recursive: true })
    }
  })

  it("renders run summaries, run detail, and logs from the configured ledger", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-cli-runs-"))
    try {
      const configPath = join(dir, "morpheus.config.json")
      const ledgerPath = join(dir, ".morpheus", "ledger.sqlite")
      const runsDirectory = join(dir, ".morpheus", "runs")
      writeFileSync(
        configPath,
        JSON.stringify(
          {
            targetRepo: ".",
            issueTracker: { kind: "beads" },
            mergeRequests: { kind: "gitlab-glab" },
            agentRunner: { kind: "sandcastle" },
            ledger: { path: ledgerPath },
            lanes: {
              preparation: { concurrency: 1 },
              implementation: { concurrency: 1 },
              review: { concurrency: 1 }
            },
            verification: { commands: [] },
            retention: {
              completedIntermediate: {
                keepDays: 14,
                keepLast: 100
              },
              failed: "manual",
              reviewCandidate: "until-mr-closed-or-manual",
              active: "never"
            }
          },
          null,
          2
        )
      )
      const ledger = createSqliteRunLedger({ ledgerPath, runsDirectory })
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

      const runsOutput = runPnpm([
        "--filter",
        "@morpheus/cli",
        "morpheus",
        "runs",
        "--config",
        configPath
      ])
      expect(runsOutput).toContain(run.id)
      expect(runsOutput).toContain("morph-7o3")
      expect(runsOutput).toContain("preparation")
      expect(runsOutput).toContain("failed")

      const runOutput = runPnpm([
        "--filter",
        "@morpheus/cli",
        "morpheus",
        "run",
        run.id,
        "--config",
        configPath
      ])
      expect(runOutput).toContain(`Run ${run.id}`)
      expect(runOutput).toContain("PreparationStarted")
      expect(runOutput).toContain("RunArtifactsWritten")
      expect(runOutput).toContain("PreparationFailed")
      expect(runOutput).toContain("failureKind: agent_contract_error")
      expect(runOutput).toContain("transcript.txt")

      const logsOutput = runPnpm([
        "--filter",
        "@morpheus/cli",
        "morpheus",
        "logs",
        run.id,
        "--config",
        configPath
      ])
      expect(logsOutput).toContain("fake preparation transcript")
    } finally {
      rmSync(dir, { force: true, recursive: true })
    }
  })
})
