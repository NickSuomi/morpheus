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
) => Effect.runPromise(program.pipe(Effect.provide(operatorHealthLayer.pipe(Layer.provide(processRunnerLayer)))));

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
      { name: "docker", status: "ok", detail: "docker reachable" },
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
});
