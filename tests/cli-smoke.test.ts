import { beforeAll, describe, expect, it } from "vitest"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

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
})
