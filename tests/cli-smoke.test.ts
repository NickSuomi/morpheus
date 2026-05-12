import { describe, expect, it } from "vitest"
import { execFileSync } from "node:child_process"

const runPnpm = (args: readonly string[]) =>
  execFileSync("pnpm", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  })

describe("morpheus cli", () => {
  it("prints help", () => {
    runPnpm(["--filter", "@morpheus/cli", "build"])
    const output = runPnpm(["--filter", "@morpheus/cli", "morpheus", "--help"])

    expect(output).toContain("Morpheus")
  })

  it("prints version", () => {
    runPnpm(["--filter", "@morpheus/cli", "build"])
    const output = runPnpm([
      "--filter",
      "@morpheus/cli",
      "morpheus",
      "--version"
    ])

    expect(output.trim().split("\n").at(-1)).toBe("0.1.0")
  })
})
