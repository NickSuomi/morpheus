import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deriveIssueState, deriveLane } from "@morpheus/core";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createSandcastleAgentRunner } from "../src/index.js";
import type { TrackedIssue } from "@morpheus/runtime";

const trackedIssue = (): TrackedIssue => {
  const labels = ["agent:ready"];
  const derivedState = deriveIssueState(labels);

  return {
    id: "morph-bbp",
    title: "Add real Sandcastle agent runner adapter",
    labels,
    derivedState,
    lane: derivedState.status === "active" ? deriveLane(derivedState.state) : "none",
  };
};

describe("SandcastleAgentRunner", () => {
  it("constructs Sandcastle run options and maps tagged output to preparation result", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    const calls: unknown[] = [];
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      agent: { name: "fake", env: {}, captureSessions: false, buildPrintCommand: () => ({ command: "fake" }), parseStreamLine: () => [] },
      sandbox: { kind: "none", exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }), close: async () => ({}) } as never,
      run: async (options) => {
        calls.push(options);
        return {
          iterations: [],
          stdout: `<morpheus_result>${JSON.stringify({
            status: "prepared",
            contract: {
              category: "task",
              summary: "Prepared",
              currentBehavior: "Before",
              desiredBehavior: "After",
              keyInterfaces: ["AgentRunner"],
              acceptanceCriteria: ["Runs"],
              outOfScope: ["None"],
              verificationPlan: ["pnpm check"],
              blockedBy: "None",
              hitlDecisions: "None",
              riskLevel: "medium",
            },
            transcript: "ignored",
            artifact: {},
          })}</morpheus_result>`,
          commits: [],
          branch: "agent/morph-bbp",
          logFilePath: join(dir, ".morpheus", "sandcastle-logs", "morph-bbp-prepare.log"),
        };
      },
    });

    const result = await Effect.runPromise(runner.prepareIssue({ issue: trackedIssue() }));

    expect(result.status).toBe("prepared");
    expect(result.transcript).toContain("<morpheus_result>");
    expect(result.artifact).toMatchObject({
      branch: "agent/morph-bbp",
      logFilePath: join(dir, ".morpheus", "sandcastle-logs", "morph-bbp-prepare.log"),
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      cwd: dir,
      name: "morpheus-prepare-morph-bbp",
      logging: {
        type: "file",
        path: join(dir, ".morpheus", "sandcastle-logs", "morph-bbp-prepare.log"),
      },
      maxIterations: 1,
    });
  });

  it("uses prompt override files relative to the target repo", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    writeFileSync(join(dir, "prepare.md"), "custom prompt");
    const calls: Array<{ prompt?: string }> = [];
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      promptPaths: {
        prepare: "prepare.md",
      },
      agent: { name: "fake", env: {}, captureSessions: false, buildPrintCommand: () => ({ command: "fake" }), parseStreamLine: () => [] },
      sandbox: { kind: "none", exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }), close: async () => ({}) } as never,
      run: async (options) => {
        calls.push({ prompt: options.prompt });
        return {
          iterations: [],
          stdout: `<morpheus_result>{"status":"blocked","reason":"x","transcript":"","artifact":{}}</morpheus_result>`,
          commits: [],
          branch: "agent/morph-bbp",
        };
      },
    });

    await Effect.runPromise(runner.prepareIssue({ issue: trackedIssue() }));

    expect(calls).toEqual([{ prompt: "custom prompt" }]);
  });

  it("runs implementation in the prepared workspace with MR and contract context", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    const calls: Array<{ cwd?: string; prompt?: string; name?: string }> = [];
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      agent: { name: "fake", env: {}, captureSessions: false, buildPrintCommand: () => ({ command: "fake" }), parseStreamLine: () => [] },
      sandbox: { kind: "none", exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }), close: async () => ({}) } as never,
      run: async (options) => {
        calls.push({ cwd: options.cwd, prompt: options.prompt, name: options.name });
        return {
          iterations: [],
          stdout: `<morpheus_result>{"status":"implemented","implementationEvidence":[{"summary":"Done","files":["src/index.ts"]}],"verificationEvidence":[{"command":"pnpm check","status":"passed"}],"transcript":"","artifact":{}}</morpheus_result>`,
          commits: [],
          branch: "agent/morph-bbp",
        };
      },
    });

    await Effect.runPromise(
      runner.implementIssue?.({
        issue: trackedIssue(),
        contract: {
          category: "task",
          summary: "Implement real adapter",
          currentBehavior: "Fake runner",
          desiredBehavior: "Real runner",
          keyInterfaces: ["AgentRunner"],
          acceptanceCriteria: ["Uses workspace"],
          outOfScope: [],
          verificationPlan: ["pnpm check"],
          blockedBy: "None",
          hitlDecisions: "None",
          riskLevel: "medium",
        },
        workspace: {
          workspacePath: "/workspace/morph-bbp",
          worktreePath: "/worktree/morph-bbp",
          branch: "agent/morph-bbp",
          targetBranch: "main",
          remote: "origin",
        },
        mergeRequest: {
          reference: "!42",
          url: "https://gitlab.example/mr/42",
        },
      }) ?? Effect.die("missing implementIssue"),
    );

    expect(calls[0].cwd).toBe("/workspace/morph-bbp");
    expect(calls[0].name).toBe("morpheus-implement-morph-bbp");
    expect(calls[0].prompt).toContain("Workspace: /workspace/morph-bbp");
    expect(calls[0].prompt).toContain("Branch: agent/morph-bbp");
    expect(calls[0].prompt).toContain("Merge request: !42");
    expect(calls[0].prompt).toContain("Implement real adapter");
  });

  it("runs review in the prepared review workspace with implementation evidence", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    const calls: Array<{ cwd?: string; prompt?: string; name?: string }> = [];
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      agent: { name: "fake", env: {}, captureSessions: false, buildPrintCommand: () => ({ command: "fake" }), parseStreamLine: () => [] },
      sandbox: { kind: "none", exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }), close: async () => ({}) } as never,
      run: async (options) => {
        calls.push({ cwd: options.cwd, prompt: options.prompt, name: options.name });
        return {
          iterations: [],
          stdout: `<morpheus_result>{"status":"passed","findings":[],"transcript":"","artifact":{}}</morpheus_result>`,
          commits: [],
          branch: "agent/morph-bbp",
        };
      },
    });

    await Effect.runPromise(
      runner.reviewIssue?.({
        issue: trackedIssue(),
        contract: {
          category: "task",
          summary: "Review real adapter",
          currentBehavior: "Fake runner",
          desiredBehavior: "Real runner",
          keyInterfaces: ["AgentRunner"],
          acceptanceCriteria: ["Uses evidence"],
          outOfScope: [],
          verificationPlan: ["pnpm check"],
          blockedBy: "None",
          hitlDecisions: "None",
          riskLevel: "medium",
        },
        workspace: {
          workspacePath: "/workspace/morph-bbp-review",
          branch: "agent/morph-bbp",
          permissions: "read-only",
        },
        mergeRequest: {
          reference: "!42",
        },
        implementationEvidence: [{ summary: "Adapter added", files: ["packages/adapters/src/index.ts"] }],
        verificationEvidence: [{ command: "pnpm check", status: "passed" }],
      }) ?? Effect.die("missing reviewIssue"),
    );

    expect(calls[0].cwd).toBe("/workspace/morph-bbp-review");
    expect(calls[0].name).toBe("morpheus-review-morph-bbp");
    expect(calls[0].prompt).toContain("Permissions: read-only");
    expect(calls[0].prompt).toContain("Implementation evidence:");
    expect(calls[0].prompt).toContain("Adapter added");
    expect(calls[0].prompt).toContain("Verification evidence:");
  });
});
