import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const runPnpm = (args: readonly string[], env: Record<string, string> = {}) =>
  execFileSync("pnpm", args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

const buildCli = () => {
  runPnpm(["--filter", "@morpheus/runtime", "build"]);
  runPnpm(["--filter", "@morpheus/adapters", "build"]);
  runPnpm(["--filter", "@morpheus/cli", "build"]);
};

const validAgentRunnerConfig = {
  kind: "container",
  agent: {
    provider: "codex",
    model: "gpt-5.4-nano",
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
    mappings: [],
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

    expect(output.trim().split("\n").at(-1)).toBe("0.1.0");
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
      expect(existsSync(join(dir, ".morpheus/prompts/prepare.md"))).toBe(true);
      expect(existsSync(join(dir, ".morpheus/prompts/implement.md"))).toBe(true);
      expect(existsSync(join(dir, ".morpheus/prompts/review.md"))).toBe(true);
      expect(readFileSync(join(dir, ".gitignore"), "utf8")).toContain(".morpheus/runs/");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

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
  });
});
