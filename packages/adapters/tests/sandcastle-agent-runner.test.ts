import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { deriveIssueState, deriveLane } from "@morpheus/core";
import { Effect, Either, Layer } from "effect";
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
  type RunSummary,
  type TrackedIssue,
  type WorkspaceRuntimeService,
} from "@morpheus/runtime";

const trackedIssue = (labels: readonly string[] = ["agent:ready"]): TrackedIssue => {
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
              message: "Sandcastle docker cannot connect to the Docker daemon",
            }),
          ),
      },
    });

    const result = await Effect.runPromise(Effect.either(runner.checkAccess?.() ?? Effect.void));

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isRight(result)) {
      throw new Error("expected docker access failure");
    }
    expect(result.left.operation).toBe("sandcastle.docker");
    expect(result.left.failureKind).toBe("operator_access");
    expect(result.left.message).toContain("Docker-compatible runtime unavailable");
    expect(result.left.publicMessage).toContain("Morpheus container runner access check failed");
    expect(result.left.publicMessage).toContain("Docker-compatible runtime unavailable");
    expect(result.left.publicMessage).not.toMatch(/sandcastle/i);
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
    let labels = ["agent:ready"];
    const issueTracker: IssueTrackerService = {
      listRunnableIssues: () => Effect.succeed([trackedIssue(labels)]),
      getIssue: () => Effect.succeed(trackedIssue(labels)),
      applyAgentState: (issueId, transitionPlan) => {
        if (transitionPlan.status !== "planned") {
          return Effect.succeed({
            status: "rejected" as const,
            issueId,
            reason: transitionPlan.status,
            plan: transitionPlan,
          });
        }
        labels = [...transitionPlan.finalLabels];
        return Effect.succeed({
          status: "applied" as const,
          issueId,
          addLabels: transitionPlan.addLabels,
          removeLabels: transitionPlan.removeLabels,
        });
      },
      writeContract: () => Effect.die("writeContract should not run before Docker preflight"),
      readContract: () => Effect.die("readContract should not run before Docker preflight"),
      listImportedGitLabIssues: () => Effect.succeed([]),
      upsertImportedGitLabIssue: () => Effect.die("upsertImportedGitLabIssue should not run"),
    };
    const gitlabIssueSource: GitLabIssueSourceService = {
      listReadyIssues: () => Effect.succeed([]),
      listLifecycleIssues: () => Effect.succeed([]),
      updateIssueLabels: () => Effect.succeed(undefined),
    };
    let run: RunSummary = {
      id: "run_preflight",
      issueId: "morph-bbp",
      lane: "preparation",
      status: "running",
      summary: "Add real Sandcastle agent runner adapter",
      startedAt: "2026-05-28T00:00:00.000Z",
    };
    const runLedger: RunLedgerService = {
      createPreparationRun: (input) => {
        run = { ...run, issueId: input.issueId, summary: input.summary };
        return Effect.succeed(run);
      },
      createImplementationRun: () => Effect.die("createImplementationRun should not run"),
      createReviewRun: () => Effect.die("createReviewRun should not run"),
      recordImplementationWorkspace: () =>
        Effect.die("recordImplementationWorkspace should not run"),
      recordMergeRequest: () => Effect.die("recordMergeRequest should not run"),
      finishRun: (_runId, input) => {
        run = {
          ...run,
          status: input.status,
          failureKind: input.status === "failed" ? input.failureKind : undefined,
          endedAt: "2026-05-28T00:00:01.000Z",
        };
        return Effect.succeed(run);
      },
      writeRunArtifacts: () => {
        run = {
          ...run,
          transcriptPath: "/tmp/run_preflight.txt",
          artifactPath: "/tmp/run_preflight.json",
        };
        return Effect.succeed(run);
      },
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
      finalizeImplementationWorkspace: () =>
        Effect.die("finalizeImplementationWorkspace should not run"),
      prepareReviewWorkspace: () => Effect.die("prepareReviewWorkspace should not run"),
    };
    const mergeRequests: MergeRequestClientService = {
      createDraftMergeRequest: () => Effect.die("createDraftMergeRequest should not run"),
      findOpenMergeRequestForSourceIssue: () =>
        Effect.die("findOpenMergeRequestForSourceIssue should not run"),
      inspectGate: () => Effect.die("inspectGate should not run"),
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
    expect(labels).toEqual(["agent:failed"]);
    expect(run).toMatchObject({
      status: "failed",
      failureKind: "operator_access",
      transcriptPath: "/tmp/run_preflight.txt",
      artifactPath: "/tmp/run_preflight.json",
    });
  });

  it("maps missing container image guidance to the Morpheus build command", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      containerConfig: {
        image: "morpheus-agent:local",
        profile: ".morpheus/container/Dockerfile",
        mounts: [],
      },
      run: async () => {
        throw new Error(
          "Provider 'docker' create failed: Image 'morpheus-agent:local' not found locally. Build it first with 'sandcastle docker build-image'.",
        );
      },
    });

    const result = await Effect.runPromise(
      Effect.either(runner.prepareIssue({ issue: trackedIssue() })),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isRight(result)) {
      throw new Error("expected missing image failure");
    }
    expect(result.left.publicMessage).toContain(
      "docker build -f .morpheus/container/Dockerfile -t morpheus-agent:local .",
    );
    expect(result.left.publicMessage).not.toMatch(/sandcastle/i);
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

  it("maps the first complete JSON value inside tagged output", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    const payload = JSON.stringify({
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
    });
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
      run: async () => ({
        iterations: [],
        stdout: `<morpheus_result>${payload}}\nAgent stopped</morpheus_result>`,
        commits: [],
        branch: "agent/morph-bbp",
      }),
    });

    const result = await Effect.runPromise(runner.prepareIssue({ issue: trackedIssue() }));

    expect(result.status).toBe("prepared");
  });

  it("runs implementation in the prepared worktree, not the base checkout", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    const worktreePath = join(dir, "../.morpheus-worktree-run_123");
    const calls: Array<{ cwd?: string }> = [];
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
        calls.push({ cwd: options.cwd });
        return {
          iterations: [],
          stdout: `<morpheus_result>{"status":"implemented","implementationEvidence":[],"verificationEvidence":[],"transcript":"","artifact":{}}</morpheus_result>`,
          commits: [],
          branch: "morpheus/morph-bbp-run_123",
        };
      },
    });

    const effect = runner.implementIssue?.({
      issue: trackedIssue(),
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
      workspace: {
        workspacePath: dir,
        worktreePath,
        branch: "morpheus/morph-bbp-run_123",
        targetBranch: "dev",
        remote: "origin",
      },
      mergeRequest: {
        reference: "!42",
        url: "https://example.invalid/group/project/mr/42",
      },
    });
    await Effect.runPromise(effect ?? Effect.die("missing implementIssue"));

    expect(calls).toEqual([{ cwd: worktreePath }]);
  });

  it("normalizes Sandcastle implementation commit objects into commit ids", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
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
      run: async () => ({
        iterations: [],
        stdout: `<morpheus_result>{"status":"implemented","implementationEvidence":[{"summary":"Changed README","files":["README.md"]}],"verificationEvidence":[{"command":"true","status":"passed"}],"transcript":"","artifact":{}}</morpheus_result>`,
        commits: [{ sha: "326eeb67eface000000000000000000000000000" }],
        branch: "morpheus/morph-bbp-run_123",
      }),
    });

    const result = await Effect.runPromise(
      runner.implementIssue?.({
        issue: trackedIssue(),
        contract: {
          category: "task",
          summary: "Prepared",
          currentBehavior: "Before",
          desiredBehavior: "After",
          keyInterfaces: ["AgentRunner"],
          acceptanceCriteria: ["Runs"],
          outOfScope: ["None"],
          verificationPlan: ["true"],
          blockedBy: "None",
          hitlDecisions: "None",
          riskLevel: "medium",
        },
        workspace: {
          workspacePath: dir,
          worktreePath: dir,
          branch: "morpheus/morph-bbp-run_123",
          targetBranch: "dev",
          remote: "origin",
        },
        mergeRequest: { reference: "!42" },
      }) ?? Effect.die("missing implementIssue"),
    );

    expect((result as { readonly artifact: unknown }).artifact).toMatchObject({
      commits: ["326eeb67eface000000000000000000000000000"],
    });
  });

  it("falls back to host git commit detection when Sandcastle omits implementation commits", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-git-"));
    execFileSync("git", ["-C", dir, "init", "-b", "dev"]);
    execFileSync("git", ["-C", dir, "config", "user.email", "morpheus@example.invalid"]);
    execFileSync("git", ["-C", dir, "config", "user.name", "Morpheus Test"]);
    writeFileSync(join(dir, "README.md"), "base\n");
    execFileSync("git", ["-C", dir, "add", "README.md"]);
    execFileSync("git", ["-C", dir, "commit", "-m", "base"]);
    execFileSync("git", ["-C", dir, "checkout", "-b", "morpheus/morph-bbp-run_123"]);
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
      run: async () => {
        writeFileSync(join(dir, "README.md"), "base\nchange\n");
        execFileSync("git", ["-C", dir, "add", "README.md"]);
        execFileSync("git", ["-C", dir, "commit", "-m", "change"]);
        return {
          iterations: [],
          stdout: `<morpheus_result>{"status":"implemented","implementationEvidence":[{"summary":"Changed README","files":["README.md"]}],"verificationEvidence":[{"command":"true","status":"passed"}],"transcript":"","artifact":{}}</morpheus_result>`,
          commits: [],
          branch: "morpheus/morph-bbp-run_123",
        };
      },
    });

    const result = await Effect.runPromise(
      runner.implementIssue?.({
        issue: trackedIssue(),
        contract: {
          category: "task",
          summary: "Prepared",
          currentBehavior: "Before",
          desiredBehavior: "After",
          keyInterfaces: ["AgentRunner"],
          acceptanceCriteria: ["Runs"],
          outOfScope: ["None"],
          verificationPlan: ["true"],
          blockedBy: "None",
          hitlDecisions: "None",
          riskLevel: "medium",
        },
        workspace: {
          workspacePath: dir,
          worktreePath: dir,
          branch: "morpheus/morph-bbp-run_123",
          targetBranch: "dev",
          remote: "origin",
        },
        mergeRequest: { reference: "!42" },
      }) ?? Effect.die("missing implementIssue"),
    );

    expect((result as { readonly artifact: unknown }).artifact).toMatchObject({
      commits: [expect.stringMatching(/^[0-9a-f]{40}$/)],
    });
  });

  it("mounts the prepared worktree for Docker-backed implementation runs", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    mkdirSync(join(dir, "node_modules", ".vite-temp"), { recursive: true });
    mkdirSync(join(dir, ".morpheus", "skills"), { recursive: true });
    writeFileSync(
      join(dir, "agent.env"),
      "OPENAI_API_KEY=test-token\nEXTRA_TOKEN=must-not-enter-container\n",
    );
    const worktreePath = join(dir, "../.morpheus-worktree-run_123");
    const dockerOptions: unknown[] = [];
    const runOptions: Array<{ cwd?: string; prompt?: string }> = [];
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      auth: { kind: "api-key", envFile: "agent.env", requiredKeys: ["OPENAI_API_KEY"] },
      containerConfig: {
        image: "morpheus-agent:test",
        mounts: [{ hostPath: ".", containerPath: "/workspace" }],
      },
      agentConfig: {
        provider: "codex",
        model: "gpt-5.4-mini",
        effort: "xhigh",
        idleTimeoutSeconds: 1800,
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
        runOptions.push({ cwd: options.cwd, prompt: options.prompt });
        return {
          iterations: [],
          stdout: `<morpheus_result>{"status":"implemented","implementationEvidence":[],"verificationEvidence":[],"transcript":"","artifact":{}}</morpheus_result>`,
          commits: [],
          branch: "morpheus/morph-bbp-run_123",
        };
      },
    });

    const effect = runner.implementIssue?.({
      issue: trackedIssue(),
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
      workspace: {
        workspacePath: dir,
        worktreePath,
        branch: "morpheus/morph-bbp-run_123",
        targetBranch: "dev",
        remote: "origin",
      },
      mergeRequest: {
        reference: "!42",
        url: "https://example.invalid/group/project/mr/42",
      },
    });
    await Effect.runPromise(effect ?? Effect.die("missing implementIssue"));

    expect(dockerOptions).toHaveLength(1);
    expect(dockerOptions[0]).toMatchObject({
      mounts: expect.arrayContaining([
        { hostPath: dir, sandboxPath: "/workspace", readonly: true },
        { hostPath: worktreePath, sandboxPath: worktreePath, readonly: false },
        {
          hostPath: join(dir, "node_modules"),
          sandboxPath: "/home/agent/workspace/node_modules",
          readonly: true,
        },
        {
          hostPath: join(dir, ".morpheus", "skills"),
          sandboxPath: "/opt/morpheus/.morpheus/skills",
          readonly: true,
        },
        expect.objectContaining({
          sandboxPath: "/home/agent/workspace/node_modules/.vite-temp",
          readonly: false,
        }),
      ]),
      env: expect.objectContaining({
        XDG_CACHE_HOME: "/tmp/morpheus-cache",
        npm_config_cache: "/tmp/morpheus-cache/npm",
        PNPM_HOME: "/tmp/morpheus-cache/pnpm",
        PNPM_STORE_DIR: "/tmp/morpheus-cache/pnpm-store",
        pnpm_config_verify_deps_before_run: "false",
      }),
    });
    expect(runOptions[0]?.prompt).toContain(
      "Implementation root (edit and verify here ONLY): /home/agent/workspace",
    );
    expect(runOptions[0]?.prompt).toContain(
      "Host workspace (do not edit for implementation): /workspace",
    );
    expect(runOptions[0]?.prompt).toContain(
      "/opt/morpheus/.morpheus/skills/matt-pocock-tdd/SKILL.md",
    );
    expect(runOptions[0]?.prompt).toContain(
      "Read stage skills from the exact required container paths before trying repo-relative skill paths.",
    );
  });

  it("runs Docker-backed preparation in a disposable external worktree", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    execFileSync("git", ["-C", dir, "init", "-b", "dev"]);
    execFileSync("git", ["-C", dir, "config", "user.email", "morpheus@example.invalid"]);
    execFileSync("git", ["-C", dir, "config", "user.name", "Morpheus Test"]);
    writeFileSync(join(dir, "README.md"), "base\n");
    execFileSync("git", ["-C", dir, "add", "README.md"]);
    execFileSync("git", ["-C", dir, "commit", "-m", "base"]);
    const copiedSkillPath = join(".morpheus", "skills", "matt-pocock-to-spec", "SKILL.md");
    mkdirSync(join(dir, copiedSkillPath, ".."), { recursive: true });
    writeFileSync(join(dir, copiedSkillPath), "# Test skill\n");
    const initialStatus = execFileSync("git", ["-C", dir, "status", "--porcelain"], {
      encoding: "utf8",
    });
    const calls: Array<{ branchStrategy?: unknown; cwd?: string; prompt?: string }> = [];
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      containerConfig: {
        image: "morpheus-agent:test",
        mounts: [{ hostPath: ".", containerPath: "/workspace" }],
      },
      dockerFactory: () =>
        ({
          kind: "none",
          exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
          close: async () => ({}),
        }) as never,
      run: async (options) => {
        calls.push({
          branchStrategy: options.branchStrategy,
          cwd: options.cwd,
          prompt: options.prompt,
        });
        expect(existsSync(join(options.cwd ?? dir, copiedSkillPath))).toBe(true);
        mkdirSync(join(options.cwd ?? dir, ".sandcastle", "worktrees"), { recursive: true });
        return {
          iterations: [],
          stdout: `<morpheus_result>{"status":"blocked","reason":"fixture","transcript":"","artifact":{}}</morpheus_result>`,
          commits: [],
          branch: "dev",
        };
      },
    });

    await Effect.runPromise(runner.prepareIssue({ issue: trackedIssue() }));

    expect(calls).toHaveLength(1);
    expect(calls[0]?.branchStrategy).toBeUndefined();
    expect(calls[0]?.cwd).toMatch(/\.morpheus-readonly-worktree-/);
    expect(calls[0]?.cwd).not.toBe(dir);
    expect(existsSync(calls[0]?.cwd ?? "")).toBe(false);
    expect(calls[0]?.prompt).toContain("/workspace/.morpheus/skills/matt-pocock-to-spec/SKILL.md");
    expect(execFileSync("git", ["-C", dir, "status", "--porcelain"], { encoding: "utf8" })).toBe(
      initialStatus,
    );
    expect(existsSync(join(dir, ".sandcastle"))).toBe(false);
    expect(
      execFileSync("git", ["-C", dir, "worktree", "list", "--porcelain"], {
        encoding: "utf8",
      }),
    ).not.toContain(".morpheus-readonly-worktree-");
  });

  it("does not remove a live preparation worktree owned by another process", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    execFileSync("git", ["-C", dir, "init", "-b", "dev"]);
    execFileSync("git", ["-C", dir, "config", "user.email", "morpheus@example.invalid"]);
    execFileSync("git", ["-C", dir, "config", "user.name", "Morpheus Test"]);
    writeFileSync(join(dir, "README.md"), "base\n");
    execFileSync("git", ["-C", dir, "add", "README.md"]);
    execFileSync("git", ["-C", dir, "commit", "-m", "base"]);
    const liveOwner = spawn(process.execPath, ["-e", "setInterval(() => {}, 1_000)"], {
      stdio: "ignore",
    });
    if (liveOwner.pid === undefined) {
      throw new Error("live owner process did not start");
    }
    const liveWorktreePath = resolve(
      dirname(dir),
      `.morpheus-readonly-worktree-${liveOwner.pid}-external-live`,
    );
    execFileSync("git", ["-C", dir, "worktree", "add", "--detach", liveWorktreePath, "HEAD"]);

    try {
      const runner = createSandcastleAgentRunner({
        cwd: dir,
        logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
        containerConfig: {
          image: "morpheus-agent:test",
          mounts: [{ hostPath: ".", containerPath: "/workspace" }],
        },
        dockerFactory: () =>
          ({
            kind: "none",
            exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
            close: async () => ({}),
          }) as never,
        run: async () => ({
          iterations: [],
          stdout: `<morpheus_result>{"status":"blocked","reason":"fixture","transcript":"","artifact":{}}</morpheus_result>`,
          commits: [],
          branch: "dev",
        }),
      });

      await Effect.runPromise(runner.prepareIssue({ issue: trackedIssue() }));

      expect(existsSync(liveWorktreePath)).toBe(true);
    } finally {
      try {
        execFileSync("git", ["-C", dir, "worktree", "remove", "--force", liveWorktreePath]);
      } catch {
        // The assertion above reports an unsafe removal; cleanup stays best-effort.
      }
      liveOwner.kill();
    }
  });

  it("removes a stale preparation worktree owned by a dead process", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    execFileSync("git", ["-C", dir, "init", "-b", "dev"]);
    execFileSync("git", ["-C", dir, "config", "user.email", "morpheus@example.invalid"]);
    execFileSync("git", ["-C", dir, "config", "user.name", "Morpheus Test"]);
    writeFileSync(join(dir, "README.md"), "base\n");
    execFileSync("git", ["-C", dir, "add", "README.md"]);
    execFileSync("git", ["-C", dir, "commit", "-m", "base"]);
    const deadOwnerPid = await new Promise<number>((resolvePid, rejectPid) => {
      const deadOwner = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
      const pid = deadOwner.pid;
      deadOwner.once("error", rejectPid);
      deadOwner.once("exit", () => {
        if (pid === undefined) {
          rejectPid(new Error("dead owner process did not start"));
          return;
        }
        resolvePid(pid);
      });
    });
    const staleWorktreePath = resolve(
      dirname(dir),
      `.morpheus-readonly-worktree-${deadOwnerPid}-stale`,
    );
    execFileSync("git", ["-C", dir, "worktree", "add", "--detach", staleWorktreePath, "HEAD"]);
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      containerConfig: {
        image: "morpheus-agent:test",
        mounts: [{ hostPath: ".", containerPath: "/workspace" }],
      },
      dockerFactory: () =>
        ({
          kind: "none",
          exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
          close: async () => ({}),
        }) as never,
      run: async () => ({
        iterations: [],
        stdout: `<morpheus_result>{"status":"blocked","reason":"fixture","transcript":"","artifact":{}}</morpheus_result>`,
        commits: [],
        branch: "dev",
      }),
    });

    await Effect.runPromise(runner.prepareIssue({ issue: trackedIssue() }));

    expect(existsSync(staleWorktreePath)).toBe(false);
  });

  it("rejects symlinked managed container mount sources", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    const outside = mkdtempSync(join(tmpdir(), "morpheus-outside-"));
    const worktreePath = join(dir, "worktree");
    mkdirSync(worktreePath, { recursive: true });
    symlinkSync(outside, join(dir, "node_modules"), "dir");
    let dockerCreated = false;
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      containerConfig: {
        image: "morpheus-agent:test",
        mounts: [{ hostPath: ".", containerPath: "/workspace" }],
      },
      dockerFactory: () => {
        dockerCreated = true;
        return {
          kind: "none",
          exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
          close: async () => ({}),
        } as never;
      },
      run: async () => {
        throw new Error("runner must not start");
      },
    });

    const result = await Effect.runPromise(
      Effect.either(
        runner.implementIssue?.({
          issue: trackedIssue(["agent:prepared"]),
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
          workspace: {
            workspacePath: dir,
            worktreePath,
            branch: "morpheus/morph-bbp-run_123",
            targetBranch: "dev",
            remote: "origin",
          },
          mergeRequest: {
            reference: "!42",
            url: "https://example.invalid/group/project/mr/42",
          },
        }) ?? Effect.die("missing implementIssue"),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left.message).toContain(
        "Managed container mount source must not be a symbolic link",
      );
    }
    expect(dockerCreated).toBe(false);
  });

  it("rejects managed container mounts that escape through an intermediate symlink", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    const outside = mkdtempSync(join(tmpdir(), "morpheus-outside-"));
    const worktreePath = join(dir, "worktree");
    mkdirSync(worktreePath, { recursive: true });
    mkdirSync(join(outside, "skills"), { recursive: true });
    symlinkSync(outside, join(dir, ".morpheus"), "dir");
    let dockerCreated = false;
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, "sandcastle-logs"),
      containerConfig: {
        image: "morpheus-agent:test",
        mounts: [{ hostPath: ".", containerPath: "/workspace" }],
      },
      dockerFactory: () => {
        dockerCreated = true;
        return {
          kind: "none",
          exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
          close: async () => ({}),
        } as never;
      },
      run: async () => {
        throw new Error("runner must not start");
      },
    });

    const result = await Effect.runPromise(
      Effect.either(
        runner.implementIssue?.({
          issue: trackedIssue(["agent:prepared"]),
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
          workspace: {
            workspacePath: dir,
            worktreePath,
            branch: "morpheus/morph-bbp-run_123",
            targetBranch: "dev",
            remote: "origin",
          },
          mergeRequest: {
            reference: "!42",
            url: "https://example.invalid/group/project/mr/42",
          },
        }) ?? Effect.die("missing implementIssue"),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left.message).toContain(
        "Managed container mount source must stay inside the target repo",
      );
    }
    expect(dockerCreated).toBe(false);
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
    expect(calls[0]?.prompt).toContain(".morpheus/skills/matt-pocock-to-spec/SKILL.md");
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
            name: "matt-pocock-to-spec",
            path: ".morpheus/skills/matt-pocock-to-spec/SKILL.md",
          },
          {
            name: "matt-pocock-grilling",
            path: ".morpheus/skills/matt-pocock-grilling/SKILL.md",
          },
          {
            name: "matt-pocock-grill-with-docs",
            path: ".morpheus/skills/matt-pocock-grill-with-docs/SKILL.md",
          },
          {
            name: "matt-pocock-to-tickets",
            path: ".morpheus/skills/matt-pocock-to-tickets/SKILL.md",
          },
          {
            name: "matt-pocock-tdd",
            path: ".morpheus/skills/matt-pocock-tdd/SKILL.md",
          },
          {
            name: "matt-pocock-diagnosing-bugs",
            path: ".morpheus/skills/matt-pocock-diagnosing-bugs/SKILL.md",
          },
        ],
        stageMappings: {
          prepare: [
            "matt-pocock-to-spec",
            "matt-pocock-grilling",
            "matt-pocock-grill-with-docs",
            "matt-pocock-to-tickets",
          ],
          implement: ["matt-pocock-tdd", "matt-pocock-diagnosing-bugs"],
          review: ["matt-pocock-diagnosing-bugs"],
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
      ".morpheus/skills/matt-pocock-to-spec/SKILL.md",
    );
    expect(stageSkillBlock(preparePrompt ?? "", "prepare")).toContain(
      ".morpheus/skills/matt-pocock-grilling/SKILL.md",
    );
    expect(stageSkillBlock(preparePrompt ?? "", "prepare")).toContain(
      ".morpheus/skills/matt-pocock-to-tickets/SKILL.md",
    );
    expect(stageSkillBlock(implementPrompt ?? "", "implement")).toContain(
      ".morpheus/skills/matt-pocock-tdd/SKILL.md",
    );
    expect(stageSkillBlock(implementPrompt ?? "", "implement")).toContain(
      ".morpheus/skills/matt-pocock-diagnosing-bugs/SKILL.md",
    );
    expect(stageSkillBlock(reviewPrompt ?? "", "review")).toContain(
      ".morpheus/skills/matt-pocock-diagnosing-bugs/SKILL.md",
    );
    expect(reviewPrompt).toContain("Verify contract acceptance criteria");
    expect(reviewPrompt).toContain(
      '{"status":"failed","failureKind":"verification_error","message":"...","findings":[],"transcript":"...","artifact":{}}',
    );
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
            name: "matt-pocock-tdd",
            path: ".morpheus/skills/matt-pocock-tdd/SKILL.md",
          },
        ],
        stageMappings: {
          prepare: ["missing-skill"],
          implement: ["matt-pocock-tdd"],
          review: ["matt-pocock-tdd"],
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
            name: "matt-pocock-tdd",
            path: ".morpheus/skills/matt-pocock-tdd/SKILL.md",
          },
        ],
        stageMappings: {
          prepare: [],
          implement: ["matt-pocock-tdd"],
          review: ["matt-pocock-tdd"],
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
        mappings: [{ name: "matt-pocock-tdd", path: "" }],
        stageMappings: {
          prepare: ["matt-pocock-tdd"],
          implement: ["matt-pocock-tdd"],
          review: ["matt-pocock-tdd"],
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
      "Stage skill mapping references copied skill without path: prepare:matt-pocock-tdd",
    );
  });

  it("constructs Codex provider and Docker sandbox from configured auth and container settings", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    writeFileSync(
      join(dir, "agent.env"),
      "OPENAI_API_KEY=test-token\nEXTRA_TOKEN=must-not-enter-container\n",
    );
    const commands: string[] = [];
    const stdins: Array<string | undefined> = [];
    const dockerOptions: unknown[] = [];
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      auth: { kind: "api-key", envFile: "agent.env", requiredKeys: ["OPENAI_API_KEY"] },
      containerConfig: {
        image: "morpheus-agent:test",
        profile: ".morpheus/container/Dockerfile",
        mounts: [{ hostPath: ".cache", containerPath: "/cache", readOnly: true }],
      },
      agentConfig: {
        provider: "codex",
        model: "gpt-5.4-mini",
        effort: "xhigh",
        idleTimeoutSeconds: 1800,
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
        const printCommand = options.agent.buildPrintCommand({
          prompt: "prompt",
          dangerouslySkipPermissions: true,
        });
        commands.push(printCommand.command);
        stdins.push(printCommand.stdin);
        expect(options.idleTimeoutSeconds).toBe(1800);
        return {
          iterations: [],
          stdout: `<morpheus_result>{"status":"blocked","reason":"x","transcript":"","artifact":{}}</morpheus_result>`,
          commits: [],
          branch: "agent/morph-bbp",
        };
      },
    });

    await Effect.runPromise(runner.prepareIssue({ issue: trackedIssue() }));

    expect(commands).toHaveLength(1);
    expect(commands[0]).toContain("codex login --with-api-key");
    expect(commands[0]).toContain(
      `codex exec --json --dangerously-bypass-approvals-and-sandbox -m`,
    );
    expect(commands[0]).toContain("gpt-5.4-mini");
    expect(commands[0]).toContain('model_reasoning_effort="xhigh"');
    expect(stdins).toEqual(["prompt"]);
    expect(dockerOptions).toEqual([
      {
        imageName: "morpheus-agent:test",
        containerUid: 0,
        containerGid: 0,
        mounts: [{ hostPath: join(dir, ".cache"), sandboxPath: "/cache", readonly: true }],
        env: {
          OPENAI_API_KEY: "test-token",
          CODEX_HOME: "/home/agent/morpheus-codex",
          HOME: "/home/agent",
          XDG_CONFIG_HOME: "/home/agent/.config",
        },
      },
    ]);
  });

  it("mounts Morpheus-owned ChatGPT auth without API-key login or token env", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    const authHome = join(dir, "operator-auth", "codex");
    mkdirSync(authHome, { recursive: true });
    writeFileSync(join(authHome, "auth.json"), "{}\n");
    const commands: string[] = [];
    const dockerOptions: unknown[] = [];
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "agent-logs"),
      auth: { kind: "chatgpt" },
      codexAuthHome: authHome,
      containerConfig: {
        image: "morpheus-agent:test",
        mounts: [],
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

    expect(commands[0]).toContain("codex exec");
    expect(commands[0]).not.toContain("codex login --with-api-key");
    expect(dockerOptions).toEqual([
      expect.objectContaining({
        mounts: [
          {
            hostPath: join(authHome, "auth.json"),
            sandboxPath: "/home/agent/morpheus-codex/auth.json",
            readonly: false,
          },
        ],
        env: {
          CODEX_HOME: "/home/agent/morpheus-codex",
          HOME: "/home/agent",
          XDG_CONFIG_HOME: "/home/agent/.config",
        },
      }),
    ]);
  });

  it("redacts the host subscription auth path from runner failures", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    const authHome = join(dir, "operator-auth", "codex");
    mkdirSync(authHome, { recursive: true });
    writeFileSync(join(authHome, "auth.json"), "{}\n");
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "agent-logs"),
      auth: { kind: "chatgpt" },
      codexAuthHome: authHome,
      run: async () => {
        throw new Error(`Cannot mount ${authHome}`);
      },
    });

    const result = await Effect.runPromise(
      Effect.either(runner.prepareIssue({ issue: trackedIssue() })),
    );
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isRight(result)) {
      throw new Error("expected runner failure");
    }
    expect(result.left.message).not.toContain(authHome);
    expect(result.left.publicMessage).not.toContain(authHome);
    expect(result.left.message).toContain("<morpheus-codex-auth>");
  });

  it("serializes concurrent runs that share one ChatGPT auth store", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    const authHome = join(dir, "operator-auth", "codex");
    mkdirSync(authHome, { recursive: true });
    writeFileSync(join(authHome, "auth.json"), "{}\n");
    let active = 0;
    let maxActive = 0;
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "agent-logs"),
      auth: { kind: "chatgpt" },
      codexAuthHome: authHome,
      agent: {
        name: "fake",
        buildPrintCommand: () => ({ command: "fake" }),
        parseStreamLine: () => [],
      } as never,
      sandbox: {
        kind: "none",
        exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
        close: async () => ({}),
      } as never,
      run: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 10));
        active -= 1;
        return {
          iterations: [],
          stdout: `<morpheus_result>{"status":"blocked","reason":"x","transcript":"","artifact":{}}</morpheus_result>`,
          commits: [],
          branch: "agent/morph-bbp",
        };
      },
    });

    await Promise.all([
      Effect.runPromise(runner.prepareIssue({ issue: trackedIssue() })),
      Effect.runPromise(runner.prepareIssue({ issue: trackedIssue() })),
    ]);

    expect(maxActive).toBe(1);
  });

  it("fails before running when configured auth env file is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    let runCalled = false;
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      auth: {
        kind: "api-key",
        envFile: ".morpheus/secrets/agent.env",
        requiredKeys: ["OPENAI_API_KEY"],
      },
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

    const result = await Effect.runPromise(
      Effect.either(runner.prepareIssue({ issue: trackedIssue() })),
    );

    expect(runCalled).toBe(false);
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isRight(result)) {
      throw new Error("expected missing auth env failure");
    }
    expect(result.left.operation).toBe("sandcastle.prepare");
    expect(result.left.failureKind).toBe("operator_access");
    expect(result.left.message).toContain("Agent auth env file not found");
    expect(result.left.publicMessage).toContain("Morpheus agent runner auth failed");
    expect(result.left.message).not.toContain(dir);
    expect(result.left.publicMessage).not.toContain(dir);
    expect(result.left.publicMessage).not.toMatch(/sandcastle/i);
  });

  it("fails before running when Codex auth env file lacks OPENAI_API_KEY", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    writeFileSync(join(dir, "agent.env"), "OTHER_TOKEN=test\n");
    let runCalled = false;
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      auth: { kind: "api-key", envFile: "agent.env", requiredKeys: ["OPENAI_API_KEY"] },
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

  it("fails before running when Codex auth env file sets CODEX_HOME", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    writeFileSync(join(dir, "agent.env"), "OPENAI_API_KEY=test-token\nCODEX_HOME=/host/.codex\n");
    let runCalled = false;
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      auth: { kind: "api-key", envFile: "agent.env", requiredKeys: ["OPENAI_API_KEY"] },
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
    expect(String(result)).toContain(
      "Codex agent auth env file must not set CODEX_HOME; use OPENAI_API_KEY only",
    );
  });

  it("maps Sandcastle phase failures to public Morpheus runner messages", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    writeFileSync(join(dir, "agent.env"), "OPENAI_API_KEY=test-token\n");
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      auth: { kind: "api-key", envFile: "agent.env", requiredKeys: ["OPENAI_API_KEY"] },
      run: async () => {
        throw new Error("Sandcastle prepare phase exploded");
      },
    });

    const result = await Effect.runPromise(
      Effect.either(runner.prepareIssue({ issue: trackedIssue() })),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isRight(result)) {
      throw new Error("expected phase failure");
    }
    expect(result.left.operation).toBe("sandcastle.prepare");
    expect(result.left.failureKind).toBe("runtime_error");
    expect(result.left.message).toContain("Sandcastle prepare phase exploded");
    expect(result.left.publicMessage).toContain("Morpheus agent runner failed during prepare");
    expect(result.left.publicMessage).not.toMatch(/sandcastle/i);
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

    expect(calls[0].cwd).toBe("/worktree/morph-bbp");
    expect(calls[0].name).toBe("morpheus-implement-morph-bbp");
    expect(calls[0].prompt).toContain(
      "Implementation root (edit and verify here ONLY): /worktree/morph-bbp",
    );
    expect(calls[0].prompt).toContain(
      "Host workspace (do not edit for implementation): /workspace/morph-bbp",
    );
    expect(calls[0].prompt).toContain("Branch: agent/morph-bbp");
    expect(calls[0].prompt).toContain("Merge request: !42");
    expect(calls[0].prompt).toContain("Implement real adapter");
    expect(calls[0].prompt).toContain(
      "If an exploratory repository-wide check fails only on pre-existing files outside the implementation diff, record it in the transcript, not as failed verification evidence.",
    );
    expect(calls[0].prompt).toContain("Do not run glab.");
  });

  it("runs review in the prepared review workspace with implementation evidence", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-sandcastle-"));
    const calls: Array<{ cwd?: string; prompt?: string; name?: string }> = [];
    const runner = createSandcastleAgentRunner({
      cwd: dir,
      logDirectory: join(dir, ".morpheus", "sandcastle-logs"),
      containerConfig: {
        image: "morpheus-agent:test",
        mounts: [{ hostPath: ".", containerPath: "/workspace", readOnly: true }],
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
          worktreePath: "/worktree/morph-bbp",
          branch: "agent/morph-bbp",
          targetBranch: "main",
          remote: "origin",
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

    expect(calls[0].cwd).toBe("/worktree/morph-bbp");
    expect(calls[0].name).toBe("morpheus-review-morph-bbp");
    expect(calls[0].prompt).toContain("Permissions: read-only");
    expect(calls[0].prompt).toContain(
      "Inspect the Worktree/MR tip only; never infer implementation state from the host Workspace/base checkout.",
    );
    expect(calls[0].prompt).toContain("git -C /worktree/morph-bbp diff --stat origin/main...HEAD");
    expect(calls[0].prompt).toContain('{"severity":"info|warning|error","summary":"..."}');
    expect(calls[0].prompt).toContain(
      "check these configured container roots before proceeding: /workspace",
    );
    expect(calls[0].prompt).toContain("Implementation evidence:");
    expect(calls[0].prompt).toContain("Adapter added");
    expect(calls[0].prompt).toContain("Verification evidence:");
    expect(calls[0].prompt).toContain(
      '{"status":"blocked","reason":"...","findings":[],"transcript":"...","artifact":{}}',
    );
  });
});
