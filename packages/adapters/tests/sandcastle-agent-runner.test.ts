import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deriveIssueState, deriveLane } from "@morpheus/core";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { createSandcastleAgentRunner, sandcastleAgentRunnerLayer } from "../src/index.js";
import {
  GitLabIssueSource,
  IssueTracker,
  MergeRequestClient,
  ProcessRunner,
  ProcessRunnerError,
  RunLedger,
  runDaemonOnce,
  WorkspaceRuntime,
  type GitLabIssueSourceService,
  type IssueTrackerService,
  type MergeRequestClientService,
  type ProcessRunnerService,
  type RunLedgerService,
  type TrackedIssue,
  type WorkspaceRuntimeService,
} from "@morpheus/runtime";

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

const stageSkillBlock = (prompt: string, phase: "prepare" | "implement" | "review"): string => {
  const start = prompt.indexOf(`Required ${phase} stage skills:`);
  const end = prompt.indexOf("Do not commit.", start);
  return prompt.slice(start, end);
};

describe("SandcastleAgentRunner", () => {
  it("checks Docker-compatible runtime access with docker info before work", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    const calls: Array<{ command: string; args: readonly string[] }> = [];
    const processRunner: ProcessRunnerService = {
      run: (command, args) => {
        calls.push({ command, args });
        return Effect.succeed({ stdout: "", stderr: "", exitCode: 0 });
      },
    };
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      processRunner,
    });

    await Effect.runPromise(runner.checkAccess?.() ?? Effect.void);

    expect(calls).toEqual([{ command: "docker", args: ["info"] }]);
  });

  it("maps unavailable Docker-compatible runtime access to operator_access", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      processRunner: {
        run: (command, args) =>
          Effect.fail(
            new ProcessRunnerError({
              command,
              args: [...args],
              message: "Cannot connect to the Docker daemon",
            }),
          ),
      },
    });

    const result = await Effect.runPromiseExit(runner.checkAccess?.() ?? Effect.void);

    expect(result._tag).toBe("Failure");
    expect(String(result)).toContain("operator_access");
    expect(String(result)).toContain("Docker-compatible runtime unavailable");
    expect(String(result)).toContain("Docker Desktop, OrbStack, Colima, or remote Docker context");
  });

  it("preflights Docker-compatible runtime through the daemon layer before agent work", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    const calls: Array<{ command: string; args: readonly string[] }> = [];
    const processRunner: ProcessRunnerService = {
      run: (command, args) => {
        calls.push({ command, args });
        return Effect.fail(
          new ProcessRunnerError({
            command,
            args: [...args],
            message: "Cannot connect to the Docker daemon",
          }),
        );
      },
    };
    const issueTracker: IssueTrackerService = {
      listRunnableIssues: () => Effect.succeed([trackedIssue()]),
      getIssue: () => Effect.die("getIssue should not run before Docker preflight"),
      applyAgentState: () => Effect.die("applyAgentState should not run before Docker preflight"),
      writeContract: () => Effect.die("writeContract should not run before Docker preflight"),
      readContract: () => Effect.die("readContract should not run before Docker preflight"),
      listImportedGitLabIssues: () => Effect.succeed([]),
      upsertImportedGitLabIssue: () => Effect.die("upsertImportedGitLabIssue should not run"),
    };
    const gitlabIssueSource: GitLabIssueSourceService = {
      listReadyIssues: () => Effect.succeed([]),
    };
    const runLedger: RunLedgerService = {
      createPreparationRun: () => Effect.die("createPreparationRun should not run"),
      createImplementationRun: () => Effect.die("createImplementationRun should not run"),
      createReviewRun: () => Effect.die("createReviewRun should not run"),
      recordImplementationWorkspace: () =>
        Effect.die("recordImplementationWorkspace should not run"),
      recordMergeRequest: () => Effect.die("recordMergeRequest should not run"),
      finishRun: () => Effect.die("finishRun should not run"),
      writeRunArtifacts: () => Effect.die("writeRunArtifacts should not run"),
      getRunLogs: () => Effect.die("getRunLogs should not run"),
      getRunArtifact: () => Effect.die("getRunArtifact should not run"),
      listRuns: () => Effect.succeed([]),
      getRun: () => Effect.succeed(undefined),
      getRunEvents: () => Effect.succeed([]),
      pruneRuns: () => Effect.die("pruneRuns should not run"),
    };
    const workspaceRuntime: WorkspaceRuntimeService = {
      prepareImplementationWorkspace: () =>
        Effect.die("prepareImplementationWorkspace should not run"),
      prepareReviewWorkspace: () => Effect.die("prepareReviewWorkspace should not run"),
    };
    const mergeRequests: MergeRequestClientService = {
      createDraftMergeRequest: () => Effect.die("createDraftMergeRequest should not run"),
      updateDescription: () => Effect.die("updateDescription should not run"),
    };

    const result = await Effect.runPromise(
      runDaemonOnce({ project: "group/project", readyLabel: "agent:ready" }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Layer.succeed(ProcessRunner, processRunner),
            Layer.succeed(IssueTracker, issueTracker),
            Layer.succeed(GitLabIssueSource, gitlabIssueSource),
            Layer.succeed(RunLedger, runLedger),
            Layer.succeed(WorkspaceRuntime, workspaceRuntime),
            Layer.succeed(MergeRequestClient, mergeRequests),
            sandcastleAgentRunnerLayer({
              cwd: dir,
              logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
              authRequiredKeys: [],
            }).pipe(Layer.provide(Layer.succeed(ProcessRunner, processRunner))),
          ),
        ),
      ),
    );

    expect(calls).toEqual([{ command: "docker", args: ["info"] }]);
    expect(result.executions).toHaveLength(1);
    expect(result.executions[0]).toMatchObject({
      lane: "preparation",
      issueId: "morph-bbp",
      result: {
        status: "failed",
        failureKind: "operator_access",
        message: expect.stringContaining("Docker-compatible runtime unavailable"),
      },
    });
  });

  it("constructs Sandcastle run options and maps tagged output to preparation result", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    const calls: unknown[] = [];
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      agent: {
        name: "fake",
        env: {},
        captureSessions: false,
        buildPrintCommand: () => ({ command: "fake" }),
        parseStreamLine: () => [],
      },
      sandbox: {
        kind: "none",
        exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
        close: async () => ({}),
      } as never,
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
    writeFileSync(join(dir, "prepare.md"), "custom prompt that cannot remove required gates");
    const calls: Array<{ prompt?: string }> = [];
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      promptPaths: {
        prepare: "prepare.md",
      },
      agent: {
        name: "fake",
        env: {},
        captureSessions: false,
        buildPrintCommand: () => ({ command: "fake" }),
        parseStreamLine: () => [],
      },
      sandbox: {
        kind: "none",
        exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
        close: async () => ({}),
      } as never,
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

    expect(calls).toHaveLength(1);
    expect(calls[0]?.prompt).toContain("Return only JSON inside <morpheus_result>");
    expect(calls[0]?.prompt).toContain("Default Morpheus Agent Skills");
    expect(calls[0]?.prompt).toContain(".morpheus/skills/matt-pocock-caveman/SKILL.md");
    expect(calls[0]?.prompt).not.toContain("/Users/");
    expect(calls[0]?.prompt).toContain("Additional instructions:");
    expect(calls[0]?.prompt).toContain("custom prompt that cannot remove required gates");
    expect(calls[0]?.prompt?.indexOf("Required prepare stage skills:")).toBeLessThan(
      calls[0]?.prompt?.indexOf("Additional instructions:") ?? -1,
    );
    expect(calls[0]?.prompt).toContain("AFK-ready contract gate");
  });

  it("composes stage-specific skill gates for prepare, implement, and review", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    const calls: Array<{ name?: string; prompt: string }> = [];
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      skills: {
        directory: ".morpheus/skills",
        mappings: [
          {
            name: "matt-pocock-caveman",
            path: ".morpheus/skills/matt-pocock-caveman/SKILL.md",
          },
          {
            name: "matt-pocock-to-prd",
            path: ".morpheus/skills/matt-pocock-to-prd/SKILL.md",
          },
          {
            name: "matt-pocock-grill-me",
            path: ".morpheus/skills/matt-pocock-grill-me/SKILL.md",
          },
          {
            name: "matt-pocock-grill-with-docs",
            path: ".morpheus/skills/matt-pocock-grill-with-docs/SKILL.md",
          },
          {
            name: "matt-pocock-to-issues",
            path: ".morpheus/skills/matt-pocock-to-issues/SKILL.md",
          },
          {
            name: "matt-pocock-tdd",
            path: ".morpheus/skills/matt-pocock-tdd/SKILL.md",
          },
          {
            name: "matt-pocock-diagnose",
            path: ".morpheus/skills/matt-pocock-diagnose/SKILL.md",
          },
        ],
        stageMappings: {
          prepare: [
            "matt-pocock-to-prd",
            "matt-pocock-grill-me",
            "matt-pocock-grill-with-docs",
            "matt-pocock-to-issues",
          ],
          implement: ["matt-pocock-caveman", "matt-pocock-tdd", "matt-pocock-diagnose"],
          review: ["matt-pocock-caveman", "matt-pocock-diagnose"],
        },
      },
      agent: {
        name: "fake",
        env: {},
        captureSessions: false,
        buildPrintCommand: () => ({ command: "fake" }),
        parseStreamLine: () => [],
      },
      sandbox: {
        kind: "none",
        exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
        close: async () => ({}),
      } as never,
      run: async (options) => {
        calls.push({ name: options.name, prompt: options.prompt ?? "" });
        const status =
          options.name === "morpheus-implement-morph-bbp"
            ? `{"status":"implemented","implementationEvidence":[{"summary":"Done","files":[]}],"verificationEvidence":[{"command":"pnpm check","status":"passed"}],"transcript":"","artifact":{}}`
            : options.name === "morpheus-review-morph-bbp"
              ? `{"status":"passed","findings":[],"transcript":"","artifact":{}}`
              : `{"status":"blocked","reason":"x","transcript":"","artifact":{}}`;
        return {
          iterations: [],
          stdout: `<morpheus_result>${status}</morpheus_result>`,
          commits: [],
          branch: "agent/morph-bbp",
        };
      },
    });
    const contract = {
      category: "task" as const,
      summary: "Wire prompts",
      currentBehavior: "Prompts are generic",
      desiredBehavior: "Prompts use stage skills",
      keyInterfaces: ["AgentRunner"],
      acceptanceCriteria: ["Stage skills are required"],
      outOfScope: [],
      verificationPlan: ["pnpm test"],
      blockedBy: "None",
      hitlDecisions: "None",
      riskLevel: "medium" as const,
    };

    await Effect.runPromise(runner.prepareIssue({ issue: trackedIssue() }));
    await Effect.runPromise(
      runner.implementIssue?.({
        issue: trackedIssue(),
        contract,
        workspace: {
          workspacePath: "/workspace/morph-bbp",
          branch: "agent/morph-bbp",
          targetBranch: "main",
          remote: "origin",
        },
        mergeRequest: { reference: "!42" },
      }) ?? Effect.die("missing implementIssue"),
    );
    await Effect.runPromise(
      runner.reviewIssue?.({
        issue: trackedIssue(),
        contract,
        workspace: {
          workspacePath: "/workspace/morph-bbp-review",
          branch: "agent/morph-bbp",
          permissions: "read-only",
        },
        mergeRequest: { reference: "!42" },
        implementationEvidence: [{ summary: "Done", files: [] }],
        verificationEvidence: [{ command: "pnpm test", status: "passed" }],
      }) ?? Effect.die("missing reviewIssue"),
    );

    const preparePrompt = calls.find((call) => call.name === "morpheus-prepare-morph-bbp")?.prompt;
    const implementPrompt = calls.find(
      (call) => call.name === "morpheus-implement-morph-bbp",
    )?.prompt;
    const reviewPrompt = calls.find((call) => call.name === "morpheus-review-morph-bbp")?.prompt;

    expect(preparePrompt).toContain("AFK-ready contract gate");
    expect(stageSkillBlock(preparePrompt ?? "", "prepare")).toContain(
      ".morpheus/skills/matt-pocock-to-prd/SKILL.md",
    );
    expect(stageSkillBlock(preparePrompt ?? "", "prepare")).toContain(
      ".morpheus/skills/matt-pocock-grill-me/SKILL.md",
    );
    expect(stageSkillBlock(preparePrompt ?? "", "prepare")).toContain(
      ".morpheus/skills/matt-pocock-to-issues/SKILL.md",
    );
    expect(stageSkillBlock(implementPrompt ?? "", "implement")).toContain(
      ".morpheus/skills/matt-pocock-caveman/SKILL.md",
    );
    expect(stageSkillBlock(implementPrompt ?? "", "implement")).toContain(
      ".morpheus/skills/matt-pocock-tdd/SKILL.md",
    );
    expect(stageSkillBlock(implementPrompt ?? "", "implement")).toContain(
      ".morpheus/skills/matt-pocock-diagnose/SKILL.md",
    );
    expect(stageSkillBlock(reviewPrompt ?? "", "review")).toContain(
      ".morpheus/skills/matt-pocock-caveman/SKILL.md",
    );
    expect(stageSkillBlock(reviewPrompt ?? "", "review")).toContain(
      ".morpheus/skills/matt-pocock-diagnose/SKILL.md",
    );
    expect(reviewPrompt).toContain("Verify contract acceptance criteria");
  });

  it("fails when a stage skill is not mapped to a copied skill path", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      skills: {
        directory: ".morpheus/skills",
        mappings: [
          {
            name: "matt-pocock-caveman",
            path: ".morpheus/skills/matt-pocock-caveman/SKILL.md",
          },
        ],
        stageMappings: {
          prepare: ["missing-skill"],
          implement: ["matt-pocock-caveman"],
          review: ["matt-pocock-caveman"],
        },
      },
      agent: {
        name: "fake",
        env: {},
        captureSessions: false,
        buildPrintCommand: () => ({ command: "fake" }),
        parseStreamLine: () => [],
      },
      sandbox: {
        kind: "none",
        exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
        close: async () => ({}),
      } as never,
      run: async () => {
        throw new Error("run should not be called");
      },
    });

    const result = await Effect.runPromiseExit(runner.prepareIssue({ issue: trackedIssue() }));

    expect(result._tag).toBe("Failure");
    expect(String(result)).toContain(
      "Stage skill mapping references unknown copied skill: prepare:missing-skill",
    );
  });

  it("fails when a stage has no required copied skills", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      skills: {
        directory: ".morpheus/skills",
        mappings: [
          {
            name: "matt-pocock-caveman",
            path: ".morpheus/skills/matt-pocock-caveman/SKILL.md",
          },
        ],
        stageMappings: {
          prepare: [],
          implement: ["matt-pocock-caveman"],
          review: ["matt-pocock-caveman"],
        },
      },
      agent: {
        name: "fake",
        env: {},
        captureSessions: false,
        buildPrintCommand: () => ({ command: "fake" }),
        parseStreamLine: () => [],
      },
      sandbox: {
        kind: "none",
        exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
        close: async () => ({}),
      } as never,
      run: async () => {
        throw new Error("run should not be called");
      },
    });

    const result = await Effect.runPromiseExit(runner.prepareIssue({ issue: trackedIssue() }));

    expect(result._tag).toBe("Failure");
    expect(String(result)).toContain(
      "Stage skill mapping must include at least one copied skill: prepare",
    );
  });

  it("fails when a stage skill mapping has no copied skill path", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      skills: {
        directory: ".morpheus/skills",
        mappings: [{ name: "matt-pocock-caveman", path: "" }],
        stageMappings: {
          prepare: ["matt-pocock-caveman"],
          implement: ["matt-pocock-caveman"],
          review: ["matt-pocock-caveman"],
        },
      },
      agent: {
        name: "fake",
        env: {},
        captureSessions: false,
        buildPrintCommand: () => ({ command: "fake" }),
        parseStreamLine: () => [],
      },
      sandbox: {
        kind: "none",
        exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
        close: async () => ({}),
      } as never,
      run: async () => {
        throw new Error("run should not be called");
      },
    });

    const result = await Effect.runPromiseExit(runner.prepareIssue({ issue: trackedIssue() }));

    expect(result._tag).toBe("Failure");
    expect(String(result)).toContain(
      "Stage skill mapping references copied skill without path: prepare:matt-pocock-caveman",
    );
  });

  it("constructs Codex provider and Docker sandbox from configured auth and container settings", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    writeFileSync(join(dir, "agent.env"), "OPENAI_API_KEY=test-token\n");
    const commands: string[] = [];
    const dockerOptions: unknown[] = [];
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      authEnvFile: "agent.env",
      containerConfig: {
        image: "morpheus-agent:test",
        profile: ".morpheus/container/Dockerfile",
        mounts: [{ hostPath: ".cache", containerPath: "/cache", readOnly: true }],
      },
      agentConfig: {
        provider: "codex",
        model: "gpt-5.4-nano",
        effort: "xhigh",
      },
      dockerFactory: (options) => {
        dockerOptions.push(options);
        return {
          kind: "none",
          exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
          close: async () => ({}),
        } as never;
      },
      run: async (options) => {
        commands.push(
          options.agent.buildPrintCommand({
            prompt: "prompt",
            dangerouslySkipPermissions: true,
          }).command,
        );
        return {
          iterations: [],
          stdout: `<morpheus_result>{"status":"blocked","reason":"x","transcript":"","artifact":{}}</morpheus_result>`,
          commits: [],
          branch: "agent/morph-bbp",
        };
      },
    });

    await Effect.runPromise(runner.prepareIssue({ issue: trackedIssue() }));

    expect(commands).toEqual([
      `codex exec --json --dangerously-bypass-approvals-and-sandbox -m 'gpt-5.4-nano' -c 'model_reasoning_effort="xhigh"'`,
    ]);
    expect(dockerOptions).toEqual([
      {
        imageName: "morpheus-agent:test",
        dockerfilePath: join(dir, ".morpheus/container/Dockerfile"),
        mounts: [{ hostPath: join(dir, ".cache"), sandboxPath: "/cache", readonly: true }],
        env: { OPENAI_API_KEY: "test-token" },
      },
    ]);
  });

  it("fails before running when configured auth env file is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    let runCalled = false;
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      authEnvFile: ".morpheus/secrets/agent.env",
      run: async () => {
        runCalled = true;
        return {
          iterations: [],
          stdout: `<morpheus_result>{"status":"blocked","reason":"x","transcript":"","artifact":{}}</morpheus_result>`,
          commits: [],
          branch: "agent/morph-bbp",
        };
      },
    });

    const result = await Effect.runPromiseExit(runner.prepareIssue({ issue: trackedIssue() }));

    expect(runCalled).toBe(false);
    expect(result._tag).toBe("Failure");
    expect(String(result)).toContain("Agent auth env file not found");
  });

  it("fails before running when Codex auth env file lacks OPENAI_API_KEY", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    writeFileSync(join(dir, "agent.env"), "OTHER_TOKEN=test\n");
    let runCalled = false;
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      authEnvFile: "agent.env",
      run: async () => {
        runCalled = true;
        return {
          iterations: [],
          stdout: `<morpheus_result>{"status":"blocked","reason":"x","transcript":"","artifact":{}}</morpheus_result>`,
          commits: [],
          branch: "agent/morph-bbp",
        };
      },
    });

    const result = await Effect.runPromiseExit(runner.prepareIssue({ issue: trackedIssue() }));

    expect(runCalled).toBe(false);
    expect(result._tag).toBe("Failure");
    expect(String(result)).toContain("Agent auth env file missing required keys: OPENAI_API_KEY");
  });

  it("runs implementation in the prepared workspace with MR and contract context", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    const calls: Array<{ cwd?: string; prompt?: string; name?: string }> = [];
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      agent: {
        name: "fake",
        env: {},
        captureSessions: false,
        buildPrintCommand: () => ({ command: "fake" }),
        parseStreamLine: () => [],
      },
      sandbox: {
        kind: "none",
        exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
        close: async () => ({}),
      } as never,
      run: async (options) => {
        calls.push({
          cwd: options.cwd,
          prompt: options.prompt,
          name: options.name,
        });
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
      agent: {
        name: "fake",
        env: {},
        captureSessions: false,
        buildPrintCommand: () => ({ command: "fake" }),
        parseStreamLine: () => [],
      },
      sandbox: {
        kind: "none",
        exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
        close: async () => ({}),
      } as never,
      run: async (options) => {
        calls.push({
          cwd: options.cwd,
          prompt: options.prompt,
          name: options.name,
        });
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
        implementationEvidence: [
          {
            summary: "Adapter added",
            files: ["packages/adapters/src/index.ts"],
          },
        ],
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
