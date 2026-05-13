#!/usr/bin/env node
import { Args, Command, Options } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Effect, Layer, Option } from "effect";
import { dirname, isAbsolute, resolve } from "node:path";
import { sqliteRunLedgerLayer } from "@morpheus/adapters";
import {
  listRunsForCli,
  loadMorpheusConfig,
  RunLedger,
  showRunForCli,
  showRunLogsForCli,
  type RunLedgerPersistenceError,
} from "@morpheus/runtime";
import pkg from "../package.json" with { type: "json" };

const configPath = Options.text("config").pipe(Options.optional);
const runId = Args.text({ name: "runId" });

const formatConfigSummary = (
  result: ReturnType<typeof loadMorpheusConfig>,
): Effect.Effect<void, Error> => {
  if (result.status === "error") {
    return Effect.fail(new Error(`${result.error.kind}: ${result.error.path}`));
  }

  const { config } = result;

  return Console.log(
    [
      "Morpheus config",
      `path: ${result.path}`,
      `targetRepo: ${config.targetRepo}`,
      `ledger: ${config.ledger.path}`,
      `issueTracker: ${config.issueTracker.kind}`,
      `mergeRequests: ${config.mergeRequests.kind}`,
      `agentRunner: ${config.agentRunner.kind}`,
      `lanes: preparation=${config.lanes.preparation.concurrency} implementation=${config.lanes.implementation.concurrency} review=${config.lanes.review.concurrency}`,
    ].join("\n"),
  );
};

const ledgerLayerFromConfig = (
  pathOption: Option.Option<string>,
): Effect.Effect<Layer.Layer<RunLedger, RunLedgerPersistenceError>, Error> =>
  Effect.sync(() => {
    const result = loadMorpheusConfig({
      configPath: Option.getOrUndefined(pathOption),
    });

    if (result.status === "error") {
      throw new Error(`${result.error.kind}: ${result.error.path}`);
    }

    const configDirectory = dirname(result.path);
    const ledgerPath = isAbsolute(result.config.ledger.path)
      ? result.config.ledger.path
      : resolve(configDirectory, result.config.ledger.path);

    return sqliteRunLedgerLayer({
      ledgerPath,
      runsDirectory: resolve(configDirectory, ".morpheus", "runs"),
    });
  });

const provideLedger = <A, E>(
  pathOption: Option.Option<string>,
  program: Effect.Effect<A, E, RunLedger>,
): Effect.Effect<A, E | Error> =>
  Effect.flatMap(ledgerLayerFromConfig(pathOption), (ledgerLayer) =>
    Effect.provide(program, ledgerLayer),
  );

const configShow = Command.make("show", { configPath }, ({ configPath }) =>
  formatConfigSummary(
    loadMorpheusConfig({
      configPath: Option.getOrUndefined(configPath),
    }),
  ),
).pipe(Command.withDescription("Show validated Morpheus config summary"));

const config = Command.make("config", {}, () => Console.log("Morpheus config commands")).pipe(
  Command.withDescription("Inspect Morpheus config"),
  Command.withSubcommands([configShow]),
);

const runs = Command.make("runs", { configPath }, ({ configPath }) =>
  provideLedger(configPath, listRunsForCli).pipe(Effect.flatMap((output) => Console.log(output))),
).pipe(Command.withDescription("List Morpheus runs"));

const runDetail = Command.make("run", { runId, configPath }, ({ runId, configPath }) =>
  provideLedger(configPath, showRunForCli(runId)).pipe(
    Effect.flatMap((output) => Console.log(output)),
  ),
).pipe(Command.withDescription("Show one Morpheus run"));

const logs = Command.make("logs", { runId, configPath }, ({ runId, configPath }) =>
  provideLedger(configPath, showRunLogsForCli(runId)).pipe(
    Effect.flatMap((output) => Console.log(output)),
  ),
).pipe(Command.withDescription("Show Morpheus run logs"));

const command = Command.make("morpheus", {}, () =>
  Console.log("Morpheus local agent orchestration"),
).pipe(
  Command.withDescription("Morpheus local agent orchestration"),
  Command.withSubcommands([config, runs, runDetail, logs]),
);

const run = Command.run(command, {
  name: "Morpheus",
  version: pkg.version,
});

run(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);
