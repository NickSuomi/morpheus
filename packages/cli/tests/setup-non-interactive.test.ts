import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { planMorpheusSetup } from "@morpheus/runtime";
import { describe, expect, it } from "vitest";
import {
  buildNonInteractiveSetupAnswers,
  readSetupConfigInput,
  setupPlanWantsContainerBuild,
} from "../src/setup-non-interactive.js";

const withJsonFile = <T>(contents: string, fn: (path: string) => T) => {
  const dir = mkdtempSync(join(tmpdir(), "morpheus-setup-input-"));
  try {
    const path = join(dir, "setup.json");
    writeFileSync(path, contents);
    return fn(path);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
};

describe("non-interactive setup options", () => {
  it("maps scriptable flags to setup answers without leaking secret values", () => {
    const result = buildNonInteractiveSetupAnswers({
      yes: true,
      dryRun: false,
      noBuild: true,
      gitlabProject: "group/project",
      targetBranch: "main",
      gitlabReadyLabel: "agent:ready",
      authEnvFile: ".morpheus/secrets/agent.env",
      requiredAuthKey: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"],
      containerImage: "morpheus-agent:ci",
      containerProfile: ".morpheus/container/Dockerfile",
      verificationCommand: ["pnpm test", "pnpm typecheck"],
      pollIntervalSeconds: 15,
      authSecret: "OPENAI_API_KEY=real-token",
    });

    expect(result).toEqual({
      gitlabProject: "group/project",
      targetBranch: "main",
      readyLabel: "agent:ready",
      authEnvFile: ".morpheus/secrets/agent.env",
      requiredAuthKeys: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"],
      containerImage: "morpheus-agent:ci",
      containerProfile: ".morpheus/container/Dockerfile",
      verificationCommands: ["pnpm test", "pnpm typecheck"],
      pollIntervalSeconds: 15,
      buildContainer: false,
      writeChanges: true,
      runDoctor: true,
      runSync: false,
    });
    expect("authSecret" in result).toBe(false);
  });

  it("lets setup planning validate missing project input", () => {
    const result = buildNonInteractiveSetupAnswers({ yes: true, dryRun: false });

    expect(result.gitlabProject).toBeUndefined();
  });

  it("lets setup defaults decide container build when --yes is used without build flags", () => {
    const result = buildNonInteractiveSetupAnswers({
      yes: true,
      dryRun: false,
      gitlabProject: "group/project",
    });

    expect(result.buildContainer).toBeUndefined();
  });

  it("does not build container image by default", () => {
    const answers = buildNonInteractiveSetupAnswers({
      yes: true,
      dryRun: false,
      gitlabProject: "group/project",
    });
    const plan = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/project",
        dockerAvailable: true,
      },
      answers,
    });

    expect(setupPlanWantsContainerBuild(plan)).toBe(false);
  });

  it("builds container image only when requested explicitly", () => {
    const answers = buildNonInteractiveSetupAnswers({
      yes: true,
      dryRun: false,
      build: true,
      gitlabProject: "group/project",
    });
    const plan = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/project",
        dockerAvailable: true,
      },
      answers,
    });

    expect(setupPlanWantsContainerBuild(plan)).toBe(true);
  });

  it("does not request daemon-once before setup files are written", () => {
    const result = buildNonInteractiveSetupAnswers({
      yes: true,
      dryRun: false,
      once: true,
      gitlabProject: "group/project",
    });

    expect(result.runDaemonOnce).toBeUndefined();
  });

  it("loads declarative config input and keeps dry-run non-mutating", () => {
    withJsonFile(
      JSON.stringify({
        gitlabProject: "group/project",
        targetBranch: "develop",
        requiredAuthKeys: ["OPENAI_API_KEY"],
        verificationCommands: ["pnpm test"],
      }),
      (path) => {
        const input = readSetupConfigInput(path);
        const result = buildNonInteractiveSetupAnswers({
          ...input,
          yes: true,
          dryRun: true,
          noBuild: true,
        });

        expect(result.gitlabProject).toBe("group/project");
        expect(result.targetBranch).toBe("develop");
        expect(result.writeChanges).toBe(false);
        expect(result.runDoctor).toBe(false);
        expect(result.runDaemonOnce).toBeUndefined();
      },
    );
  });
});
