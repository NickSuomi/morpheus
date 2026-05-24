import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { initMorpheusRepo, loadMorpheusConfig } from "../src/index.js";

const bundledSkillNames = [
  "matt-pocock-caveman",
  "matt-pocock-to-prd",
  "matt-pocock-grill-me",
  "matt-pocock-to-issues",
  "matt-pocock-grill-with-docs",
  "matt-pocock-tdd",
  "matt-pocock-diagnose",
] as const;

const bundledSkillMappings = bundledSkillNames.map((name) => ({
  name,
  path: `.morpheus/skills/${name}/SKILL.md`,
}));

const relativeFiles = (root: string, current = root): readonly string[] =>
  readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(current, entry.name);
    const relativePath = fullPath.slice(root.length + 1);
    return entry.isDirectory() ? relativeFiles(root, fullPath) : [relativePath];
  }).sort();

const expectedInitFiles = [
  ".gitignore",
  ".morpheus/container/Dockerfile",
  ".morpheus/container/README.md",
  ".morpheus/prompts/implement.md",
  ".morpheus/prompts/prepare.md",
  ".morpheus/prompts/review.md",
  ".morpheus/secrets/agent.env.example",
  ...bundledSkillNames.map((name) => `.morpheus/skills/${name}/SKILL.md`),
  "morpheus.config.json",
].sort();

const validConfig = {
  targetRepo: ".",
  issueTracker: { kind: "beads" },
  gitlab: {
    project: "morpheus/morpheus",
    readyLabel: "agent:ready",
    targetBranch: "main",
  },
  daemon: { pollIntervalSeconds: 30 },
  mergeRequests: { kind: "gitlab-glab" },
  agentRunner: {
    kind: "container",
    agent: {
      provider: "codex",
      model: "gpt-5.5",
      effort: "xhigh",
    },
    auth: {
      envFile: ".morpheus/secrets/agent.env",
      requiredKeys: ["OPENAI_API_KEY"],
    },
    container: {
      image: "morpheus-agent:local",
      profile: ".morpheus/container/Dockerfile",
      mounts: [
        {
          hostPath: ".",
          containerPath: "/workspace",
        },
      ],
      setupHooks: [],
    },
    skills: {
      directory: ".morpheus/skills",
      mappings: bundledSkillMappings,
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
  },
  ledger: { path: ".morpheus/ledger.sqlite" },
  lanes: {
    preparation: { concurrency: 1 },
    implementation: { concurrency: 1 },
    review: { concurrency: 1 },
  },
  verification: { commands: [] },
  retention: {
    completedIntermediate: {
      keepDays: 14,
      keepLast: 100,
    },
    failed: "manual",
    reviewCandidate: "until-mr-closed-or-manual",
    active: "never",
  },
} as const;

const laneNames = ["preparation", "implementation", "review"] as const;
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

type LaneName = (typeof laneNames)[number];

const withLaneConcurrency = (lane: LaneName, concurrency: number) => ({
  ...validConfig,
  lanes: {
    ...validConfig.lanes,
    [lane]: {
      ...validConfig.lanes[lane],
      concurrency,
    },
  },
});

const withTempDir = (fn: (dir: string) => void) => {
  const dir = mkdtempSync(join(tmpdir(), "morpheus-config-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
};

const writeConfig = (dir: string, value: unknown, file = "morpheus.config.json") => {
  const path = join(dir, file);
  writeFileSync(path, JSON.stringify(value, null, 2));
  return path;
};

describe("Morpheus config", () => {
  it("loads a valid config from an explicit path", () => {
    withTempDir((dir) => {
      const configPath = writeConfig(dir, validConfig);

      const result = loadMorpheusConfig({ configPath });

      expect(result).toEqual({
        status: "loaded",
        path: configPath,
        config: validConfig,
      });
    });
  });

  it("loads a valid config from the target repo root", () => {
    withTempDir((dir) => {
      const configPath = writeConfig(dir, validConfig);

      const result = loadMorpheusConfig({ targetRepo: dir });

      expect(result).toEqual({
        status: "loaded",
        path: configPath,
        config: validConfig,
      });
    });
  });

  it("returns a typed error when config is missing", () => {
    withTempDir((dir) => {
      const result = loadMorpheusConfig({ targetRepo: dir });

      expect(result).toMatchObject({
        status: "error",
        error: {
          kind: "missing_config",
          path: join(dir, "morpheus.config.json"),
        },
      });
    });
  });

  it("returns a typed error when config JSON is malformed", () => {
    withTempDir((dir) => {
      const configPath = join(dir, "morpheus.config.json");
      writeFileSync(configPath, "{");

      const result = loadMorpheusConfig({ configPath });

      expect(result).toMatchObject({
        status: "error",
        error: {
          kind: "malformed_json",
          path: configPath,
        },
      });
    });
  });

  it("returns a typed error when config shape is invalid", () => {
    withTempDir((dir) => {
      const configPath = writeConfig(dir, {
        ...validConfig,
        issueTracker: { kind: "unsupported" },
      });

      const result = loadMorpheusConfig({ configPath });

      expect(result).toMatchObject({
        status: "error",
        error: {
          kind: "schema_validation",
          path: configPath,
        },
      });
    });
  });

  it("accepts positive integer lane concurrency values", () => {
    withTempDir((dir) => {
      const config = {
        ...validConfig,
        lanes: {
          preparation: { concurrency: 2 },
          implementation: { concurrency: 3 },
          review: { concurrency: 4 },
        },
      };
      const configPath = writeConfig(dir, config);

      expect(loadMorpheusConfig({ configPath })).toEqual({
        status: "loaded",
        path: configPath,
        config,
      });
    });
  });

  it("accepts GitLab sync and daemon polling config", () => {
    withTempDir((dir) => {
      const config = {
        ...validConfig,
        gitlab: {
          project: "group/project",
          readyLabel: "workflow:ready",
          targetBranch: "develop",
        },
        daemon: { pollIntervalSeconds: 60 },
      };
      const configPath = writeConfig(dir, config);

      expect(loadMorpheusConfig({ configPath })).toEqual({
        status: "loaded",
        path: configPath,
        config,
      });
    });
  });

  it("accepts declarative container agent config", () => {
    withTempDir((dir) => {
      const config = {
        ...validConfig,
        agentRunner: {
          kind: "container",
          agent: {
            provider: "codex",
            model: "gpt-5.5",
            effort: "xhigh",
          },
          auth: {
            envFile: ".morpheus/secrets/custom-agent.env",
            requiredKeys: ["OPENAI_API_KEY", "EXTRA_TOKEN"],
          },
          container: {
            image: "registry.example/morpheus-agent:latest",
            profile: ".morpheus/container/Dockerfile",
            mounts: [
              {
                hostPath: ".",
                containerPath: "/workspace",
              },
              {
                hostPath: ".morpheus/cache",
                containerPath: "/cache",
                readOnly: true,
              },
            ],
            setupHooks: ["pnpm install"],
          },
          skills: {
            directory: ".morpheus/skills",
            mappings: [
              {
                name: "project-planning",
                path: ".morpheus/skills/planning/SKILL.md",
              },
              {
                name: "project-caveman",
                path: ".morpheus/skills/caveman/SKILL.md",
              },
              {
                name: "project-diagnose",
                path: ".morpheus/skills/diagnose/SKILL.md",
              },
            ],
            stageMappings: {
              prepare: ["project-planning"],
              implement: ["project-caveman"],
              review: ["project-caveman", "project-diagnose"],
            },
          },
        },
      };
      const configPath = writeConfig(dir, config);

      expect(loadMorpheusConfig({ configPath })).toEqual({
        status: "loaded",
        path: configPath,
        config,
      });
    });
  });

  it("accepts declarative toolchain probes for doctor", () => {
    withTempDir((dir) => {
      const config = {
        ...validConfig,
        verification: {
          commands: ["pnpm check"],
          toolchainProbes: [
            {
              name: "java",
              command: "java",
              args: ["-version"],
              action: "Install a JDK and rebuild the Morpheus container image.",
            },
          ],
        },
      };
      const configPath = writeConfig(dir, config);

      expect(loadMorpheusConfig({ configPath })).toEqual({
        status: "loaded",
        path: configPath,
        config,
      });
    });
  });

  it.each([
    ["runner kind", { ...validConfig.agentRunner, kind: "sandcastle" }],
    [
      "agent provider",
      {
        ...validConfig.agentRunner,
        agent: { ...validConfig.agentRunner.agent, provider: "openai" },
      },
    ],
    [
      "agent effort",
      {
        ...validConfig.agentRunner,
        agent: { ...validConfig.agentRunner.agent, effort: "extreme" },
      },
    ],
    [
      "auth env file",
      { ...validConfig.agentRunner, auth: { ...validConfig.agentRunner.auth, envFile: 123 } },
    ],
    [
      "auth required key",
      { ...validConfig.agentRunner, auth: { ...validConfig.agentRunner.auth, requiredKeys: [""] } },
    ],
    [
      "mount path",
      {
        ...validConfig.agentRunner,
        container: {
          ...validConfig.agentRunner.container,
          mounts: [{ hostPath: ".", containerPath: 123 }],
        },
      },
    ],
    [
      "skill mapping",
      {
        ...validConfig.agentRunner,
        skills: {
          ...validConfig.agentRunner.skills,
          mappings: [{ name: "x", path: 123 }],
        },
      },
    ],
    [
      "empty skill mapping path",
      {
        ...validConfig.agentRunner,
        skills: {
          ...validConfig.agentRunner.skills,
          mappings: [{ name: "x", path: "" }],
        },
      },
    ],
    [
      "stage skill mapping",
      {
        ...validConfig.agentRunner,
        skills: {
          ...validConfig.agentRunner.skills,
          stageMappings: { prepare: ["x"], implement: [""], review: ["z"] },
        },
      },
    ],
    [
      "unknown stage skill mapping",
      {
        ...validConfig.agentRunner,
        skills: {
          ...validConfig.agentRunner.skills,
          mappings: [{ name: "known", path: ".morpheus/skills/known/SKILL.md" }],
          stageMappings: {
            prepare: ["known"],
            implement: ["missing"],
            review: ["known"],
          },
        },
      },
    ],
    [
      "empty stage skill mapping",
      {
        ...validConfig.agentRunner,
        skills: {
          ...validConfig.agentRunner.skills,
          stageMappings: {
            ...validConfig.agentRunner.skills.stageMappings,
            prepare: [],
          },
        },
      },
    ],
  ] as const)("rejects invalid declarative container agent config: %s", (_field, agentRunner) => {
    withTempDir((dir) => {
      const configPath = writeConfig(dir, {
        ...validConfig,
        agentRunner,
      });

      expect(loadMorpheusConfig({ configPath })).toMatchObject({
        status: "error",
        error: {
          kind: "schema_validation",
          path: configPath,
        },
      });
    });
  });

  it.each([
    ["project", { project: 123, readyLabel: "agent:ready", targetBranch: "main" }],
    ["readyLabel", { project: "group/project", readyLabel: 123, targetBranch: "main" }],
    ["targetBranch", { project: "group/project", readyLabel: "agent:ready", targetBranch: 123 }],
  ] as const)("rejects invalid GitLab %s values", (_field, gitlab) => {
    withTempDir((dir) => {
      const configPath = writeConfig(dir, {
        ...validConfig,
        gitlab,
      });

      expect(loadMorpheusConfig({ configPath })).toMatchObject({
        status: "error",
        error: {
          kind: "schema_validation",
          path: configPath,
        },
      });
    });
  });

  it.each([0, -1, 1.5] as const)(
    "rejects invalid daemon poll interval %s",
    (pollIntervalSeconds) => {
      withTempDir((dir) => {
        const configPath = writeConfig(dir, {
          ...validConfig,
          daemon: { pollIntervalSeconds },
        });

        expect(loadMorpheusConfig({ configPath })).toMatchObject({
          status: "error",
          error: {
            kind: "schema_validation",
            path: configPath,
          },
        });
      });
    },
  );

  it.each(laneNames)("rejects invalid %s lane concurrency values", (lane) => {
    withTempDir((dir) => {
      for (const concurrency of [0, -1, 1.5]) {
        const configPath = writeConfig(
          dir,
          withLaneConcurrency(lane, concurrency),
          `${lane}-${concurrency}.json`,
        );

        expect(loadMorpheusConfig({ configPath })).toMatchObject({
          status: "error",
          error: {
            kind: "schema_validation",
            path: configPath,
          },
        });
      }
    });
  });

  it("allows prompts to be omitted", () => {
    withTempDir((dir) => {
      const configPath = writeConfig(dir, validConfig);

      expect(loadMorpheusConfig({ configPath })).toEqual({
        status: "loaded",
        path: configPath,
        config: validConfig,
      });
    });
  });

  it.each([
    ["prepare", { prepare: ".morpheus/prompts/prepare.md" }],
    ["implement", { implement: ".morpheus/prompts/implement.md" }],
    ["review", { review: ".morpheus/prompts/review.md" }],
  ] as const)("allows a single %s prompt override", (_name, prompts) => {
    withTempDir((dir) => {
      const config = {
        ...validConfig,
        prompts,
      };
      const configPath = writeConfig(dir, config);

      expect(loadMorpheusConfig({ configPath })).toEqual({
        status: "loaded",
        path: configPath,
        config,
      });
    });
  });

  it("allows mixed partial prompt overrides", () => {
    withTempDir((dir) => {
      const config = {
        ...validConfig,
        prompts: {
          prepare: ".morpheus/prompts/prepare.md",
          review: ".morpheus/prompts/review.md",
        },
      };
      const configPath = writeConfig(dir, config);

      expect(loadMorpheusConfig({ configPath })).toEqual({
        status: "loaded",
        path: configPath,
        config,
      });
    });
  });

  it("allows a full prompt override config", () => {
    withTempDir((dir) => {
      const config = {
        ...validConfig,
        prompts: {
          prepare: ".morpheus/prompts/prepare.md",
          implement: ".morpheus/prompts/implement.md",
          review: ".morpheus/prompts/review.md",
        },
      };
      const configPath = writeConfig(dir, config);

      expect(loadMorpheusConfig({ configPath })).toEqual({
        status: "loaded",
        path: configPath,
        config,
      });
    });
  });

  it("rejects a non-string prompt override path", () => {
    withTempDir((dir) => {
      const configPath = writeConfig(dir, {
        ...validConfig,
        prompts: {
          prepare: 123,
        },
      });

      expect(loadMorpheusConfig({ configPath })).toMatchObject({
        status: "error",
        error: {
          kind: "schema_validation",
          path: configPath,
        },
      });
    });
  });

  it("initializes Morpheus files in a new target repo", () => {
    withTempDir((dir) => {
      const result = initMorpheusRepo({
        target: dir,
        gitlabProject: "group/project",
      });

      expect(result).toMatchObject({
        status: "initialized",
        target: dir,
        configPath: join(dir, "morpheus.config.json"),
      });
      expect(loadMorpheusConfig({ targetRepo: dir })).toMatchObject({
        status: "loaded",
        config: {
          targetRepo: ".",
          gitlab: {
            project: "group/project",
            readyLabel: "agent:ready",
            targetBranch: "main",
          },
          agentRunner: {
            kind: "container",
            agent: {
              provider: "codex",
              model: "gpt-5.5",
              effort: "xhigh",
            },
            auth: {
              envFile: ".morpheus/secrets/agent.env",
              requiredKeys: ["OPENAI_API_KEY"],
            },
            container: {
              image: "morpheus-agent:local",
              profile: ".morpheus/container/Dockerfile",
              mounts: [
                {
                  hostPath: ".",
                  containerPath: "/workspace",
                },
              ],
              setupHooks: [],
            },
            skills: {
              directory: ".morpheus/skills",
              mappings: bundledSkillMappings,
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
          },
          prompts: {
            prepare: ".morpheus/prompts/prepare.md",
            implement: ".morpheus/prompts/implement.md",
            review: ".morpheus/prompts/review.md",
          },
        },
      });
      expect(readFileSync(join(dir, ".morpheus/prompts/prepare.md"), "utf8")).toContain(
        "Agent-Ready Contract",
      );
      expect(readFileSync(join(dir, ".morpheus/prompts/prepare.md"), "utf8")).toContain(
        "Default Morpheus Agent Skills",
      );
      expect(readFileSync(join(dir, ".morpheus/prompts/prepare.md"), "utf8")).toContain(
        ".morpheus/skills/matt-pocock-caveman/SKILL.md",
      );
      expect(readFileSync(join(dir, ".morpheus/prompts/prepare.md"), "utf8")).not.toContain(
        "/Users/",
      );
      expect(readFileSync(join(dir, ".morpheus/prompts/implement.md"), "utf8")).toContain(
        "Implement the prepared contract only.",
      );
      expect(readFileSync(join(dir, ".morpheus/prompts/implement.md"), "utf8")).toContain(
        ".morpheus/skills/matt-pocock-tdd/SKILL.md",
      );
      expect(readFileSync(join(dir, ".morpheus/prompts/implement.md"), "utf8")).not.toContain(
        "/Users/",
      );
      expect(readFileSync(join(dir, ".morpheus/prompts/review.md"), "utf8")).toContain(
        "Stay read-only.",
      );
      expect(readFileSync(join(dir, ".morpheus/prompts/review.md"), "utf8")).toContain(
        ".morpheus/skills/matt-pocock-diagnose/SKILL.md",
      );
      for (const skillName of bundledSkillNames) {
        const generated = readFileSync(
          join(dir, ".morpheus/skills", skillName, "SKILL.md"),
          "utf8",
        );
        const vendored = readFileSync(
          join(packageRoot, "bundled-skills", skillName, "SKILL.md"),
          "utf8",
        );

        expect(generated).toBe(vendored);
        expect(generated).toContain("---");
        expect(generated.length).toBeGreaterThan(500);
      }
      const dockerfile = readFileSync(join(dir, ".morpheus/container/Dockerfile"), "utf8");
      expect(dockerfile).toContain("FROM node:22-bookworm-slim");
      expect(dockerfile).toContain("Morpheus container profile");
      expect(dockerfile).toContain("apt-get install -y --no-install-recommends git ca-certificates");
      expect(dockerfile).toContain("npm install -g @openai/codex@0.133.0");
      expect(dockerfile).toContain("USER 0");
      expect(dockerfile).toContain('CMD ["sleep", "infinity"]');
      const containerReadme = readFileSync(join(dir, ".morpheus/container/README.md"), "utf8");
      expect(containerReadme).toContain("Morpheus container profile");
      expect(containerReadme).toContain("Docker-compatible runtime");
      expect(containerReadme).toContain("container-internal root for Docker sandbox compatibility");
      expect(containerReadme).toContain(
        "docker build -f .morpheus/container/Dockerfile -t morpheus-agent:local .",
      );
      expect(containerReadme).not.toContain("sandcastle");
      expect(readFileSync(join(dir, ".gitignore"), "utf8")).toContain(".morpheus/ledger.sqlite*");
      expect(readFileSync(join(dir, ".gitignore"), "utf8")).toContain(".morpheus/runs/");
      expect(readFileSync(join(dir, ".gitignore"), "utf8")).toContain(".morpheus/agent-logs/");
      expect(readFileSync(join(dir, ".gitignore"), "utf8")).toContain(".morpheus/cache/");
      expect(readFileSync(join(dir, ".gitignore"), "utf8")).toContain(
        ".morpheus/secrets/agent.env",
      );
      expect(readFileSync(join(dir, ".morpheus/secrets/agent.env.example"), "utf8")).toContain(
        "OPENAI_API_KEY=",
      );
      expect(
        result.status === "initialized"
          ? result.created.map((path) => path.slice(dir.length + 1)).sort()
          : [],
      ).toEqual(expectedInitFiles);
      expect(relativeFiles(dir)).toEqual(expectedInitFiles);
      expect(existsSync(join(dir, ".sandcastle"))).toBe(false);
      expect(existsSync(join(dir, ".morpheus/secrets/agent.env"))).toBe(false);
    });
  });

  it("detects target capabilities and renders operator setup guidance", () => {
    withTempDir((dir) => {
      writeFileSync(join(dir, "package.json"), JSON.stringify({ packageManager: "pnpm@10.26.0" }));
      writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
      writeFileSync(join(dir, "settings.gradle.kts"), "pluginManagement {}\n");
      writeFileSync(join(dir, "build.gradle.kts"), 'plugins { id("com.android.application") }\n');
      mkdirSync(join(dir, "App.xcodeproj"));
      writeFileSync(join(dir, "App.xcodeproj/project.pbxproj"), "// !$*UTF8*$!\n");

      const result = initMorpheusRepo({
        target: dir,
        gitlabProject: "group/project",
      });

      expect(result.status).toBe("initialized");
      expect(loadMorpheusConfig({ targetRepo: dir })).toMatchObject({
        status: "loaded",
        config: {
          verification: {
            toolchainProbes: expect.arrayContaining([
              expect.objectContaining({ name: "node", command: "node", args: ["--version"] }),
              expect.objectContaining({ name: "pnpm", command: "pnpm", args: ["--version"] }),
              expect.objectContaining({ name: "java", command: "java", args: ["-version"] }),
              expect.objectContaining({ name: "android-sdk", command: "sh" }),
              expect.objectContaining({ name: "xcode", command: "xcodebuild", args: ["-version"] }),
            ]),
          },
        },
      });

      const dockerfile = readFileSync(join(dir, ".morpheus/container/Dockerfile"), "utf8");
      expect(dockerfile).toContain("corepack enable");
      expect(dockerfile).toContain("apt-get install -y --no-install-recommends git ca-certificates");
      expect(dockerfile).toContain("npm install -g @openai/codex@0.133.0");
      expect(dockerfile).toContain("USER 0");
      expect(dockerfile).toContain('CMD ["sleep", "infinity"]');
      expect(dockerfile).not.toContain("android-sdk");
      expect(dockerfile).not.toContain("xcodebuild");

      const containerReadme = readFileSync(join(dir, ".morpheus/container/README.md"), "utf8");
      expect(containerReadme).toContain(
        "Detected capabilities: Node, pnpm, Android/Gradle, iOS/Xcode",
      );
      expect(containerReadme).toContain(
        "Morpheus does not auto-install Android SDK or Xcode in v1",
      );
      expect(containerReadme).toContain("Install JDK and Android SDK components");
      expect(containerReadme).toContain("Run Xcode setup on the macOS host");
    });
  });

  it("detects Android and iOS capabilities in nested project directories", () => {
    withTempDir((dir) => {
      mkdirSync(join(dir, "android"));
      mkdirSync(join(dir, "ios/App.xcworkspace"), { recursive: true });
      writeFileSync(join(dir, "android/settings.gradle.kts"), "pluginManagement {}\n");

      const result = initMorpheusRepo({
        target: dir,
        gitlabProject: "group/project",
      });

      expect(result.status).toBe("initialized");
      expect(loadMorpheusConfig({ targetRepo: dir })).toMatchObject({
        status: "loaded",
        config: {
          verification: {
            toolchainProbes: expect.arrayContaining([
              expect.objectContaining({ name: "java", scope: "container" }),
              expect.objectContaining({ name: "android-sdk", scope: "container" }),
              expect.objectContaining({ name: "xcode", scope: "host" }),
            ]),
          },
        },
      });

      const containerReadme = readFileSync(join(dir, ".morpheus/container/README.md"), "utf8");
      expect(containerReadme).toContain("Detected capabilities: Android/Gradle, iOS/Xcode");
      expect(containerReadme).toContain("Install JDK and Android SDK components");
      expect(containerReadme).toContain("Run Xcode setup on the macOS host");
    });
  });

  it("does not overwrite existing config or prompts without force", () => {
    withTempDir((dir) => {
      const configPath = join(dir, "morpheus.config.json");
      writeFileSync(configPath, "keep me");

      const result = initMorpheusRepo({
        target: dir,
        gitlabProject: "group/project",
      });

      expect(result).toEqual({
        status: "error",
        error: {
          kind: "existing_files",
          paths: [configPath],
        },
      });
      expect(readFileSync(configPath, "utf8")).toBe("keep me");
      expect(existsSync(join(dir, ".morpheus/prompts/prepare.md"))).toBe(false);
    });
  });

  it("does not overwrite edited target skill files without force", () => {
    withTempDir((dir) => {
      const skillPath = join(dir, ".morpheus/skills/matt-pocock-caveman/SKILL.md");
      mkdirSync(join(dir, ".morpheus/skills/matt-pocock-caveman"), { recursive: true });
      writeFileSync(skillPath, "edited skill");

      const result = initMorpheusRepo({
        target: dir,
        gitlabProject: "group/project",
      });

      expect(result).toEqual({
        status: "error",
        error: {
          kind: "existing_files",
          paths: [skillPath],
        },
      });
      expect(readFileSync(skillPath, "utf8")).toBe("edited skill");
    });
  });

  it("overwrites existing config, prompts, and container profile with force", () => {
    withTempDir((dir) => {
      writeConfig(dir, validConfig);
      const promptPath = join(dir, ".morpheus/prompts/prepare.md");
      const dockerfilePath = join(dir, ".morpheus/container/Dockerfile");
      const readmePath = join(dir, ".morpheus/container/README.md");
      const skillPath = join(dir, ".morpheus/skills/matt-pocock-caveman/SKILL.md");
      mkdirSync(join(dir, ".morpheus/prompts"), { recursive: true });
      mkdirSync(join(dir, ".morpheus/container"), { recursive: true });
      mkdirSync(join(dir, ".morpheus/skills/matt-pocock-caveman"), { recursive: true });
      writeFileSync(promptPath, "old prompt");
      writeFileSync(dockerfilePath, "old dockerfile");
      writeFileSync(readmePath, "old readme");
      writeFileSync(skillPath, "old skill");

      const result = initMorpheusRepo({
        target: dir,
        gitlabProject: "group/project",
        gitlabReadyLabel: "workflow:ready",
        targetBranch: "develop",
        force: true,
      });

      expect(result).toMatchObject({
        status: "initialized",
        updated: expect.arrayContaining([
          join(dir, "morpheus.config.json"),
          promptPath,
          dockerfilePath,
          readmePath,
          skillPath,
        ]),
      });
      expect(loadMorpheusConfig({ targetRepo: dir })).toMatchObject({
        status: "loaded",
        config: {
          gitlab: {
            project: "group/project",
            readyLabel: "workflow:ready",
            targetBranch: "develop",
          },
        },
      });
      expect(readFileSync(promptPath, "utf8")).toContain("Agent-Ready Contract");
      expect(readFileSync(dockerfilePath, "utf8")).toContain("Morpheus container profile");
      expect(readFileSync(readmePath, "utf8")).toContain("Docker-compatible runtime");
      expect(readFileSync(skillPath, "utf8")).toBe(
        readFileSync(join(packageRoot, "bundled-skills/matt-pocock-caveman/SKILL.md"), "utf8"),
      );
      expect(relativeFiles(dir)).toEqual(expectedInitFiles);
      expect(existsSync(join(dir, ".sandcastle"))).toBe(false);
      expect(existsSync(join(dir, ".morpheus/secrets/agent.env"))).toBe(false);
    });
  });
});
