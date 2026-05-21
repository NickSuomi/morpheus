import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OperatorHealth, ProcessRunner, type ProcessResult, type ProcessRunnerService } from "@morpheus/runtime";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { operatorHealthLayer } from "../src/index.js";

const ok = (): ProcessResult => ({
  stdout: "",
  stderr: "",
  exitCode: 0,
});

const failed = (stderr: string): ProcessResult => ({
  stdout: "",
  stderr,
  exitCode: 1,
});

const fakeProcessRunner = (results: readonly ProcessResult[]) => {
  const calls: Array<{ command: string; args: readonly string[] }> = [];
  const service: ProcessRunnerService = {
    run: (command, args) => {
      calls.push({ command, args });
      return Effect.succeed(results[calls.length - 1] ?? ok());
    },
  };

  return {
    calls,
    layer: Layer.succeed(ProcessRunner, service),
  };
};

const runWithHealth = <A, E>(
  processRunnerLayer: Layer.Layer<ProcessRunner>,
  program: Effect.Effect<A, E, OperatorHealth>,
) => Effect.runPromise(program.pipe(Effect.provide(operatorHealthLayer().pipe(Layer.provide(processRunnerLayer)))));

const runWithAuthHealth = <A, E>(
  processRunnerLayer: Layer.Layer<ProcessRunner>,
  cwd: string,
  program: Effect.Effect<A, E, OperatorHealth>,
) =>
  Effect.runPromise(
    program.pipe(
      Effect.provide(
        operatorHealthLayer({
          cwd,
          authEnvFile: ".morpheus/secrets/agent.env",
          authRequiredKeys: ["OPENAI_API_KEY"],
        }).pipe(Layer.provide(processRunnerLayer)),
      ),
    ),
  );

const runWithProbeHealth = <A, E>(
  processRunnerLayer: Layer.Layer<ProcessRunner>,
  program: Effect.Effect<A, E, OperatorHealth>,
) =>
  Effect.runPromise(
    program.pipe(
      Effect.provide(
        operatorHealthLayer({
          cwd: "/target",
          containerImage: "morpheus-agent:local",
          toolchainProbes: [
            {
              name: "java",
              command: "java",
              args: ["-version"],
              action: "Install a JDK and rebuild the Morpheus container image.",
              scope: "container",
            },
            {
              name: "android-sdk",
              command: "sh",
              args: ["-lc", "test -n \"$ANDROID_HOME\""],
              action: "Install Android SDK or set ANDROID_HOME for the container profile.",
              scope: "container",
            },
            {
              name: "xcode",
              command: "xcodebuild",
              args: ["-version"],
              action: "Run Xcode setup on the macOS host.",
              scope: "host",
            },
          ],
        }).pipe(Layer.provide(processRunnerLayer)),
      ),
    ),
  );

describe("OperatorHealth", () => {
  it("checks read-only adapter health through process runner commands", async () => {
    const processRunner = fakeProcessRunner([ok(), failed("not logged in"), ok(), ok(), ok(), ok(), ok(), ok()]);

    const checks = await runWithHealth(
      processRunner.layer,
      Effect.gen(function* () {
        const health = yield* OperatorHealth;
        return yield* health.check();
      }),
    );

    expect(checks).toEqual([
      { name: "beads", status: "ok", detail: "bd readable" },
      { name: "gitlab", status: "warn", detail: "not logged in" },
      {
        name: "docker",
        status: "ok",
        detail:
          "Docker-compatible runtime reachable via docker info (Docker Desktop, OrbStack, Colima, or remote Docker context)",
      },
      { name: "workspace", status: "ok", detail: "workspace readable" },
      { name: "labels", status: "ok", detail: "agent labels readable" },
      { name: "daemon", status: "ok", detail: "daemon assumptions readable" },
      { name: "containers", status: "ok", detail: "containers readable" },
      { name: "worktrees", status: "ok", detail: "worktrees readable" },
      { name: "config", status: "ok", detail: "config loaded" },
    ]);
    expect(processRunner.calls).toEqual([
      { command: "bd", args: ["list", "--limit", "1", "--json"] },
      { command: "glab", args: ["auth", "status"] },
      { command: "docker", args: ["info"] },
      { command: "git", args: ["rev-parse", "--show-toplevel"] },
      { command: "bd", args: ["list", "--label-pattern", "agent:*", "--limit", "1", "--json"] },
      { command: "git", args: ["status", "--short"] },
      { command: "docker", args: ["ps", "--format", "{{.ID}}"] },
      { command: "git", args: ["worktree", "list", "--porcelain"] },
    ]);
  });

  it("reports Docker failures with operator action", async () => {
    const processRunner = fakeProcessRunner([
      ok(),
      ok(),
      failed("Cannot connect to the Docker daemon"),
      ok(),
      ok(),
      ok(),
      failed("Cannot connect to the Docker daemon"),
      ok(),
    ]);

    const checks = await runWithHealth(
      processRunner.layer,
      Effect.gen(function* () {
        const health = yield* OperatorHealth;
        return yield* health.check();
      }),
    );

    expect(checks).toContainEqual({
      name: "docker",
      status: "warn",
      detail:
        "Cannot connect to the Docker daemon. Start a Docker-compatible runtime such as Docker Desktop, OrbStack, Colima, or a remote Docker context, then rerun morpheus doctor.",
    });
    expect(checks).toContainEqual({
      name: "containers",
      status: "warn",
      detail:
        "Cannot connect to the Docker daemon. Start a Docker-compatible runtime such as Docker Desktop, OrbStack, Colima, or a remote Docker context, then rerun morpheus doctor.",
    });
  });

  it("validates configured agent auth env without printing secret values", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-operator-health-"));
    mkdirSync(join(dir, ".morpheus/secrets"), { recursive: true });
    writeFileSync(join(dir, ".morpheus/secrets/agent.env"), "OPENAI_API_KEY=secret-value\n");
    const processRunner = fakeProcessRunner([ok(), ok(), ok(), ok(), ok(), ok(), ok(), ok()]);

    const checks = await runWithAuthHealth(
      processRunner.layer,
      dir,
      Effect.gen(function* () {
        const health = yield* OperatorHealth;
        return yield* health.check();
      }),
    );

    expect(checks).toContainEqual({
      name: "config",
      status: "ok",
      detail: "agent auth env file contains required keys: OPENAI_API_KEY",
    });
    expect(JSON.stringify(checks)).not.toContain("secret-value");
  });

  it("fails health when configured agent auth env misses required keys", async () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-operator-health-"));
    mkdirSync(join(dir, ".morpheus/secrets"), { recursive: true });
    writeFileSync(join(dir, ".morpheus/secrets/agent.env"), "OTHER_TOKEN=value\n");
    const processRunner = fakeProcessRunner([ok(), ok(), ok(), ok(), ok(), ok(), ok(), ok()]);

    const checks = await runWithAuthHealth(
      processRunner.layer,
      dir,
      Effect.gen(function* () {
        const health = yield* OperatorHealth;
        return yield* health.check();
      }),
    );

    expect(checks).toContainEqual({
      name: "config",
      status: "fail",
      detail: expect.stringContaining("Agent auth env file missing required keys: OPENAI_API_KEY"),
    });
    expect(JSON.stringify(checks)).not.toContain("value");
  });

  it("reports configured toolchain probe failures with operator action", async () => {
    const processRunner = fakeProcessRunner([
      ok(),
      ok(),
      ok(),
      ok(),
      ok(),
      ok(),
      ok(),
      ok(),
      failed("java: command not found"),
      failed("ANDROID_HOME is unset"),
      failed("xcode-select: error"),
    ]);

    const checks = await runWithProbeHealth(
      processRunner.layer,
      Effect.gen(function* () {
        const health = yield* OperatorHealth;
        return yield* health.check();
      }),
    );

    expect(checks).toContainEqual({
      name: "toolchain",
      status: "fail",
      detail: "java missing: java: command not found. Install a JDK and rebuild the Morpheus container image.",
    });
    expect(checks).toContainEqual({
      name: "toolchain",
      status: "fail",
      detail:
        "android-sdk missing: ANDROID_HOME is unset. Install Android SDK or set ANDROID_HOME for the container profile.",
    });
    expect(checks).toContainEqual({
      name: "toolchain",
      status: "fail",
      detail: "xcode missing: xcode-select: error. Run Xcode setup on the macOS host.",
    });
    expect(processRunner.calls.slice(-3)).toEqual([
      {
        command: "docker",
        args: [
          "run",
          "--rm",
          "-v",
          "/target:/workspace",
          "-w",
          "/workspace",
          "morpheus-agent:local",
          "java",
          "-version",
        ],
      },
      {
        command: "docker",
        args: [
          "run",
          "--rm",
          "-v",
          "/target:/workspace",
          "-w",
          "/workspace",
          "morpheus-agent:local",
          "sh",
          "-lc",
          "test -n \"$ANDROID_HOME\"",
        ],
      },
      { command: "xcodebuild", args: ["-version"] },
    ]);
  });
});
