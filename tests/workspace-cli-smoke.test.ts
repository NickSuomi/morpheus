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
    kind: "api-key",
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
} as const;

const seedLedger = (ledgerPath: string, runsDirectory: string): string =>
  execFileSync(
    "node",
    [
      "--input-type=module",
      "-e",
      `
        import { Effect } from "effect";
        import { sqliteRunLedgerLayer } from "./dist/index.mjs";
        import { RunLedger } from "../runtime/dist/index.mjs";

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
      cwd: join(process.cwd(), "packages/adapters"),
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
  }, 20_000);

  it("prints version", () => {
    const output = runPnpm(["--filter", "@morpheus/cli", "morpheus", "--version"]);
    const expectedVersion = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ).version;

    expect(output.trim().split("\n").at(-1)).toBe(expectedVersion);
  }, 20_000);

  it("manages Morpheus-owned Codex auth through login, status, and logout", () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-cli-auth-"));
    try {
      const binDir = join(dir, "bin");
      mkdirSync(binDir);
      const codexPath = join(binDir, "codex");
      writeFileSync(
        codexPath,
        `#!/bin/sh
if [ "$1" = "login" ] && [ "$2" = "status" ]; then
  if [ -f "$CODEX_HOME/auth.json" ]; then
    printf 'Logged in using ChatGPT\n'
    exit 0
  fi
  printf 'Not logged in\n'
  exit 1
fi
if [ "$1" = "login" ]; then
  mkdir -p "$CODEX_HOME"
  printf '{}\n' > "$CODEX_HOME/auth.json"
  exit 0
fi
if [ "$1" = "logout" ]; then
  rm -f "$CODEX_HOME/auth.json"
  exit 0
fi
exit 1
`,
      );
      chmodSync(codexPath, 0o755);
      const env = {
        MORPHEUS_HOME: dir,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
      };

      const login = runPnpm(
        ["--filter", "@morpheus/cli", "morpheus", "auth", "login", "codex"],
        env,
      );
      const status = runPnpm(
        ["--filter", "@morpheus/cli", "morpheus", "auth", "status", "--json"],
        env,
      );
      const logout = runPnpm(
        ["--filter", "@morpheus/cli", "morpheus", "auth", "logout", "codex"],
        env,
      );

      expect(login).toContain("Codex ChatGPT login: ready");
      expect(JSON.parse(status.trim())).toEqual({
        provider: "codex",
        status: "logged-in",
        mode: "chatgpt",
      });
      expect(logout).toContain("Codex ChatGPT login: not configured");
      expect(existsSync(join(dir, "auth", "codex", "auth.json"))).toBe(false);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  }, 20_000);

  it("reuses an existing ChatGPT login during non-interactive setup", () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-cli-existing-chatgpt-"));
    try {
      execFileSync("git", ["init", "-b", "main"], { cwd: dir, stdio: "ignore" });
      const binDir = join(dir, "bin");
      const morpheusHome = join(dir, "home");
      const authHome = join(morpheusHome, "auth", "codex");
      const codexLog = join(dir, "codex-calls.log");
      mkdirSync(binDir);
      mkdirSync(authHome, { recursive: true });
      writeFileSync(join(authHome, "auth.json"), "{}\n");

      const shims: Record<string, string> = {
        bd: "#!/bin/sh\nprintf '[]\\n'\n",
        glab: '#!/bin/sh\nif [ "$1" = auth ] && [ "$2" = status ]; then printf \'Logged in\\n\'; fi\nexit 0\n',
        docker: "#!/bin/sh\nexit 0\n",
        codex: `#!/bin/sh
printf '%s\\n' "$*" >> "$MORPHEUS_TEST_CODEX_LOG"
if [ "$1" = "login" ] && [ "$2" = "status" ]; then
  printf 'Logged in using ChatGPT\\n' >&2
  exit 0
fi
printf 'unexpected Codex invocation: %s\\n' "$*" >&2
exit 1
`,
      };
      for (const [command, script] of Object.entries(shims)) {
        const path = join(binDir, command);
        writeFileSync(path, script);
        chmodSync(path, 0o755);
      }

      const output = runPnpm(
        [
          "--filter",
          "@morpheus/cli",
          "morpheus",
          "setup",
          "--yes",
          "--target",
          dir,
          "--gitlab-project",
          "group/project",
          "--auth",
          "chatgpt",
          "--no-build",
          "--no-sync",
        ],
        {
          MORPHEUS_HOME: morpheusHome,
          MORPHEUS_TEST_CODEX_LOG: codexLog,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
        },
      );

      expect(output).toContain("OK config: Codex ChatGPT login ready");
      expect(output).not.toContain("device code");
      expect(readFileSync(codexLog, "utf8").trim().split("\n")).toEqual([
        "login status",
        "login status",
        "login status",
      ]);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  }, 20_000);

  it("requires one explicit non-interactive auth source and rejects mixed auth flags", () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-cli-auth-selection-"));
    try {
      const base = [
        "--filter",
        "@morpheus/cli",
        "morpheus",
        "setup",
        "--yes",
        "--target",
        dir,
        "--gitlab-project",
        "group/project",
        "--no-build",
      ] as const;

      const missing = runPnpmFailure(base);
      expect(`${missing.stdout}\n${missing.stderr}`).toContain(
        "Non-interactive setup requires --auth chatgpt or --auth api-key.",
      );

      const mixedSubscription = runPnpmFailure([
        ...base,
        "--auth",
        "chatgpt",
        "--device-auth",
        "--auth-env-file",
        ".morpheus/secrets/agent.env",
      ]);
      expect(`${mixedSubscription.stdout}\n${mixedSubscription.stderr}`).toContain(
        "ChatGPT setup does not accept API-key options",
      );

      const mixedApiKey = runPnpmFailure([...base, "--auth", "api-key", "--device-auth"]);
      expect(`${mixedApiKey.stdout}\n${mixedApiKey.stderr}`).toContain(
        "API-key setup does not accept --device-auth.",
      );

      const removedSecretFlag = runPnpmFailure([
        ...base,
        "--auth",
        "api-key",
        "--auth-secret",
        "OPENAI_API_KEY=not-a-real-key",
      ]);
      const removedSecretFlagOutput = `${removedSecretFlag.stdout}\n${removedSecretFlag.stderr}`;
      expect(removedSecretFlagOutput).toContain("auth-secret");
      expect(removedSecretFlagOutput).not.toContain("not-a-real-key");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  }, 20_000);

  it("keeps deamon alias and prints friendly invalid-command errors", () => {
    const deamonHelp = runPnpm(["--filter", "@morpheus/cli", "morpheus", "deamon", "--help"]);
    expect(deamonHelp).toContain("Alias for daemon");

    const result = runPnpmFailure(["--filter", "@morpheus/cli", "morpheus", "demon"]);
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain("Invalid subcommand for morpheus");
    expect(output).toContain('Run "morpheus --help" to see available commands.');
    expect(output).not.toContain("CommandMismatch");
    expect(output).not.toContain('"_tag"');
    expect(output).not.toContain("ERROR (#");
  }, 20_000);

  it("prints missing config errors without runtime stack dumps", () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-cli-missing-config-"));
    try {
      const result = runPnpmFailure([
        "--filter",
        "@morpheus/cli",
        "morpheus",
        "doctor",
        "--config",
        join(dir, "morpheus.config.json"),
      ]);
      const output = `${result.stdout}\n${result.stderr}`;

      expect(result.status).not.toBe(0);
      expect(output).toContain("Error: missing_config:");
      expect(output).not.toContain("fiberRuntime");
      expect(output).not.toContain("ERROR (#");
      expect(output).not.toContain('"_tag"');
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  }, 20_000);

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
        '"kind": "chatgpt"',
      );
      expect(readFileSync(join(dir, "morpheus.config.json"), "utf8")).toContain(
        '"directory": ".morpheus/skills"',
      );
      expect(readFileSync(join(dir, "morpheus.config.json"), "utf8")).toContain(
        '"name": "matt-pocock-to-spec"',
      );
      expect(existsSync(join(dir, ".morpheus/prompts/prepare.md"))).toBe(true);
      expect(existsSync(join(dir, ".morpheus/prompts/implement.md"))).toBe(true);
      expect(existsSync(join(dir, ".morpheus/prompts/review.md"))).toBe(true);
      expect(existsSync(join(dir, ".morpheus/skills/matt-pocock-to-spec/SKILL.md"))).toBe(true);
      expect(
        readFileSync(join(dir, ".morpheus/skills/matt-pocock-to-spec/SKILL.md"), "utf8"),
      ).toContain("produces a spec");
      expect(existsSync(join(dir, ".morpheus/container/Dockerfile"))).toBe(true);
      expect(existsSync(join(dir, ".morpheus/container/README.md"))).toBe(true);
      expect(readFileSync(join(dir, ".gitignore"), "utf8")).toContain(".morpheus/runs/");
      expect(readFileSync(join(dir, ".gitignore"), "utf8")).toContain(".morpheus/cache/");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("writes setup files and hands off cleanly when auth is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-cli-setup-auth-"));
    try {
      execFileSync("git", ["init", "-b", "main"], { cwd: dir, stdio: "ignore" });
      const binDir = join(dir, "bin");
      mkdirSync(binDir);
      const shims: Record<string, string> = {
        bd: "#!/bin/sh\nprintf '[]\\n'\n",
        glab: "#!/bin/sh\nexit 0\n",
        docker: "#!/bin/sh\nexit 0\n",
      };
      for (const [command, script] of Object.entries(shims)) {
        const path = join(binDir, command);
        writeFileSync(path, script);
        chmodSync(path, 0o755);
      }

      const output = runPnpm(
        [
          "--filter",
          "@morpheus/cli",
          "morpheus",
          "setup",
          "--yes",
          "--target",
          dir,
          "--gitlab-project",
          "group/project",
          "--auth",
          "api-key",
          "--no-build",
        ],
        { PATH: `${binDir}:${process.env.PATH ?? ""}` },
      );

      expect(existsSync(join(dir, "morpheus.config.json"))).toBe(true);
      expect(existsSync(join(dir, ".morpheus/secrets/agent.env.example"))).toBe(true);
      expect(readFileSync(join(dir, ".morpheus/secrets/agent.env"), "utf8")).toBe(
        [
          "# Morpheus setup may write these values when explicitly provided.",
          "# Keep this file local and do not commit real token values.",
          "OPENAI_API_KEY=",
          "",
        ].join("\n"),
      );
      expect(output).toContain(
        "Daemon once not ready: Provide agent auth in .morpheus/secrets/agent.env with non-empty required keys: OPENAI_API_KEY. Edit the local file directly or populate it with your secret manager.",
      );
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  }, 20_000);

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

  it("fails prepare command terminally when Docker-compatible runtime is unavailable", () => {
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
      const bdStatePath = join(dir, "bd-label.txt");
      writeFileSync(bdStatePath, "agent:ready");
      const bdPath = join(binDir, "bd");
      writeFileSync(
        bdPath,
        `#!/usr/bin/env node
const fs = require("node:fs");
const statePath = ${JSON.stringify(bdStatePath)};
const args = process.argv.slice(2);
const label = fs.readFileSync(statePath, "utf8").trim() || "agent:ready";
if (args[0] === "show" && args[1] === "morph-runtime" && args.includes("--json")) {
  process.stdout.write(JSON.stringify({
    id: "morph-runtime",
    title: "Runtime preflight",
    description: "Exercise Docker-compatible runtime preflight.",
    labels: [label],
    priority: 1
  }));
  process.exit(0);
}
if (args[0] === "update" && args[1] === "morph-runtime") {
  const nextLabels = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--set-labels" && args[index + 1] !== undefined) {
      nextLabels.push(args[index + 1]);
    }
  }
  fs.writeFileSync(statePath, nextLabels[0] ?? label);
  process.exit(0);
}
process.stderr.write("unexpected bd args: " + args.join(" ") + "\\n");
process.exit(1);
`,
      );
      chmodSync(bdPath, 0o755);
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
      expect(readFileSync(bdStatePath, "utf8")).toBe("agent:failed");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  }, 20_000);
});
