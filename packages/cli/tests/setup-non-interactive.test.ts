import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildNonInteractiveSetupAnswers,
  readSetupConfigInput,
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
  it("maps scriptable flags to setup answers without accepting secret values", () => {
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
  });

  it("fails closed when required non-interactive inputs are missing", () => {
    expect(() => buildNonInteractiveSetupAnswers({ yes: true, dryRun: false })).toThrow(
      "Missing required non-interactive setup option: --gitlab-project",
    );
  });

  it("rejects inline secret values", () => {
    expect(() =>
      buildNonInteractiveSetupAnswers({
        yes: true,
        dryRun: false,
        gitlabProject: "group/project",
        authSecret: "OPENAI_API_KEY=real-token",
      }),
    ).toThrow("Non-interactive setup does not accept secret values.");
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
