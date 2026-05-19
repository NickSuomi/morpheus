#!/usr/bin/env node
import { Args, Command, Options } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Effect, Layer, Option } from "effect";
import { dirname, isAbsolute, resolve } from "node:path";
import {
  beadsIssueTrackerLayer,
  gitWorkspaceRuntimeLayer,
  glabIssueSourceLayer,
  glabMergeRequestClientLayer,
  nodeProcessRunnerLayer,
  operatorHealthLayer,
  sandcastleAgentRunnerLayer,
  sqliteRunLedgerLayer,
} from "@morpheus/adapters";
import {
  AgentRunner,
  GitLabIssueSource,
  IssueTracker,
  listRunsForCli,
  loadMorpheusConfig,
  MergeRequestClient,
  OperatorHealth,
  operatorDoctorForCli,
  operatorSliceForCli,
  operatorStatusForCli,
  prepareIssueForCli,
  pruneRunsForCli,
  reviewIssueForCli,
  RunLedger,
  showRunForCli,
  showRunLogsForCli,
  startImplementationForCli,
  syncGitLabIssuesForCli,
  type MorpheusConfig,
  type RunLedgerPersistenceError,
  WorkspaceRuntime,
} from "@morpheus/runtime";
import pkg from "../package.json" with { type: "json" };

const configPath = Options.text("config").pipe(Options.optional);
const runId = Args.text({ name: "runId" });
const issueId = Args.text({ name: "issueId" });

type LoadedCliConfig = {
  readonly configDirectory: string;
  readonly targetRepo: string;
  readonly ledgerPath: string;
  readonly retention: MorpheusConfig["retention"];
  readonly gitlab: MorpheusConfig["gitlab"];
  readonly promptPaths?: {
    readonly prepare?: string;
    readonly implement?: string;
    readonly review?: string;
  };
};

const loadCliConfig = (pathOption: Option.Option<string>): LoadedCliConfig => {
  const result = loadMorpheusConfig({
    configPath: Option.getOrUndefined(pathOption),
  });

  if (result.status === "error") {
    throw new Error(`${result.error.kind}: ${result.error.path}`);
  }

  const configDirectory = dirname(result.path);
  const targetRepo = isAbsolute(result.config.targetRepo)
    ? result.config.targetRepo
    : resolve(configDirectory, result.config.targetRepo);
  const ledgerPath = isAbsolute(result.config.ledger.path)
    ? result.config.ledger.path
    : resolve(configDirectory, result.config.ledger.path);

  return {
    configDirectory,
    targetRepo,
    ledgerPath,
    retention: result.config.retention,
    gitlab: result.config.gitlab,
    promptPaths: result.config.prompts,
  };
};

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
      `gitlab: project=${config.gitlab.project} readyLabel=${config.gitlab.readyLabel} targetBranch=${config.gitlab.targetBranch}`,
      `daemon: pollIntervalSeconds=${config.daemon.pollIntervalSeconds}`,
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
    const config = loadCliConfig(pathOption);

    return sqliteRunLedgerLayer({
      ledgerPath: config.ledgerPath,
      runsDirectory: resolve(config.configDirectory, ".morpheus", "runs"),
    });
  });

const provideLedger = <A, E>(
  pathOption: Option.Option<string>,
  program: Effect.Effect<A, E, RunLedger>,
): Effect.Effect<A, E | Error> =>
  Effect.flatMap(ledgerLayerFromConfig(pathOption), (ledgerLayer) =>
    Effect.provide(program, ledgerLayer),
  );

const operatorLayerFromConfig = (
  pathOption: Option.Option<string>,
): Effect.Effect<
  Layer.Layer<RunLedger | IssueTracker | OperatorHealth, RunLedgerPersistenceError>,
  Error
> =>
  Effect.sync(() => {
    const config = loadCliConfig(pathOption);
    const processRunnerLayer = nodeProcessRunnerLayer({
      cwd: config.targetRepo,
    });

    return Layer.mergeAll(
      sqliteRunLedgerLayer({
        ledgerPath: config.ledgerPath,
        runsDirectory: resolve(config.configDirectory, ".morpheus", "runs"),
      }),
      beadsIssueTrackerLayer.pipe(Layer.provide(processRunnerLayer)),
      operatorHealthLayer.pipe(Layer.provide(processRunnerLayer)),
    );
  });

const provideOperator = <A, E>(
  pathOption: Option.Option<string>,
  program: Effect.Effect<A, E, RunLedger | IssueTracker | OperatorHealth>,
): Effect.Effect<A, E | RunLedgerPersistenceError | Error> =>
  Effect.flatMap(operatorLayerFromConfig(pathOption), (layer) => Effect.provide(program, layer));

const syncLayerFromConfig = (
  pathOption: Option.Option<string>,
): Effect.Effect<Layer.Layer<IssueTracker | GitLabIssueSource>, Error> =>
  Effect.sync(() => {
    const config = loadCliConfig(pathOption);
    const processRunnerLayer = nodeProcessRunnerLayer({
      cwd: config.targetRepo,
    });

    return Layer.mergeAll(
      beadsIssueTrackerLayer.pipe(Layer.provide(processRunnerLayer)),
      glabIssueSourceLayer.pipe(Layer.provide(processRunnerLayer)),
    );
  });

const provideSync = <A, E>(
  pathOption: Option.Option<string>,
  program: Effect.Effect<A, E, IssueTracker | GitLabIssueSource>,
): Effect.Effect<A, E | Error> =>
  Effect.flatMap(syncLayerFromConfig(pathOption), (layer) => Effect.provide(program, layer));

const prepareLayerFromConfig = (
  pathOption: Option.Option<string>,
): Effect.Effect<
  Layer.Layer<RunLedger | IssueTracker | AgentRunner, RunLedgerPersistenceError>,
  Error
> =>
  Effect.sync(() => {
    const config = loadCliConfig(pathOption);
    const processRunnerLayer = nodeProcessRunnerLayer({
      cwd: config.targetRepo,
    });
    const issueTrackerLayer = beadsIssueTrackerLayer.pipe(Layer.provide(processRunnerLayer));

    return Layer.mergeAll(
      sqliteRunLedgerLayer({
        ledgerPath: config.ledgerPath,
        runsDirectory: resolve(config.configDirectory, ".morpheus", "runs"),
      }),
      issueTrackerLayer,
      sandcastleAgentRunnerLayer({
        cwd: config.targetRepo,
        promptPaths: config.promptPaths,
        logDirectory: resolve(config.configDirectory, ".morpheus", "sandcastle-logs"),
      }),
    );
  });

const providePreparation = <A, E>(
  pathOption: Option.Option<string>,
  program: Effect.Effect<A, E, RunLedger | IssueTracker | AgentRunner>,
): Effect.Effect<A, E | RunLedgerPersistenceError | Error> =>
  Effect.flatMap(prepareLayerFromConfig(pathOption), (layer) => Effect.provide(program, layer));

const implementationLayerFromConfig = (
  pathOption: Option.Option<string>,
): Effect.Effect<
  Layer.Layer<
    RunLedger | IssueTracker | WorkspaceRuntime | MergeRequestClient | AgentRunner,
    RunLedgerPersistenceError
  >,
  Error
> =>
  Effect.sync(() => {
    const config = loadCliConfig(pathOption);
    const processRunnerLayer = nodeProcessRunnerLayer({
      cwd: config.targetRepo,
    });

    return Layer.mergeAll(
      sqliteRunLedgerLayer({
        ledgerPath: config.ledgerPath,
        runsDirectory: resolve(config.configDirectory, ".morpheus", "runs"),
      }),
      beadsIssueTrackerLayer.pipe(Layer.provide(processRunnerLayer)),
      gitWorkspaceRuntimeLayer.pipe(Layer.provide(processRunnerLayer)),
      glabMergeRequestClientLayer.pipe(Layer.provide(processRunnerLayer)),
      sandcastleAgentRunnerLayer({
        cwd: config.targetRepo,
        promptPaths: config.promptPaths,
        logDirectory: resolve(config.configDirectory, ".morpheus", "sandcastle-logs"),
      }),
    );
  });

const provideImplementation = <A, E>(
  pathOption: Option.Option<string>,
  program: Effect.Effect<
    A,
    E,
    RunLedger | IssueTracker | WorkspaceRuntime | MergeRequestClient | AgentRunner
  >,
): Effect.Effect<A, E | RunLedgerPersistenceError | Error> =>
  Effect.flatMap(implementationLayerFromConfig(pathOption), (layer) =>
    Effect.provide(program, layer),
  );

const reviewLayerFromConfig = (
  pathOption: Option.Option<string>,
): Effect.Effect<
  Layer.Layer<
    RunLedger | IssueTracker | WorkspaceRuntime | MergeRequestClient | AgentRunner,
    RunLedgerPersistenceError
  >,
  Error
> =>
  Effect.sync(() => {
    const config = loadCliConfig(pathOption);
    const processRunnerLayer = nodeProcessRunnerLayer({
      cwd: config.targetRepo,
    });

    return Layer.mergeAll(
      sqliteRunLedgerLayer({
        ledgerPath: config.ledgerPath,
        runsDirectory: resolve(config.configDirectory, ".morpheus", "runs"),
      }),
      beadsIssueTrackerLayer.pipe(Layer.provide(processRunnerLayer)),
      gitWorkspaceRuntimeLayer.pipe(Layer.provide(processRunnerLayer)),
      glabMergeRequestClientLayer.pipe(Layer.provide(processRunnerLayer)),
      sandcastleAgentRunnerLayer({
        cwd: config.targetRepo,
        promptPaths: config.promptPaths,
        logDirectory: resolve(config.configDirectory, ".morpheus", "sandcastle-logs"),
      }),
    );
  });

const provideReview = <A, E>(
  pathOption: Option.Option<string>,
  program: Effect.Effect<
    A,
    E,
    RunLedger | IssueTracker | WorkspaceRuntime | MergeRequestClient | AgentRunner
  >,
): Effect.Effect<A, E | RunLedgerPersistenceError | Error> =>
  Effect.flatMap(reviewLayerFromConfig(pathOption), (layer) => Effect.provide(program, layer));

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

const dryRun = Options.boolean("dry-run");
const apply = Options.boolean("apply");

const prune = Command.make(
  "prune",
  { configPath, dryRun, apply },
  ({ configPath, dryRun, apply }) =>
    Effect.gen(function* () {
      if (dryRun === apply) {
        return yield* Effect.fail(new Error("Pass exactly one of --dry-run or --apply"));
      }
      const config = loadCliConfig(configPath);
      return yield* provideLedger(
        configPath,
        pruneRunsForCli({
          apply,
          policy: config.retention,
          prunedBy: process.env.USER ?? "operator",
          reason: apply ? "operator apply" : "operator dry-run",
        }),
      );
    }).pipe(Effect.flatMap((output) => Console.log(output))),
).pipe(Command.withDescription("Prune policy-eligible terminal Morpheus runs"));

const status = Command.make("status", { configPath }, ({ configPath }) =>
  provideOperator(configPath, operatorStatusForCli()).pipe(
    Effect.flatMap((output) => Console.log(output)),
  ),
).pipe(Command.withDescription("Show read-only Morpheus operator status"));

const slice = Command.make("slice", { issueId, configPath }, ({ issueId, configPath }) =>
  provideOperator(configPath, operatorSliceForCli(issueId)).pipe(
    Effect.flatMap((output) => Console.log(output)),
  ),
).pipe(Command.withDescription("Show read-only Morpheus issue forensics"));

const doctor = Command.make("doctor", { configPath }, ({ configPath }) =>
  provideOperator(configPath, operatorDoctorForCli).pipe(
    Effect.flatMap((output) => Console.log(output)),
  ),
).pipe(Command.withDescription("Check read-only Morpheus adapter and runtime health"));

const sync = Command.make("sync", { configPath }, ({ configPath }) =>
  Effect.gen(function* () {
    const config = loadCliConfig(configPath);
    return yield* provideSync(
      configPath,
      syncGitLabIssuesForCli({
        project: config.gitlab.project,
        readyLabel: config.gitlab.readyLabel,
      }),
    );
  }).pipe(Effect.flatMap((output) => Console.log(output))),
).pipe(Command.withDescription("Import ready GitLab issues into Beads"));

const prepare = Command.make("prepare", { issueId, configPath }, ({ issueId, configPath }) =>
  providePreparation(configPath, prepareIssueForCli(issueId)).pipe(
    Effect.flatMap((output) => Console.log(output)),
  ),
).pipe(Command.withDescription("Prepare one Beads issue"));

const implement = Command.make("implement", { issueId, configPath }, ({ issueId, configPath }) =>
  provideImplementation(configPath, startImplementationForCli(issueId)).pipe(
    Effect.flatMap((output) => Console.log(output)),
  ),
).pipe(Command.withDescription("Create workspace branch and Draft MR for one prepared issue"));

const review = Command.make("review", { issueId, configPath }, ({ issueId, configPath }) =>
  provideReview(configPath, reviewIssueForCli(issueId)).pipe(
    Effect.flatMap((output) => Console.log(output)),
  ),
).pipe(Command.withDescription("Run read-only review for one running issue"));

const command = Command.make("morpheus", {}, () =>
  Console.log("Morpheus local agent orchestration"),
).pipe(
  Command.withDescription("Morpheus local agent orchestration"),
  Command.withSubcommands([
    config,
    runs,
    runDetail,
    logs,
    prune,
    status,
    slice,
    doctor,
    sync,
    prepare,
    implement,
    review,
  ]),
);

const run = Command.run(command, {
  name: "Morpheus",
  version: pkg.version,
});

run(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);
