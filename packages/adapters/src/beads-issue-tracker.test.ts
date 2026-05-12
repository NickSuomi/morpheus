import { describe, expect, it } from "vitest"
import { createBeadsIssueTracker } from "./index.js"
import type { ProcessRunner, ProcessResult } from "@morpheus/runtime"
import { planAgentStateTransition } from "@morpheus/core"

class FakeProcessRunner implements ProcessRunner {
  readonly calls: Array<{ command: string; args: readonly string[] }> = []

  constructor(private readonly results: readonly ProcessResult[]) {}

  async run(command: string, args: readonly string[]): Promise<ProcessResult> {
    this.calls.push({ command, args })

    const result = this.results[this.calls.length - 1]
    if (result === undefined) {
      throw new Error("Unexpected process call")
    }

    return result
  }
}

const ok = (stdout: unknown): ProcessResult => ({
  stdout: JSON.stringify(stdout),
  stderr: "",
  exitCode: 0
})

const failed = (stderr: string): ProcessResult => ({
  stdout: "",
  stderr,
  exitCode: 1
})

describe("BeadsIssueTracker", () => {
  it("lists runnable issues from bd ready JSON output", async () => {
    const processRunner = new FakeProcessRunner([
      ok([
        {
          id: "morph-fe0",
          title: "Read and mutate Beads issue state",
          labels: ["agent:ready", "ready-for-agent"],
          priority: 2,
          created_at: "2026-05-12T22:55:16Z",
          updated_at: "2026-05-12T22:55:16Z"
        }
      ])
    ])
    const tracker = createBeadsIssueTracker({ processRunner })

    await expect(tracker.listRunnableIssues()).resolves.toEqual([
      {
        id: "morph-fe0",
        title: "Read and mutate Beads issue state",
        labels: ["agent:ready", "ready-for-agent"],
        priority: 2,
        createdAt: "2026-05-12T22:55:16Z",
        updatedAt: "2026-05-12T22:55:16Z",
        derivedState: {
          status: "active",
          state: "agent:ready"
        },
        lane: "preparation"
      }
    ])
    expect(processRunner.calls).toEqual([
      { command: "bd", args: ["ready", "--json"] }
    ])
  })

  it("fails closed when runnable issue labels contain conflicting agent states", async () => {
    const processRunner = new FakeProcessRunner([
      ok([
        {
          id: "morph-conflict",
          title: "Conflict",
          labels: ["agent:ready", "agent:running"],
          priority: 2
        }
      ])
    ])
    const tracker = createBeadsIssueTracker({ processRunner })

    await expect(tracker.listRunnableIssues()).resolves.toMatchObject([
      {
        id: "morph-conflict",
        derivedState: {
          status: "conflict",
          failureKind: "state_conflict",
          activeStates: ["agent:ready", "agent:running"]
        },
        lane: "none"
      }
    ])
  })

  it("gets one issue from bd show JSON output", async () => {
    const processRunner = new FakeProcessRunner([
      ok([
        {
          id: "morph-fe0",
          title: "Read and mutate Beads issue state",
          labels: ["agent:prepared"],
          priority: 2
        }
      ])
    ])
    const tracker = createBeadsIssueTracker({ processRunner })

    await expect(tracker.getIssue("morph-fe0")).resolves.toMatchObject({
      id: "morph-fe0",
      derivedState: {
        status: "active",
        state: "agent:prepared"
      },
      lane: "implementation"
    })
    expect(processRunner.calls).toEqual([
      { command: "bd", args: ["show", "morph-fe0", "--json"] }
    ])
  })

  it("returns typed command failures", async () => {
    const processRunner = new FakeProcessRunner([failed("bd failed")])
    const tracker = createBeadsIssueTracker({ processRunner })

    await expect(tracker.listRunnableIssues()).rejects.toMatchObject({
      name: "BeadsCommandError",
      command: "bd",
      args: ["ready", "--json"],
      exitCode: 1,
      stderr: "bd failed"
    })
  })

  it("returns typed parse failures for malformed JSON", async () => {
    const processRunner = new FakeProcessRunner([
      {
        stdout: "{",
        stderr: "",
        exitCode: 0
      }
    ])
    const tracker = createBeadsIssueTracker({ processRunner })

    await expect(tracker.listRunnableIssues()).rejects.toMatchObject({
      name: "BeadsJsonParseError",
      command: "bd",
      args: ["ready", "--json"]
    })
  })

  it("applies planned state transitions through bd label updates", async () => {
    const processRunner = new FakeProcessRunner([ok([]), ok([])])
    const tracker = createBeadsIssueTracker({ processRunner })
    const plan = planAgentStateTransition(["agent:ready"], "StartPreparation")

    await expect(tracker.applyAgentState("morph-fe0", plan)).resolves.toEqual({
      status: "applied",
      issueId: "morph-fe0",
      addLabels: ["agent:preparing"],
      removeLabels: ["agent:ready"]
    })
    expect(processRunner.calls).toEqual([
      {
        command: "bd",
        args: ["update", "morph-fe0", "--remove-label", "agent:ready"]
      },
      {
        command: "bd",
        args: ["update", "morph-fe0", "--add-label", "agent:preparing"]
      }
    ])
  })

  it("does not apply non-planned transition results", async () => {
    const processRunner = new FakeProcessRunner([])
    const tracker = createBeadsIssueTracker({ processRunner })
    const plan = planAgentStateTransition(
      ["agent:ready", "agent:running"],
      "StartPreparation"
    )

    await expect(tracker.applyAgentState("morph-fe0", plan)).resolves.toEqual({
      status: "rejected",
      issueId: "morph-fe0",
      reason: "conflict",
      plan
    })
    expect(processRunner.calls).toEqual([])
  })
})
