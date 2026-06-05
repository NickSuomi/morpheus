import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyMorpheusSetupPlan, detectMorpheusSetupInput } from "../src/index.js";
import {
  interpretMorpheusSetupDoctorOutput,
  planMorpheusSetup,
  planMorpheusSetupExecution,
  setupAgentEnvExampleTemplate,
  setupCanRunDaemonOnce,
  setupCanRunSync,
  setupSecretFileTemplate,
  formatMorpheusSetupPreview,
  type MorpheusConfig,
} from "@morpheus/runtime";

const withTempDir = (fn: (dir: string) => void): void => {
  const dir = mkdtempSync(join(tmpdir(), "morpheus-setup-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const writeConfig = (dir: string, config: MorpheusConfig): void => {
  writeFileSync(join(dir, "morpheus.config.json"), `${JSON.stringify(config, null, 2)}\n`);
};

const existingConfig: MorpheusConfig = {
  targetRepo: ".",
  issueTracker: { kind: "beads" },
  gitlab: {
    project: "group/old-project",
    readyLabel: "agent:ready",
    targetBranch: "main",
  },
  daemon: { pollIntervalSeconds: 30 },
  mergeRequests: { kind: "gitlab-glab" },
  agentRunner: {
    kind: "container",
    agent: {
      provider: "codex",
      model: "gpt-5.4-mini",
      effort: "low",
    },
    auth: {
      envFile: ".morpheus/secrets/agent.env",
      requiredKeys: ["OPENAI_API_KEY"],
    },
    container: {
      image: "morpheus-agent:old",
      profile: ".morpheus/container/Dockerfile",
      mounts: [{ hostPath: ".", containerPath: "/workspace" }],
      setupHooks: [],
    },
    skills: {
      directory: ".morpheus/skills",
      mappings: [{ name: "matt-pocock-tdd", path: ".morpheus/skills/matt-pocock-tdd/SKILL.md" }],
      stageMappings: {
        prepare: ["matt-pocock-tdd"],
        implement: ["matt-pocock-tdd"],
        review: ["matt-pocock-tdd"],
      },
    },
  },
  ledger: { path: ".morpheus/ledger.sqlite" },
  lanes: {
    preparation: { concurrency: 1 },
    implementation: { concurrency: 1 },
    review: { concurrency: 1 },
  },
  verification: { commands: ["pnpm test"] },
  retention: {
    completedIntermediate: { keepDays: 14, keepLast: 100 },
    failed: "manual",
    reviewCandidate: "until-mr-closed-or-manual",
    active: "never",
  },
  prompts: {
    prepare: ".morpheus/prompts/prepare.md",
    implement: ".morpheus/prompts/implement.md",
    review: ".morpheus/prompts/review.md",
  },
};

describe("setup planning", () => {
  it("plans a new target setup from detected defaults without CLI prompting", () => {
    const plan = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/app",
        defaultBranch: "develop",
        capabilities: ["node", "pnpm"],
        verificationCommands: ["pnpm test", "pnpm typecheck"],
      },
      existing: { files: [] },
    });

    expect(plan.target).toEqual({
      inputPath: undefined,
      resolvedPath: "/repos/app",
      validation: { status: "valid" },
    });
    expect(plan.mode).toBe("create");
    expect(plan.prompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "targetPath",
          defaultValue: ".",
          value: "/repos/app",
          validation: { status: "valid" },
          mutation: expect.objectContaining({ kind: "setup-target" }),
        }),
        expect.objectContaining({
          id: "gitlabProject",
          defaultValue: "group/app",
          value: "group/app",
          validation: { status: "valid" },
          mutation: expect.objectContaining({ kind: "config", field: "gitlab.project" }),
        }),
        expect.objectContaining({
          id: "verificationCommands",
          value: ["pnpm test", "pnpm typecheck"],
          validation: { status: "valid" },
        }),
        expect.objectContaining({
          id: "laneConcurrency",
          value: { preparation: 1, implementation: 1, review: 1 },
          validation: { status: "valid" },
        }),
      ]),
    );
    expect(plan.configMutation.action).toBe("create");
    expect(plan.configMutation.nextConfig).toMatchObject({
      targetRepo: ".",
      gitlab: { project: "group/app", readyLabel: "agent:ready", targetBranch: "develop" },
      agentRunner: {
        auth: { envFile: ".morpheus/secrets/agent.env", requiredKeys: ["OPENAI_API_KEY"] },
        container: {
          image: "morpheus-agent:local",
          profile: ".morpheus/container/Dockerfile",
          mounts: [{ hostPath: ".", containerPath: "/workspace" }],
        },
      },
      daemon: { pollIntervalSeconds: 30 },
      verification: { commands: ["pnpm test", "pnpm typecheck"] },
      lanes: {
        preparation: { concurrency: 1 },
        implementation: { concurrency: 1 },
        review: { concurrency: 1 },
      },
    });
    expect(plan.fileMutations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "morpheus.config.json", action: "create" }),
        expect.objectContaining({ path: ".morpheus/prompts/prepare.md", action: "create" }),
        expect.objectContaining({ path: ".morpheus/container/Dockerfile", action: "create" }),
        expect.objectContaining({ path: ".morpheus/secrets/agent.env.example", action: "create" }),
        expect.objectContaining({ path: ".gitignore", action: "patch" }),
      ]),
    );
    expect(plan.nextSteps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "configShow", command: "morpheus config show" }),
        expect.objectContaining({ id: "doctor", command: "morpheus doctor" }),
        expect.objectContaining({ id: "agentAuth" }),
      ]),
    );
  });

  it("preserves existing target-owned templates and refuses secret overwrites by default", () => {
    const plan = planMorpheusSetup({
      targetPath: "/repos/app",
      currentWorkingDirectory: "/elsewhere",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
      },
      existing: {
        config: existingConfig,
        files: [
          "morpheus.config.json",
          ".morpheus/prompts/prepare.md",
          ".morpheus/container/Dockerfile",
          ".morpheus/secrets/agent.env",
          ".morpheus/secrets/agent.env.example",
        ],
      },
      answers: {
        gitlabProject: "group/new-project",
        targetBranch: "develop",
        readyLabel: "workflow:ready",
        createSecretFile: true,
      },
    });

    expect(plan.mode).toBe("update");
    expect(plan.configMutation.action).toBe("update");
    expect(plan.configMutation.nextConfig).toMatchObject({
      gitlab: {
        project: "group/new-project",
        targetBranch: "develop",
        readyLabel: "workflow:ready",
      },
      agentRunner: {
        container: { image: "morpheus-agent:old" },
      },
    });
    expect(plan.fileMutations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ".morpheus/prompts/prepare.md", action: "skip" }),
        expect.objectContaining({ path: ".morpheus/container/Dockerfile", action: "skip" }),
        expect.objectContaining({
          path: ".morpheus/secrets/agent.env",
          action: "refuse",
          reason: expect.stringContaining("secret"),
        }),
      ]),
    );
    expect(plan.errors).toEqual([]);
    expect(plan.warnings).toEqual(expect.arrayContaining([expect.stringContaining("Preserving")]));
  });

  it("creates missing generated templates in update mode without rewriting existing files", () => {
    const plan = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
      },
      existing: {
        config: existingConfig,
        files: ["morpheus.config.json", ".morpheus/secrets/agent.env"],
        authEnvKeys: ["OPENAI_API_KEY"],
      },
    });

    expect(plan.fileMutations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ".morpheus/prompts/prepare.md",
          action: "create",
          apply: false,
        }),
        expect.objectContaining({
          path: ".morpheus/container/Dockerfile",
          action: "create",
          apply: false,
        }),
      ]),
    );
  });

  it("carries the configured ready label as semantic next-step data", () => {
    const plan = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/app",
      },
      answers: { readyLabel: "workflow:ready" },
    });

    expect(plan.nextSteps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "readyLabel",
          command: "workflow:ready",
        }),
      ]),
    );
  });

  it("marks invalid detected state and answers without side effects", () => {
    const plan = planMorpheusSetup({
      targetPath: "/missing/app",
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: false,
          isDirectory: false,
          isReadable: false,
          isGitWorktree: false,
        },
      },
      existing: { files: [] },
      answers: {
        gitlabProject: "not-a-project",
        authEnvFile: ".env",
        laneConcurrency: { preparation: 0, implementation: 1, review: 1 },
      },
    });

    expect(plan.target.validation).toEqual({
      status: "invalid",
      message: "Target path does not exist.",
    });
    expect(plan.prompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "gitlabProject",
          validation: {
            status: "invalid",
            message: "Use a GitLab project path like group/project.",
          },
        }),
        expect.objectContaining({
          id: "authEnvFile",
          validation: {
            status: "invalid",
            message: "Default setup must not use a root .env secret file.",
          },
        }),
        expect.objectContaining({
          id: "laneConcurrency",
          validation: {
            status: "invalid",
            message: "Lane concurrency values must be positive integers.",
          },
        }),
      ]),
    );
    expect(plan.configMutation.action).toBe("blocked");
    expect(plan.fileMutations.every((mutation) => mutation.action !== "create")).toBe(true);
    expect(plan.errors).toEqual(
      expect.arrayContaining([
        "Target path does not exist.",
        "Use a GitLab project path like group/project.",
        "Default setup must not use a root .env secret file.",
        "Lane concurrency values must be positive integers.",
      ]),
    );
  });

  it("rejects Git remote URLs as GitLab project paths", () => {
    const plan = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
      },
      answers: {
        gitlabProject: "gitlab.example.com/group/app.git",
      },
    });

    expect(plan.configMutation.action).toBe("blocked");
    expect(plan.errors).toContain("Use a GitLab project path like group/project.");
  });

  it("blocks update mode when an existing config failed validation", () => {
    const plan = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
      },
      existing: {
        configError: {
          kind: "schema_validation",
          path: "/repos/app/morpheus.config.json",
          message: "invalid config",
        },
        files: ["morpheus.config.json"],
      },
    });

    expect(plan.configMutation.action).toBe("blocked");
    expect(plan.errors).toContain("Existing Morpheus config is invalid: schema_validation");
    expect(plan.prompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "existingConfig",
          validation: {
            status: "invalid",
            message: "Existing Morpheus config is invalid: schema_validation",
          },
        }),
      ]),
    );
  });

  it("allows create mode when no existing config is present", () => {
    const plan = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
      },
      existing: {
        configError: {
          kind: "missing_config",
          path: "/repos/app/morpheus.config.json",
        },
        files: [],
      },
      answers: {
        gitlabProject: "group/app",
        writeChanges: false,
      },
    });

    expect(plan.configMutation.action).toBe("create");
    expect(plan.errors).not.toContain("Existing Morpheus config is invalid: missing_config");
  });

  it("uses the configured container profile for template mutation and build guidance", () => {
    const plan = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/app",
        dockerAvailable: true,
      },
      answers: {
        containerProfile: ".morpheus/container/Dockerfile.node",
        containerImage: "morpheus-agent:custom",
      },
    });

    expect(plan.fileMutations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ".morpheus/container/Dockerfile.node",
          action: "create",
        }),
      ]),
    );
    expect(plan.nextSteps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "containerBuild",
          command: "docker build -f .morpheus/container/Dockerfile.node -t morpheus-agent:custom .",
        }),
      ]),
    );
    expect(plan.prompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "containerBuild",
          defaultValue: true,
          value: true,
          mutation: {
            kind: "command",
            command:
              "docker build -f .morpheus/container/Dockerfile.node -t morpheus-agent:custom .",
          },
        }),
      ]),
    );
  });

  it("lets operators decline detected toolchain probes", () => {
    const plan = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/app",
        capabilities: ["node", "pnpm"],
      },
      answers: { addToolchainProbes: false },
    });

    expect(plan.prompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "toolchainProbes", defaultValue: true, value: [] }),
      ]),
    );
    expect(plan.configMutation.nextConfig?.verification.toolchainProbes).toBeUndefined();
  });

  it("rejects unsafe auth paths and container mounts", () => {
    const plan = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/app",
      },
      answers: {
        authEnvFile: "/tmp/agent.env",
        containerMounts: [{ hostPath: "../outside", containerPath: "workspace" }],
      },
    });

    expect(plan.configMutation.action).toBe("blocked");
    expect(plan.errors).toEqual(
      expect.arrayContaining([
        "Absolute auth env file paths require explicit operator confirmation.",
        "Container host mounts must stay inside the target repo and container paths must be absolute.",
      ]),
    );
  });

  it("accepts absolute auth paths only after explicit confirmation", () => {
    const blocked = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/app",
      },
      answers: { authEnvFile: "/tmp/agent.env" },
    });
    const confirmed = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/app",
      },
      answers: { authEnvFile: "/tmp/agent.env", confirmAbsoluteAuthEnvFile: true },
    });

    expect(blocked.configMutation.action).toBe("blocked");
    expect(confirmed.errors).not.toContain(
      "Absolute auth env file paths require explicit operator confirmation.",
    );
    expect(confirmed.configMutation.nextConfig?.agentRunner.auth.envFile).toBe("/tmp/agent.env");
  });

  it("rejects global Codex auth paths even after absolute path confirmation", () => {
    const globalCodexAuthPath = ["/Users", "alice", ".codex", "auth.json"].join("/");
    const plan = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/app",
      },
      answers: {
        authEnvFile: globalCodexAuthPath,
        confirmAbsoluteAuthEnvFile: true,
      },
    });

    expect(plan.configMutation.action).toBe("blocked");
    expect(plan.errors).toContain("Agent auth env file path must not use global host Codex auth.");
  });

  it("accepts external container mounts only after explicit confirmation", () => {
    const blocked = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/app",
      },
      answers: { containerMounts: [{ hostPath: "/var/tmp/app", containerPath: "/workspace" }] },
    });
    const confirmed = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/app",
      },
      answers: {
        containerMounts: [{ hostPath: "/var/tmp/app", containerPath: "/workspace" }],
        confirmExternalContainerMounts: true,
      },
    });

    expect(blocked.configMutation.action).toBe("blocked");
    expect(confirmed.errors).not.toContain(
      "Container host mounts must stay inside the target repo and container paths must be absolute.",
    );
    expect(confirmed.configMutation.nextConfig?.agentRunner.container.mounts).toEqual([
      { hostPath: "/var/tmp/app", containerPath: "/workspace" },
    ]);
  });

  it("rejects implausible container profile paths and invalid agent effort values", () => {
    const plan = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/app",
      },
      answers: {
        agentEffort: "extreme" as never,
        containerProfile: ".morpheus/container/profile.txt",
      },
    });

    expect(plan.configMutation.action).toBe("blocked");
    expect(plan.errors).toEqual(
      expect.arrayContaining([
        "Agent reasoning effort must be one of low, medium, high, or xhigh.",
        "Container profile path must end with Dockerfile or include Dockerfile in the file name.",
      ]),
    );
    expect(plan.prompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "agentEffort",
          validation: {
            status: "invalid",
            message: "Agent reasoning effort must be one of low, medium, high, or xhigh.",
          },
        }),
      ]),
    );
  });

  it("rejects global auth paths, empty mounts, and Dockerfile-like text files", () => {
    const globalCodexAuthPath = ["~", ".codex", "auth.json"].join("/");
    const plan = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/app",
      },
      answers: {
        authEnvFile: globalCodexAuthPath,
        containerMounts: [],
        containerProfile: ".morpheus/container/Dockerfile.txt",
      },
    });

    expect(plan.configMutation.action).toBe("blocked");
    expect(plan.errors).toEqual(
      expect.arrayContaining([
        "Agent auth env file path must not use global host Codex auth.",
        "At least one container workspace mount is required.",
        "Container profile path must end with Dockerfile or include Dockerfile in the file name.",
      ]),
    );
  });

  it("rejects parent-directory auth and mount paths", () => {
    const plan = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/app",
      },
      answers: {
        authEnvFile: ".morpheus/../agent.env",
        containerMounts: [{ hostPath: "work/..", containerPath: "/workspace" }],
      },
    });

    expect(plan.configMutation.action).toBe("blocked");
    expect(plan.errors).toEqual(
      expect.arrayContaining([
        "Relative auth env file path must stay inside the target repo.",
        "Container host mounts must stay inside the target repo and container paths must be absolute.",
      ]),
    );
  });

  it("rejects template overwrite when no generated templates exist", () => {
    const plan = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/app",
      },
      existing: { files: [] },
      answers: { overwriteTemplates: true },
    });

    expect(plan.configMutation.action).toBe("blocked");
    expect(plan.prompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "overwriteTemplates",
          validation: {
            status: "invalid",
            message: "Template overwrite is only valid when generated templates already exist.",
          },
        }),
      ]),
    );
  });

  it("does not guide sync or daemon steps while required auth is missing", () => {
    const plan = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/app",
      },
      existing: { files: [] },
    });

    expect(plan.nextSteps.map((step) => step.id)).not.toEqual(
      expect.arrayContaining(["sync", "daemonOnce", "daemon"]),
    );
    expect(plan.nextSteps).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "agentAuth" })]),
    );
    expect(plan.prompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "sync",
          validation: {
            status: "warning",
            message: "Sync waits until doctor has no blocking auth or GitLab failures.",
          },
        }),
        expect.objectContaining({
          id: "daemonOnce",
          validation: {
            status: "warning",
            message: "Daemon tick waits until doctor has no FAIL results.",
          },
        }),
      ]),
    );
  });

  it("does not guide sync or daemon steps while required auth keys are missing", () => {
    const plan = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/app",
      },
      existing: {
        files: [".morpheus/secrets/agent.env"],
        authEnvKeys: [],
      },
    });

    expect(plan.nextSteps.map((step) => step.id)).not.toEqual(
      expect.arrayContaining(["sync", "daemonOnce", "daemon"]),
    );
    expect(plan.warnings).toContain(
      "Required agent auth keys are missing from .morpheus/secrets/agent.env.",
    );
  });

  it("rejects requested sync or daemon runs until doctor gates are known OK", () => {
    const plan = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/app",
      },
      existing: {
        files: [".morpheus/secrets/agent.env"],
        authEnvKeys: ["OPENAI_API_KEY"],
      },
      answers: { runSync: true, runDaemonOnce: true },
    });

    expect(plan.configMutation.action).toBe("blocked");
    expect(plan.errors).toEqual(
      expect.arrayContaining([
        "Sync requires doctor-confirmed Beads and GitLab health.",
        "Daemon tick requires doctor to have no FAIL results.",
      ]),
    );
  });

  it("defaults container build to no when Docker is unavailable or profile changed", () => {
    const unavailable = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/app",
        dockerAvailable: false,
      },
    });
    const changedProfile = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/app",
        dockerAvailable: true,
      },
      existing: {
        config: existingConfig,
        files: [".morpheus/secrets/agent.env"],
        authEnvKeys: ["OPENAI_API_KEY"],
      },
      answers: { containerProfile: ".morpheus/container/Dockerfile.node" },
    });

    expect(unavailable.prompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "containerBuild", defaultValue: false, value: false }),
      ]),
    );
    expect(changedProfile.prompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "containerBuild", defaultValue: false, value: false }),
      ]),
    );
  });

  it("detects configured custom auth and container profile files in update mode", () => {
    withTempDir((dir) => {
      const config: MorpheusConfig = {
        ...existingConfig,
        agentRunner: {
          ...existingConfig.agentRunner,
          auth: {
            envFile: ".morpheus/private/custom-agent.env",
            requiredKeys: ["OPENAI_API_KEY"],
          },
          container: {
            ...existingConfig.agentRunner.container,
            profile: ".morpheus/container/node.Dockerfile",
          },
        },
      };
      writeConfig(dir, config);
      mkdirSync(join(dir, ".morpheus/private"), { recursive: true });
      mkdirSync(join(dir, ".morpheus/container"), { recursive: true });
      writeFileSync(join(dir, ".morpheus/private/custom-agent.env"), "OPENAI_API_KEY=real\n");
      writeFileSync(join(dir, ".morpheus/container/node.Dockerfile"), "custom profile");

      const input = detectMorpheusSetupInput({
        targetPath: dir,
        doctor: { beadsOk: true, gitlabOk: true, hasFail: false },
      });
      const plan = planMorpheusSetup({
        ...input,
        detected: {
          ...input.detected,
          targetPath: { exists: true, isDirectory: true, isReadable: true, isGitWorktree: true },
        },
      });

      expect(input.existing?.files).toEqual(
        expect.arrayContaining([
          ".morpheus/private/custom-agent.env",
          ".morpheus/container/node.Dockerfile",
        ]),
      );
      expect(setupCanRunSync(input)).toBe(true);
      expect(plan.fileMutations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ".morpheus/container/node.Dockerfile",
            action: "skip",
          }),
          expect.objectContaining({
            path: ".morpheus/private/custom-agent.env",
            action: "refuse",
          }),
        ]),
      );
    });
  });

  it("rejects requested container build until docker info is known OK", () => {
    const plan = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/app",
      },
      answers: { buildContainer: true },
    });

    expect(plan.configMutation.action).toBe("blocked");
    expect(plan.errors).toContain("Container build requires docker info to pass.");
  });

  it("does not guide sync or daemon next steps when doctor reports failures", () => {
    const plan = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/app",
        doctor: { beadsOk: true, gitlabOk: true, hasFail: true },
      },
      existing: {
        files: [".morpheus/secrets/agent.env"],
        authEnvKeys: ["OPENAI_API_KEY"],
      },
    });

    expect(plan.nextSteps.map((step) => step.id)).not.toEqual(
      expect.arrayContaining(["sync", "daemonOnce", "daemon"]),
    );
  });

  it("marks mutation previews as not applied when write changes is declined", () => {
    const plan = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/app",
      },
      answers: { writeChanges: false },
    });

    expect(plan.configMutation).toMatchObject({ action: "create", apply: false });
    expect(plan.fileMutations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "morpheus.config.json", action: "create", apply: false }),
        expect.objectContaining({
          path: ".morpheus/prompts/prepare.md",
          action: "create",
          apply: false,
        }),
      ]),
    );
  });

  it("applies update-mode template overwrites without overwriting the real secret file", () => {
    withTempDir((dir) => {
      writeConfig(dir, existingConfig);
      mkdirSync(join(dir, ".morpheus/prompts"), { recursive: true });
      mkdirSync(join(dir, ".morpheus/container"), { recursive: true });
      mkdirSync(join(dir, ".morpheus/secrets"), { recursive: true });
      writeFileSync(join(dir, ".morpheus/prompts/prepare.md"), "old prompt");
      writeFileSync(join(dir, ".morpheus/container/Dockerfile"), "old dockerfile");
      writeFileSync(join(dir, ".morpheus/secrets/agent.env"), "OPENAI_API_KEY=real\n");

      const input = detectMorpheusSetupInput({ targetPath: dir });
      const plan = planMorpheusSetup({
        ...input,
        detected: {
          ...input.detected,
          targetPath: { exists: true, isDirectory: true, isReadable: true, isGitWorktree: true },
        },
        answers: {
          overwriteTemplates: true,
          writeChanges: true,
          gitlabProject: "group/new-project",
        },
      });

      applyMorpheusSetupPlan(plan);

      expect(readFileSync(join(dir, ".morpheus/prompts/prepare.md"), "utf8")).toContain(
        "Agent-Ready Contract",
      );
      expect(readFileSync(join(dir, ".morpheus/container/Dockerfile"), "utf8")).toContain(
        "Morpheus container profile",
      );
      expect(readFileSync(join(dir, ".morpheus/secrets/agent.env"), "utf8")).toBe(
        "OPENAI_API_KEY=real\n",
      );
      expect(readFileSync(join(dir, "morpheus.config.json"), "utf8")).toContain(
        "group/new-project",
      );
    });
  });

  it("gates sync and daemon on explicit non-empty auth file keys plus doctor health", () => {
    withTempDir((dir) => {
      writeConfig(dir, existingConfig);
      mkdirSync(join(dir, ".morpheus/secrets"), { recursive: true });
      writeFileSync(join(dir, ".morpheus/secrets/agent.env"), "OPENAI_API_KEY=\n");

      const doctor = interpretMorpheusSetupDoctorOutput(
        ["Morpheus doctor", "OK beads: bd readable", "OK gitlab: authenticated"].join("\n"),
      );
      const emptyAuth = detectMorpheusSetupInput({ targetPath: dir, doctor });
      writeFileSync(join(dir, ".morpheus/secrets/agent.env"), "OPENAI_API_KEY=real\n");
      const ready = detectMorpheusSetupInput({
        targetPath: dir,
        doctor: { beadsOk: true, gitlabOk: true, hasFail: false },
      });
      const doctorFailed = detectMorpheusSetupInput({
        targetPath: dir,
        doctor: { beadsOk: true, gitlabOk: true, hasFail: true },
      });
      rmSync(join(dir, ".morpheus/secrets/agent.env"));
      const afterRemoval = detectMorpheusSetupInput({
        targetPath: dir,
        doctor: { beadsOk: true, gitlabOk: true, hasFail: false },
      });

      expect(setupCanRunSync(emptyAuth)).toBe(false);
      expect(setupCanRunDaemonOnce(emptyAuth)).toBe(false);
      expect(setupCanRunSync(ready)).toBe(true);
      expect(setupCanRunDaemonOnce(ready)).toBe(true);
      expect(setupCanRunSync(doctorFailed)).toBe(false);
      expect(setupCanRunDaemonOnce(doctorFailed)).toBe(false);
      expect(setupCanRunSync(afterRemoval)).toBe(false);
      expect(setupCanRunDaemonOnce(afterRemoval)).toBe(false);
    });
  });

  it("blocks setup completion with explicit auth handoff when auth file is missing or empty", () => {
    withTempDir((dir) => {
      writeConfig(dir, existingConfig);
      const doctor = { beadsOk: true, gitlabOk: true, hasFail: false };
      const missingAuthInput = detectMorpheusSetupInput({ targetPath: dir, doctor });
      const missingAuthPlan = planMorpheusSetup({
        ...missingAuthInput,
        detected: {
          ...missingAuthInput.detected,
          targetPath: { exists: true, isDirectory: true, isReadable: true, isGitWorktree: true },
        },
      });
      const missingAuthPreview = formatMorpheusSetupPreview(missingAuthPlan);

      expect(planMorpheusSetupExecution(missingAuthInput).daemonOnce).toEqual({
        canRun: false,
        skipReason:
          "fill .morpheus/secrets/agent.env with non-empty required keys: OPENAI_API_KEY.",
      });
      expect(missingAuthPreview).toContain(
        "Fill .morpheus/secrets/agent.env with non-empty required keys: OPENAI_API_KEY.",
      );
      const requestedDaemonPlan = planMorpheusSetup({
        ...missingAuthInput,
        detected: {
          ...missingAuthInput.detected,
          targetPath: { exists: true, isDirectory: true, isReadable: true, isGitWorktree: true },
        },
        answers: { runDaemonOnce: true },
      });
      expect(requestedDaemonPlan.errors).toContain(
        "Fill .morpheus/secrets/agent.env with non-empty required keys: OPENAI_API_KEY.",
      );
      expect(missingAuthPreview).not.toContain("morpheus sync (after-doctor)");
      expect(missingAuthPreview).not.toContain("morpheus daemon --once (after-doctor)");

      mkdirSync(join(dir, ".morpheus/secrets"), { recursive: true });
      writeFileSync(join(dir, ".morpheus/secrets/agent.env"), "OPENAI_API_KEY=\n");
      const emptyAuthInput = detectMorpheusSetupInput({ targetPath: dir, doctor });

      expect(planMorpheusSetupExecution(emptyAuthInput).daemonOnce).toEqual({
        canRun: false,
        skipReason:
          "fill .morpheus/secrets/agent.env with non-empty required keys: OPENAI_API_KEY.",
      });
    });
  });

  it("renders only placeholder auth templates", () => {
    expect(setupSecretFileTemplate(["OPENAI_API_KEY", "ANTHROPIC_API_KEY"])).toBe(
      [
        "# Fill these values manually. Morpheus setup never asks for or prints secret values.",
        "OPENAI_API_KEY=",
        "ANTHROPIC_API_KEY=",
        "",
      ].join("\n"),
    );
    expect(setupAgentEnvExampleTemplate(["OPENAI_API_KEY"])).toBe(
      [
        "# Copy to .morpheus/secrets/agent.env and fill with real token values.",
        "# Morpheus requires this explicit file for agent runs.",
        "OPENAI_API_KEY=",
        "",
      ].join("\n"),
    );
  });

  it("requires doctor and daemon-once when setup writes changes", () => {
    const declinedDoctor = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/app",
      },
      answers: { writeChanges: true, runDoctor: false },
    });

    expect(declinedDoctor.errors).toContain(
      "Setup completion requires morpheus doctor after writing changes.",
    );

    const ready = planMorpheusSetup({
      currentWorkingDirectory: "/repos/app",
      detected: {
        targetPath: {
          exists: true,
          isDirectory: true,
          isReadable: true,
          isGitWorktree: true,
        },
        gitlabProject: "group/app",
        doctor: { beadsOk: true, gitlabOk: true, hasFail: false },
      },
      existing: {
        config: existingConfig,
        files: ["morpheus.config.json", ".morpheus/secrets/agent.env"],
        authEnvKeys: ["OPENAI_API_KEY"],
      },
      answers: { writeChanges: true },
    });

    expect(ready.prompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "doctor", value: true, validation: { status: "valid" } }),
        expect.objectContaining({
          id: "daemonOnce",
          defaultValue: true,
          value: true,
          validation: { status: "valid" },
        }),
      ]),
    );
  });
});
