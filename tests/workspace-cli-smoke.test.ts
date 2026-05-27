import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cliArgs = (args: readonly string[]) => {
  const prefix = ["--filter", "@morpheus/cli", "morpheus"];
  if (prefix.every((value, index) => args[index] === value)) {
    return [
      "node",
      [join(process.cwd(), "packages/cli/dist/index.mjs"), ...args.slice(prefix.length)],
    ] as const;
  }
  return ["pnpm", args] as const;
};

const runPnpm = (args: readonly string[], env: Record<string, string> = {}) => {
  const [command, commandArgs] = cliArgs(args);
  return execFileSync(command, commandArgs, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
  });
};

const runPnpmFailure = (args: readonly string[], env: Record<string, string> = {}) => {
  const [command, commandArgs] = cliArgs(args);
  return spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
  });
};

const buildCli = () => {
  if (
    existsSync(join(process.cwd(), "packages/runtime/dist/index.mjs")) &&
    existsSync(join(process.cwd(), "packages/adapters/dist/index.mjs")) &&
    existsSync(join(process.cwd(), "packages/cli/dist/index.mjs"))
  ) {
    return;
  }

  runPnpm(["--filter", "@morpheus/runtime", "build"]);
  runPnpm(["--filter", "@morpheus/adapters", "build"]);
  runPnpm(["--filter", "@morpheus/cli", "build"]);
};

const validAgentRunnerConfig = {
  kind: "container",
  agent: {
    provider: "codex",
    model: "gpt-5.4-mini",
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
} as const;

const seedLedger = (ledgerPath: string, runsDirectory: string): string =>
  execFileSync(
    "pnpm",
    [
      "--filter",
      "@morpheus/adapters",
      "exec",
      "node",
      "--input-type=module",
      "-e",
      `
        import { Effect } from "effect";
        import { sqliteRunLedgerLayer } from "@morpheus/adapters";
        import { RunLedger } from "@morpheus/runtime";

        const run = await Effect.runPromise(
          Effect.gen(function* () {
            const ledger = yield* RunLedger;
            const run = yield* ledger.createPreparationRun({
              issueId: "morph-7o3",
              summary: "Record fake preparation run in RunLedger"
            });
            yield* ledger.writeRunArtifacts(run.id, {
              transcript: "fake preparation transcript",
              artifact: JSON.stringify({ result: "blocked" })
            });
            yield* ledger.finishRun(run.id, {
              status: "failed",
              failureKind: "agent_contract_error",
              message: "Fake preparation could not produce a valid contract."
            });
            return run;
          }).pipe(
            Effect.provide(
              sqliteRunLedgerLayer({
                ledgerPath: ${JSON.stringify(ledgerPath)},
                runsDirectory: ${JSON.stringify(runsDirectory)}
              })
            )
          )
        );

        console.log(run.id);
      `,
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  ).trim();

describe("morpheus cli", () => {
  beforeAll(() => {
    buildCli();
  }, 20_000);

  it("prints help", () => {
    const output = runPnpm(["--filter", "@morpheus/cli", "morpheus", "--help"]);

    expect(output).toContain("Morpheus");
  });

  it("prints version", () => {
    const output = runPnpm(["--filter", "@morpheus/cli", "morpheus", "--version"]);

    expect(output.trim().split("\n").at(-1)).toBe("0.1.10");
  });

  it("shows a validated config summary", () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-cli-config-"));
    try {
      const configPath = join(dir, "morpheus.config.json");
      writeFileSync(
        configPath,
        JSON.stringify(
          {
            targetRepo: ".",
            issueTracker: { kind: "beads" },
            gitlab: {
              project: "group/project",
              readyLabel: "agent:ready",
              targetBranch: "main",
            },
            daemon: { pollIntervalSeconds: 30 },
            mergeRequests: { kind: "gitlab-glab" },
            agentRunner: validAgentRunnerConfig,
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
          },
          null,
          2,
        ),
      );

      const output = runPnpm([
        "--filter",
        "@morpheus/cli",
        "morpheus",
        "config",
        "show",
        "--config",
        configPath,
      ]);

      expect(output).toContain("Morpheus config");
      expect(output).toContain("targetRepo: .");
      expect(output).toContain("ledger: .morpheus/ledger.sqlite");
      expect(output).toContain("issueTracker: beads");
      expect(output).toContain(
        "gitlab: project=group/project readyLabel=agent:ready targetBranch=main",
      );
      expect(output).toContain("daemon: pollIntervalSeconds=30");
      expect(output).toContain("mergeRequests: gitlab-glab");
      expect(output).toContain("agentRunner: container");
      expect(output).toContain("lanes: preparation=1 implementation=1 review=1");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("renders run summaries, run detail, and logs from the configured ledger", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-cli-runs-"));
    try {
      const configPath = join(dir, "morpheus.config.json");
      const ledgerPath = join(dir, ".morpheus", "ledger.sqlite");
      const runsDirectory = join(dir, ".morpheus", "runs");
      writeFileSync(
        configPath,
        JSON.stringify(
          {
            targetRepo: ".",
            issueTracker: { kind: "beads" },
            gitlab: {
              project: "group/project",
              readyLabel: "agent:ready",
              targetBranch: "main",
            },
            daemon: { pollIntervalSeconds: 30 },
            mergeRequests: { kind: "gitlab-glab" },
            agentRunner: validAgentRunnerConfig,
            ledger: { path: ledgerPath },
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
          },
          null,
          2,
        ),
      );
      const runId = seedLedger(ledgerPath, runsDirectory);

      const runsOutput = runPnpm([
        "--filter",
        "@morpheus/cli",
        "morpheus",
        "runs",
        "--config",
        configPath,
      ]);
      expect(runsOutput).toContain(runId);
      expect(runsOutput).toContain("morph-7o3");
      expect(runsOutput).toContain("preparation");
      expect(runsOutput).toContain("failed");

      const runOutput = runPnpm([
        "--filter",
        "@morpheus/cli",
        "morpheus",
        "run",
        runId,
        "--config",
        configPath,
      ]);
      expect(runOutput).toContain(`Run ${runId}`);
      expect(runOutput).toContain("PreparationStarted");
      expect(runOutput).toContain("RunArtifactsWritten");
      expect(runOutput).toContain("PreparationFailed");
      expect(runOutput).toContain("failureKind: agent_contract_error");
      expect(runOutput).toContain("transcript.txt");

      const logsOutput = runPnpm([
        "--filter",
        "@morpheus/cli",
        "morpheus",
        "logs",
        runId,
        "--config",
        configPath,
      ]);
      expect(logsOutput).toContain("fake preparation transcript");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  }, 20_000);

  it("exposes one-shot agent workflow commands", () => {
    const output = runPnpm(["--filter", "@morpheus/cli", "morpheus", "--help"]);

    expect(output).toContain("prepare");
    expect(output).toContain("implement");
    expect(output).toContain("review");
  });

  it("initializes Morpheus files in a target repo", () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-cli-init-"));
    try {
      const output = runPnpm([
        "--filter",
        "@morpheus/cli",
        "morpheus",
        "init",
        "--target",
        dir,
        "--gitlab-project",
        "group/project",
      ]);

      expect(output).toContain("Morpheus initialized");
      expect(output).toContain(`target: ${dir}`);
      expect(output).toContain(`config: ${join(dir, "morpheus.config.json")}`);
      expect(readFileSync(join(dir, "morpheus.config.json"), "utf8")).toContain(
        '"readyLabel": "agent:ready"',
      );
      expect(readFileSync(join(dir, "morpheus.config.json"), "utf8")).toContain(
        '"targetBranch": "main"',
      );
      expect(readFileSync(join(dir, "morpheus.config.json"), "utf8")).toContain(
        '"directory": ".morpheus/skills"',
      );
      expect(readFileSync(join(dir, "morpheus.config.json"), "utf8")).toContain(
        '"name": "matt-pocock-caveman"',
      );
      expect(existsSync(join(dir, ".morpheus/prompts/prepare.md"))).toBe(true);
      expect(existsSync(join(dir, ".morpheus/prompts/implement.md"))).toBe(true);
      expect(existsSync(join(dir, ".morpheus/prompts/review.md"))).toBe(true);
      expect(existsSync(join(dir, ".morpheus/skills/matt-pocock-caveman/SKILL.md"))).toBe(true);
      expect(
        readFileSync(join(dir, ".morpheus/skills/matt-pocock-caveman/SKILL.md"), "utf8"),
      ).toContain("Ultra-compressed communication mode");
      expect(existsSync(join(dir, ".morpheus/container/Dockerfile"))).toBe(true);
      expect(existsSync(join(dir, ".morpheus/container/README.md"))).toBe(true);
      expect(readFileSync(join(dir, ".gitignore"), "utf8")).toContain(".morpheus/runs/");
      expect(readFileSync(join(dir, ".gitignore"), "utf8")).toContain(".morpheus/cache/");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("smokes the ALPHA fixture target repo through doctor and daemon once", () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-alpha-fixture-"));
    try {
      const fixtureRoot = join(process.cwd(), "fixtures", "alpha-target-repo");
      cpSync(fixtureRoot, dir, { recursive: true });
      execFileSync("git", ["init"], { cwd: dir, stdio: "ignore" });

      const binDir = join(dir, "bin");
      mkdirSync(binDir);
      const shims: Record<string, string> = {
        bd: "#!/bin/sh\nprintf '[]\\n'\n",
        glab: "#!/bin/sh\nif [ \"$1\" = auth ] && [ \"$2\" = status ]; then printf 'Logged in\\n'; exit 0; fi\nprintf '[]\\n'\n",
        docker: "#!/bin/sh\nexit 0\n",
      };
      for (const [command, script] of Object.entries(shims)) {
        const path = join(binDir, command);
        writeFileSync(path, script);
        chmodSync(path, 0o755);
      }

      const env = { PATH: `${binDir}:${process.env.PATH ?? ""}` };
      const configPath = join(dir, "morpheus.config.json");

      const doctorOutput = runPnpm(
        ["--filter", "@morpheus/cli", "morpheus", "doctor", "--config", configPath],
        env,
      );
      expect(doctorOutput).toContain("Morpheus doctor");
      expect(doctorOutput).not.toContain("FAIL ");
      expect(doctorOutput).toContain("OK config: agent auth env file contains required keys");

      const daemonOutput = runPnpm(
        ["--filter", "@morpheus/cli", "morpheus", "daemon", "--once", "--config", configPath],
        env,
      );
      expect(daemonOutput).toContain("Morpheus daemon tick");
      expect(daemonOutput).toContain("selected: preparation=0 implementation=0 review=0");
      expect(daemonOutput).toContain("work: None");

      const readme = readFileSync(join(dir, "README.md"), "utf8");
      expect(readme).toContain("ALPHA E2E smoke fixture");
      expect(readme).toContain("morpheus doctor");
      expect(readme).toContain("morpheus daemon --once");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  }, 20_000);

  it("runs daemon once and reports no work", () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-cli-daemon-"));
    try {
      const binDir = join(dir, "bin");
      mkdirSync(binDir);
      for (const command of ["glab", "bd"]) {
        const path = join(binDir, command);
        writeFileSync(path, "#!/bin/sh\nprintf '[]\\n'\n");
        chmodSync(path, 0o755);
      }

      const configPath = join(dir, "morpheus.config.json");
      writeFileSync(
        configPath,
        JSON.stringify(
          {
            targetRepo: ".",
            issueTracker: { kind: "beads" },
            gitlab: {
              project: "group/project",
              readyLabel: "agent:ready",
              targetBranch: "main",
            },
            daemon: { pollIntervalSeconds: 30 },
            mergeRequests: { kind: "gitlab-glab" },
            agentRunner: validAgentRunnerConfig,
            ledger: { path: join(dir, ".morpheus", "ledger.sqlite") },
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
          },
          null,
          2,
        ),
      );

      const output = runPnpm(
        ["--filter", "@morpheus/cli", "morpheus", "daemon", "--once", "--config", configPath],
        { PATH: `${binDir}:${process.env.PATH ?? ""}` },
      );

      expect(output).toContain("Morpheus daemon tick");
      expect(output).toContain("selected: preparation=0 implementation=0 review=0");
      expect(output).toContain("work: None");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  }, 20_000);

  it("fails prepare command before Beads mutation when Docker-compatible runtime is unavailable", () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-cli-prepare-docker-"));
    try {
      const binDir = join(dir, "bin");
      mkdirSync(binDir);
      const dockerPath = join(binDir, "docker");
      writeFileSync(
        dockerPath,
        "#!/bin/sh\nprintf 'Cannot connect to the Docker daemon\\n' >&2\nexit 1\n",
      );
      chmodSync(dockerPath, 0o755);
      mkdirSync(join(dir, ".morpheus", "secrets"), { recursive: true });
      writeFileSync(join(dir, ".morpheus", "secrets", "agent.env"), "OPENAI_API_KEY=test\n");

      const configPath = join(dir, "morpheus.config.json");
      writeFileSync(
        configPath,
        JSON.stringify(
          {
            targetRepo: ".",
            issueTracker: { kind: "beads" },
            gitlab: {
              project: "group/project",
              readyLabel: "agent:ready",
              targetBranch: "main",
            },
            daemon: { pollIntervalSeconds: 30 },
            mergeRequests: { kind: "gitlab-glab" },
            agentRunner: validAgentRunnerConfig,
            ledger: { path: join(dir, ".morpheus", "ledger.sqlite") },
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
          },
          null,
          2,
        ),
      );

      const result = runPnpmFailure(
        [
          "--filter",
          "@morpheus/cli",
          "morpheus",
          "prepare",
          "morph-runtime",
          "--config",
          configPath,
        ],
        { PATH: `${binDir}:${process.env.PATH ?? ""}` },
      );

      expect(result.status).not.toBe(0);
      expect(result.stdout).toContain("Failed morph-runtime");
      expect(result.stdout).toContain("failureKind: operator_access");
      expect(result.stdout).toContain("Docker-compatible runtime unavailable");
      expect(result.stdout).toContain("Docker Desktop, OrbStack, Colima, or remote Docker context");
      expect(result.stderr).not.toContain("bd");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  }, 20_000);
});
