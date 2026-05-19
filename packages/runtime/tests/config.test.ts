import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initMorpheusRepo, loadMorpheusConfig } from "../src/index.js";

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
  agentRunner: { kind: "sandcastle" },
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
      expect(readFileSync(join(dir, ".morpheus/prompts/implement.md"), "utf8")).toContain(
        "Implement the prepared contract only.",
      );
      expect(readFileSync(join(dir, ".morpheus/prompts/review.md"), "utf8")).toContain(
        "Stay read-only.",
      );
      expect(readFileSync(join(dir, ".gitignore"), "utf8")).toContain(".morpheus/ledger.sqlite*");
      expect(readFileSync(join(dir, ".gitignore"), "utf8")).toContain(".morpheus/runs/");
      expect(readFileSync(join(dir, ".gitignore"), "utf8")).toContain(".morpheus/agent-logs/");
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

  it("overwrites existing config and prompts with force", () => {
    withTempDir((dir) => {
      writeConfig(dir, validConfig);
      const promptPath = join(dir, ".morpheus/prompts/prepare.md");
      mkdirSync(join(dir, ".morpheus/prompts"), { recursive: true });
      writeFileSync(promptPath, "old prompt");

      const result = initMorpheusRepo({
        target: dir,
        gitlabProject: "group/project",
        gitlabReadyLabel: "workflow:ready",
        targetBranch: "develop",
        force: true,
      });

      expect(result).toMatchObject({
        status: "initialized",
        updated: expect.arrayContaining([join(dir, "morpheus.config.json"), promptPath]),
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
    });
  });
});
