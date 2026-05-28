#!/usr/bin/env node
import { Args, Command, Options } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Effect, Layer, Option } from "effect";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import {
  beadsIssueTrackerLayer,
  gitWorkspaceRuntimeLayer,
  glabIssueSourceLayer,
  glabMergeRequestClientLayer,
  nodeProcessRunnerLayer,
  nodeSetupEnvironmentLayer,
  operatorHealthLayer,
  sandcastleAgentRunnerLayer,
  sqliteRunLedgerLayer,
} from "@morpheus/adapters";
import {
  AgentRunner,
  applyMorpheusSetupPlan,
  detectMorpheusSetupInput,
  formatMorpheusSetupPreview,
  GitLabIssueSource,
  interpretMorpheusSetupDoctorOutput,
  initMorpheusRepo,
  IssueTracker,
  listRunsForCli,
  loadMorpheusConfig,
  MergeRequestClient,
  OperatorHealth,
  operatorDoctorForCli,
  operatorSliceForCli,
  operatorStatusForCli,
  planMorpheusSetupExecution,
  planMorpheusSetup,
  prepareIssueForCli,
  pruneRunsForCli,
  reviewIssueForCli,
  runDaemonLoopForCli,
  runDaemonOnceForCli,
  RunLedger,
  showRunForCli,
  showRunLogsForCli,
  startImplementationForCli,
  runMorpheusSetupContainerBuild,
  syncGitLabIssuesForCli,
  type MorpheusConfig,
  type SetupPlan,
  type SetupPlanningInput,
  type RunLedgerPersistenceError,
  WorkspaceRuntime,
} from "@morpheus/runtime";
import pkg from "../package.json" with { type: "json" };
import { formatConfigSummaryText } from "./config-summary.js";
import {
  runSelectorPrompt,
  type SelectorOption,
  type SelectorPromptInput,
} from "./setup-prompts.js";
import {
  buildNonInteractiveSetupAnswers,
  readSetupConfigInput,
  type NonInteractiveSetupInput,
} from "./setup-non-interactive.js";

const configPath = Options.text("config").pipe(Options.optional);
const runId = Args.text({ name: "runId" });
const issueId = Args.text({ name: "issueId" });

type LoadedCliConfig = {
  readonly configDirectory: string;
  readonly targetRepo: string;
  readonly ledgerPath: string;
  readonly retention: MorpheusConfig["retention"];
  readonly gitlab: MorpheusConfig["gitlab"];
  readonly daemon: MorpheusConfig["daemon"];
  readonly lanes: MorpheusConfig["lanes"];
  readonly agentRunner: MorpheusConfig["agentRunner"];
  readonly verification: MorpheusConfig["verification"];
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
    daemon: result.config.daemon,
    lanes: result.config.lanes,
    agentRunner: result.config.agentRunner,
    verification: result.config.verification,
    promptPaths: result.config.prompts,
  };
};

const formatConfigSummary = (
  result: ReturnType<typeof loadMorpheusConfig>,
): Effect.Effect<void, Error> => {
  if (result.status === "error") {
    return Effect.fail(new Error(`${result.error.kind}: ${result.error.path}`));
  }

  return Console.log(formatConfigSummaryText(result));
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
      operatorHealthLayer({
        cwd: config.targetRepo,
        gitlabProject: config.gitlab.project,
        authEnvFile: config.agentRunner.auth.envFile,
        authRequiredKeys: config.agentRunner.auth.requiredKeys,
        toolchainProbes: config.verification.toolchainProbes,
        containerImage: config.agentRunner.container.image,
        containerProfile: config.agentRunner.container.profile,
      }).pipe(Layer.provide(processRunnerLayer)),
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

const agentLogDirectory = (configDirectory: string): string =>
  resolve(configDirectory, ".morpheus", "agent-logs");

const agentRunnerOptionsFromConfig = (config: LoadedCliConfig) => ({
  cwd: config.targetRepo,
  promptPaths: config.promptPaths,
  skills: config.agentRunner.skills,
  logDirectory: agentLogDirectory(config.configDirectory),
  agentConfig: config.agentRunner.agent,
  idleTimeoutSeconds: config.agentRunner.agent.idleTimeoutSeconds,
  authEnvFile: config.agentRunner.auth.envFile,
  authRequiredKeys: config.agentRunner.auth.requiredKeys,
  containerConfig: {
    image: config.agentRunner.container.image,
    profile: config.agentRunner.container.profile,
    mounts: config.agentRunner.container.mounts,
  },
});

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
      sandcastleAgentRunnerLayer(agentRunnerOptionsFromConfig(config)).pipe(
        Layer.provide(processRunnerLayer),
      ),
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
      sandcastleAgentRunnerLayer(agentRunnerOptionsFromConfig(config)).pipe(
        Layer.provide(processRunnerLayer),
      ),
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
      sandcastleAgentRunnerLayer(agentRunnerOptionsFromConfig(config)).pipe(
        Layer.provide(processRunnerLayer),
      ),
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

const daemonLayerFromConfig = (
  pathOption: Option.Option<string>,
): Effect.Effect<
  Layer.Layer<
    | RunLedger
    | IssueTracker
    | GitLabIssueSource
    | WorkspaceRuntime
    | MergeRequestClient
    | AgentRunner,
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
      glabIssueSourceLayer.pipe(Layer.provide(processRunnerLayer)),
      gitWorkspaceRuntimeLayer.pipe(Layer.provide(processRunnerLayer)),
      glabMergeRequestClientLayer.pipe(Layer.provide(processRunnerLayer)),
      sandcastleAgentRunnerLayer(agentRunnerOptionsFromConfig(config)).pipe(
        Layer.provide(processRunnerLayer),
      ),
    );
  });

const provideDaemon = <A, E>(
  pathOption: Option.Option<string>,
  program: Effect.Effect<
    A,
    E,
    | RunLedger
    | IssueTracker
    | GitLabIssueSource
    | WorkspaceRuntime
    | MergeRequestClient
    | AgentRunner
  >,
): Effect.Effect<A, E | RunLedgerPersistenceError | Error> =>
  Effect.flatMap(daemonLayerFromConfig(pathOption), (layer) => Effect.provide(program, layer));

const daemonTickForConfig = (config: LoadedCliConfig, configPath: Option.Option<string>) =>
  provideDaemon(
    configPath,
    runDaemonOnceForCli({
      project: config.gitlab.project,
      readyLabel: config.gitlab.readyLabel,
      capacities: {
        preparation: config.lanes.preparation.concurrency,
        implementation: config.lanes.implementation.concurrency,
        review: config.lanes.review.concurrency,
      },
    }),
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

const setupTarget = Options.text("target").pipe(Options.optional);
const setupYes = Options.boolean("yes");
const setupDryRun = Options.boolean("dry-run");
const setupGitlabProject = Options.text("gitlab-project").pipe(Options.optional);
const setupTargetBranch = Options.text("target-branch").pipe(Options.optional);
const setupGitlabReadyLabel = Options.text("gitlab-ready-label").pipe(Options.optional);
const setupAuthEnvFile = Options.text("auth-env-file").pipe(Options.optional);
const setupRequiredAuthKey = Options.text("required-auth-key").pipe(Options.optional);
const setupContainerImage = Options.text("container-image").pipe(Options.optional);
const setupContainerProfile = Options.text("container-profile").pipe(Options.optional);
const setupVerificationCommand = Options.text("verification-command").pipe(Options.optional);
const setupPollIntervalSeconds = Options.text("poll-interval-seconds").pipe(Options.optional);
const setupNoBuild = Options.boolean("no-build");
const setupBuild = Options.boolean("build");
const setupNoSync = Options.boolean("no-sync");
const setupRunOnce = Options.boolean("once");
const setupConfigInput = Options.text("config-input").pipe(Options.optional);

type SetupAnswers = NonNullable<SetupPlanningInput["answers"]>;
type MutableSetupAnswers = {
  -readonly [Key in keyof SetupAnswers]: SetupAnswers[Key];
};

const question = async (
  rl: ReturnType<typeof createInterface>,
  label: string,
  defaultValue?: string,
): Promise<string> => {
  const suffix =
    defaultValue === undefined || defaultValue.length === 0 ? "" : ` [${defaultValue}]`;
  const answer = (await rl.question(`${label}${suffix}: `)).trim();
  return answer.length === 0 ? (defaultValue ?? "") : answer;
};

const yesNo = async (
  rl: ReturnType<typeof createInterface>,
  label: string,
  defaultValue: boolean,
): Promise<boolean> => {
  const value = await selectorPrompt(rl, {
    kind: "single",
    label,
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
    defaultValue: defaultValue ? "yes" : "no",
  });
  return value === "yes";
};

const selectorPrompt = async <Value extends string>(
  rl: ReturnType<typeof createInterface>,
  input: SelectorPromptInput<Value>,
): Promise<Value | readonly Value[]> => {
  rl.pause();
  try {
    return await runSelectorPrompt(input);
  } finally {
    rl.resume();
  }
};

const parseList = (value: string): readonly string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const formatDefault = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
};

const promptValue = async (
  rl: ReturnType<typeof createInterface>,
  label: string,
  defaultValue: unknown,
): Promise<string> => question(rl, label, formatDefault(defaultValue));

type AgentEffortAnswer = MorpheusConfig["agentRunner"]["agent"]["effort"];

const agentEffortOptions = [
  { label: "low", value: "low" },
  { label: "medium", value: "medium" },
  { label: "high", value: "high" },
  { label: "xhigh", value: "xhigh" },
] satisfies readonly SelectorOption<AgentEffortAnswer>[];

const authKeyOptions = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY"].map((value) => ({
  label: value,
  value,
})) satisfies readonly SelectorOption<string>[];

const authKeySelectorOptions = (values: readonly string[]): readonly SelectorOption<string>[] => {
  const seen = new Set<string>();
  return [...values, ...authKeyOptions.map((option) => option.value)]
    .filter((value) => {
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return value.length > 0;
    })
    .map((value) => ({ label: value, value }));
};

const needsSetupAnswer = (prompt: SetupPlan["prompts"][number] | undefined): boolean =>
  prompt?.validation.status === "invalid" ||
  (typeof prompt?.value === "string" && prompt.value.length === 0) ||
  (Array.isArray(prompt?.value) && prompt.value.length === 0);

const collectSetupAnswers = async (
  plan: SetupPlan,
  rl: ReturnType<typeof createInterface>,
): Promise<SetupAnswers> => {
  const answers: MutableSetupAnswers = {};
  const prompts = new Map(plan.prompts.map((prompt) => [prompt.id, prompt]));

  const gitlabProject = prompts.get("gitlabProject");
  if (needsSetupAnswer(gitlabProject)) {
    answers.gitlabProject = await promptValue(
      rl,
      "GitLab project path",
      gitlabProject?.value ?? "",
    );
  }

  const targetBranch = prompts.get("targetBranch");
  if (needsSetupAnswer(targetBranch)) {
    answers.targetBranch = await promptValue(
      rl,
      "Target branch for merge requests",
      targetBranch?.value ?? "main",
    );
  }

  const readyLabel = prompts.get("readyLabel");
  if (needsSetupAnswer(readyLabel)) {
    answers.readyLabel = await promptValue(
      rl,
      "GitLab ready label to import",
      readyLabel?.value ?? "agent:ready",
    );
  }

  const agentModel = prompts.get("agentModel");
  if (needsSetupAnswer(agentModel)) {
    answers.agentModel = await promptValue(rl, "Agent model", agentModel?.value ?? "gpt-5.4-mini");
  }

  const agentEffort = prompts.get("agentEffort");
  if (needsSetupAnswer(agentEffort)) {
    answers.agentEffort = (await selectorPrompt(rl, {
      kind: "single",
      label: "Agent reasoning effort",
      options: agentEffortOptions,
      defaultValue: (agentEffort?.value ?? "xhigh") as AgentEffortAnswer,
    })) as SetupAnswers["agentEffort"];
  }

  const authEnvFile = prompts.get("authEnvFile");
  if (needsSetupAnswer(authEnvFile)) {
    answers.authEnvFile = await promptValue(
      rl,
      "Agent auth env file path",
      authEnvFile?.value ?? ".morpheus/secrets/agent.env",
    );
  }
  if (String(answers.authEnvFile).startsWith("/")) {
    answers.confirmAbsoluteAuthEnvFile = await yesNo(
      rl,
      "Confirm absolute agent auth env file path",
      false,
    );
  }

  const requiredAuthKeys = prompts.get("requiredAuthKeys");
  if (needsSetupAnswer(requiredAuthKeys)) {
    const defaultKeys = Array.isArray(requiredAuthKeys?.value)
      ? requiredAuthKeys.value.map(String)
      : ["OPENAI_API_KEY"];
    answers.requiredAuthKeys = (await selectorPrompt(rl, {
      kind: "multi",
      label: "Required auth env keys",
      options: authKeySelectorOptions(defaultKeys),
      defaultValue: defaultKeys,
    })) as readonly string[];
  }

  const createSecretFile = prompts.get("createSecretFile");
  if (createSecretFile?.value === true || createSecretFile?.validation.status === "invalid") {
    answers.createSecretFile = await yesNo(
      rl,
      "Create missing secret file now with empty keys",
      createSecretFile?.value === true,
    );
  }

  const containerImage = prompts.get("containerImage");
  if (needsSetupAnswer(containerImage)) {
    answers.containerImage = await promptValue(
      rl,
      "Container image tag",
      containerImage?.value ?? "morpheus-agent:local",
    );
  }

  const containerProfile = prompts.get("containerProfile");
  if (needsSetupAnswer(containerProfile)) {
    answers.containerProfile = await promptValue(
      rl,
      "Container profile path",
      containerProfile?.value ?? ".morpheus/container/Dockerfile",
    );
  }

  const containerMounts = prompts.get("containerMounts");
  const defaultMount =
    Array.isArray(containerMounts?.value) && containerMounts.value.length > 0
      ? (containerMounts.value[0] as { readonly hostPath: string; readonly containerPath: string })
      : { hostPath: ".", containerPath: "/workspace" };
  if (needsSetupAnswer(containerMounts) || containerMounts?.validation.status === "invalid") {
    const mountValue = await promptValue(
      rl,
      "Container workspace mount host:container",
      `${defaultMount.hostPath}:${defaultMount.containerPath}`,
    );
    const [hostPath = ".", containerPath = "/workspace"] = mountValue
      .replace(/^'|'$/g, "")
      .split(":");
    answers.containerMounts = [{ hostPath, containerPath }];
    if (hostPath.startsWith("/") || hostPath.includes("..")) {
      answers.confirmExternalContainerMounts = await yesNo(
        rl,
        "Confirm external container workspace mount",
        false,
      );
    }
  }

  answers.buildContainer = await yesNo(
    rl,
    "Build container image now",
    prompts.get("containerBuild")?.defaultValue === true,
  );
  answers.addToolchainProbes = await yesNo(
    rl,
    "Add detected toolchain doctor probes",
    prompts.get("toolchainProbes")?.defaultValue === true,
  );

  const verificationCommands = prompts.get("verificationCommands");
  if (needsSetupAnswer(verificationCommands)) {
    answers.verificationCommands = parseList(
      await promptValue(
        rl,
        "Verification commands agents should run",
        verificationCommands?.value ?? [],
      ),
    );
  }

  const pollInterval = prompts.get("pollIntervalSeconds");
  if (needsSetupAnswer(pollInterval)) {
    answers.pollIntervalSeconds = Number(
      await promptValue(rl, "Daemon poll interval seconds", pollInterval?.value ?? 30),
    );
  }

  const laneConcurrency = prompts.get("laneConcurrency")?.value as
    | { readonly preparation?: number; readonly implementation?: number; readonly review?: number }
    | undefined;
  if (prompts.get("laneConcurrency")?.validation.status === "invalid") {
    const laneInput = await promptValue(
      rl,
      "Lane concurrency preparation/implementation/review",
      `${laneConcurrency?.preparation ?? 1}/${laneConcurrency?.implementation ?? 1}/${laneConcurrency?.review ?? 1}`,
    );
    const [preparation, implementation, review] = laneInput
      .split("/")
      .map((value) => Number(value.trim()));
    answers.laneConcurrency = { preparation, implementation, review };
  }

  if (plan.mode === "update") {
    answers.overwriteTemplates = await yesNo(rl, "Overwrite existing generated templates", false);
  }

  return answers;
};

const runSetupDoctor = async (configPathValue: string): Promise<string> => {
  const output = await Effect.runPromise(
    provideOperator(Option.some(configPathValue), operatorDoctorForCli),
  );
  console.log(output);
  return output;
};

const optionString = (value: Option.Option<string>): string | undefined =>
  Option.getOrUndefined(value);

const commaList = (value: string | undefined): readonly string[] | undefined =>
  value === undefined ? undefined : parseList(value);

const runNonInteractiveSetup = async (
  options: NonInteractiveSetupInput & { readonly target?: string },
): Promise<void> => {
  const targetPath = options.target ?? ".";
  const initialTarget = resolve(process.cwd(), targetPath);
  const initialInput = await Effect.runPromise(
    detectMorpheusSetupInput({
      targetPath: initialTarget,
      currentWorkingDirectory: process.cwd(),
    }).pipe(
      Effect.provide(nodeSetupEnvironmentLayer()),
      Effect.provide(nodeProcessRunnerLayer({ cwd: initialTarget })),
    ),
  );
  const answers = buildNonInteractiveSetupAnswers(options);
  const plan = planMorpheusSetup({ ...initialInput, answers });
  console.log(formatMorpheusSetupPreview(plan));

  if (plan.errors.length > 0) {
    throw new Error("Setup plan is blocked by invalid input.");
  }

  if (answers.writeChanges !== true) {
    return;
  }

  await Effect.runPromise(
    applyMorpheusSetupPlan(plan).pipe(
      Effect.provide(nodeSetupEnvironmentLayer()),
      Effect.provide(nodeProcessRunnerLayer({ cwd: initialTarget })),
    ),
  );

  if (answers.buildContainer === true) {
    console.log(
      await Effect.runPromise(
        runMorpheusSetupContainerBuild(plan).pipe(
          Effect.provide(nodeSetupEnvironmentLayer()),
          Effect.provide(nodeProcessRunnerLayer({ cwd: initialTarget })),
        ),
      ),
    );
  }

  console.log("");
  await Effect.runPromise(
    formatConfigSummary(
      loadMorpheusConfig({ configPath: join(initialTarget, "morpheus.config.json") }),
    ),
  );
  console.log("");
  const doctorHealth = interpretMorpheusSetupDoctorOutput(
    await runSetupDoctor(join(initialTarget, "morpheus.config.json")),
  );
  const postDoctorInput = await Effect.runPromise(
    detectMorpheusSetupInput({
      targetPath: initialTarget,
      currentWorkingDirectory: process.cwd(),
      doctor: doctorHealth,
    }).pipe(
      Effect.provide(nodeSetupEnvironmentLayer()),
      Effect.provide(nodeProcessRunnerLayer({ cwd: initialTarget })),
    ),
  );
  const executionGates = planMorpheusSetupExecution(postDoctorInput);

  if (!executionGates.sync.canRun) {
    console.log(`Sync not ready: ${executionGates.sync.skipReason}`);
  }

  if (answers.runDaemonOnce === true && !executionGates.daemonOnce.canRun) {
    throw new Error(`Setup completion blocked: ${executionGates.daemonOnce.skipReason}`);
  }

  if (answers.runDaemonOnce === true) {
    const config = loadCliConfig(Option.some(join(initialTarget, "morpheus.config.json")));
    console.log(
      await Effect.runPromise(
        daemonTickForConfig(config, Option.some(join(initialTarget, "morpheus.config.json"))),
      ),
    );
  }
};

const setup = Command.make(
  "setup",
  {
    target: setupTarget,
    yes: setupYes,
    dryRun: setupDryRun,
    gitlabProject: setupGitlabProject,
    targetBranch: setupTargetBranch,
    gitlabReadyLabel: setupGitlabReadyLabel,
    authEnvFile: setupAuthEnvFile,
    requiredAuthKey: setupRequiredAuthKey,
    containerImage: setupContainerImage,
    containerProfile: setupContainerProfile,
    verificationCommand: setupVerificationCommand,
    pollIntervalSeconds: setupPollIntervalSeconds,
    noBuild: setupNoBuild,
    build: setupBuild,
    noSync: setupNoSync,
    once: setupRunOnce,
    configInput: setupConfigInput,
  },
  ({
    target,
    yes,
    dryRun,
    gitlabProject,
    targetBranch,
    gitlabReadyLabel,
    authEnvFile,
    requiredAuthKey,
    containerImage,
    containerProfile,
    verificationCommand,
    pollIntervalSeconds,
    noBuild,
    build,
    noSync,
    once,
    configInput,
  }) =>
    Effect.promise(async () => {
      const configInputPath = optionString(configInput);
      const nonInteractive =
        yes ||
        dryRun ||
        configInputPath !== undefined ||
        optionString(gitlabProject) !== undefined ||
        optionString(targetBranch) !== undefined ||
        optionString(gitlabReadyLabel) !== undefined ||
        optionString(authEnvFile) !== undefined ||
        optionString(requiredAuthKey) !== undefined ||
        optionString(containerImage) !== undefined ||
        optionString(containerProfile) !== undefined ||
        optionString(verificationCommand) !== undefined ||
        optionString(pollIntervalSeconds) !== undefined ||
        noBuild ||
        build ||
        noSync ||
        once;

      if (nonInteractive) {
        const fileInput =
          configInputPath === undefined ? {} : readSetupConfigInput(configInputPath);
        await runNonInteractiveSetup({
          ...fileInput,
          target: optionString(target) ?? fileInput.target,
          yes,
          dryRun,
          gitlabProject: optionString(gitlabProject) ?? fileInput.gitlabProject,
          targetBranch: optionString(targetBranch) ?? fileInput.targetBranch,
          gitlabReadyLabel: optionString(gitlabReadyLabel) ?? fileInput.gitlabReadyLabel,
          authEnvFile: optionString(authEnvFile) ?? fileInput.authEnvFile,
          requiredAuthKey: commaList(optionString(requiredAuthKey)) ?? fileInput.requiredAuthKey,
          containerImage: optionString(containerImage) ?? fileInput.containerImage,
          containerProfile: optionString(containerProfile) ?? fileInput.containerProfile,
          verificationCommand:
            commaList(optionString(verificationCommand)) ?? fileInput.verificationCommand,
          pollIntervalSeconds:
            optionString(pollIntervalSeconds) === undefined
              ? fileInput.pollIntervalSeconds
              : Number(optionString(pollIntervalSeconds)),
          noBuild: noBuild || fileInput.noBuild,
          build: build || fileInput.build,
          noSync: noSync || fileInput.noSync,
          once: once || fileInput.once,
          authSecret: fileInput.authSecret,
        });
        return;
      }

      const rl = createInterface({ input: process.stdin, output: process.stdout });

      try {
        const targetPath = await question(
          rl,
          "Target repository path",
          Option.getOrElse(target, () => "."),
        );
        const initialTarget = resolve(process.cwd(), targetPath);
        const initialInput = await Effect.runPromise(
          detectMorpheusSetupInput({
            targetPath: initialTarget,
            currentWorkingDirectory: process.cwd(),
          }).pipe(
            Effect.provide(nodeSetupEnvironmentLayer()),
            Effect.provide(nodeProcessRunnerLayer({ cwd: initialTarget })),
          ),
        );
        const initialPlan = planMorpheusSetup(initialInput);
        console.log(formatMorpheusSetupPreview(initialPlan));
        const answers = await collectSetupAnswers(initialPlan, rl);
        let plan = planMorpheusSetup({ ...initialInput, answers });
        console.log(formatMorpheusSetupPreview(plan));

        if (plan.errors.length > 0) {
          throw new Error("Setup plan is blocked by invalid input.");
        }

        const writeChanges = await yesNo(rl, "Write these changes", plan.mode === "create");
        plan = planMorpheusSetup({ ...initialInput, answers: { ...answers, writeChanges } });
        await Effect.runPromise(
          applyMorpheusSetupPlan(plan).pipe(
            Effect.provide(nodeSetupEnvironmentLayer()),
            Effect.provide(nodeProcessRunnerLayer({ cwd: initialTarget })),
          ),
        );

        if (writeChanges && answers.buildContainer === true) {
          const output = await Effect.runPromise(
            runMorpheusSetupContainerBuild(plan).pipe(
              Effect.provide(nodeSetupEnvironmentLayer()),
              Effect.provide(nodeProcessRunnerLayer({ cwd: initialTarget })),
            ),
          );
          console.log(output);
        }

        let doctorHealth: ReturnType<typeof interpretMorpheusSetupDoctorOutput> | undefined;
        if (writeChanges) {
          console.log("");
          await Effect.runPromise(
            formatConfigSummary(
              loadMorpheusConfig({ configPath: join(initialTarget, "morpheus.config.json") }),
            ),
          );
          console.log("");
          doctorHealth = interpretMorpheusSetupDoctorOutput(
            await runSetupDoctor(join(initialTarget, "morpheus.config.json")),
          );
        }

        const postDoctorInput = await Effect.runPromise(
          detectMorpheusSetupInput({
            targetPath: initialTarget,
            currentWorkingDirectory: process.cwd(),
            doctor: doctorHealth,
          }).pipe(
            Effect.provide(nodeSetupEnvironmentLayer()),
            Effect.provide(nodeProcessRunnerLayer({ cwd: initialTarget })),
          ),
        );
        const executionGates = planMorpheusSetupExecution(postDoctorInput);

        if (writeChanges && !executionGates.sync.canRun) {
          console.log(`Sync not ready: ${executionGates.sync.skipReason}`);
        }
        if (
          writeChanges &&
          executionGates.sync.canRun &&
          (await yesNo(rl, "Run sync now", false))
        ) {
          const config = loadCliConfig(Option.some(join(initialTarget, "morpheus.config.json")));
          await Effect.runPromise(
            provideSync(
              Option.some(join(initialTarget, "morpheus.config.json")),
              syncGitLabIssuesForCli({
                project: config.gitlab.project,
                readyLabel: config.gitlab.readyLabel,
              }),
            ).pipe(Effect.flatMap((output) => Console.log(output))),
          );
        }

        if (writeChanges && !executionGates.daemonOnce.canRun) {
          throw new Error(`Setup completion blocked: ${executionGates.daemonOnce.skipReason}`);
        }
        if (writeChanges && executionGates.daemonOnce.canRun) {
          const config = loadCliConfig(Option.some(join(initialTarget, "morpheus.config.json")));
          console.log(
            await Effect.runPromise(
              daemonTickForConfig(config, Option.some(join(initialTarget, "morpheus.config.json"))),
            ),
          );
        }
      } finally {
        rl.close();
      }
    }),
).pipe(Command.withDescription("Interactively set up Morpheus in a target repository"));

const initTarget = Options.text("target");
const initGitlabProject = Options.text("gitlab-project");
const initGitlabReadyLabel = Options.text("gitlab-ready-label").pipe(Options.optional);
const initTargetBranch = Options.text("target-branch").pipe(Options.optional);
const initForce = Options.boolean("force");

const init = Command.make(
  "init",
  {
    target: initTarget,
    gitlabProject: initGitlabProject,
    gitlabReadyLabel: initGitlabReadyLabel,
    targetBranch: initTargetBranch,
    force: initForce,
  },
  ({ target, gitlabProject, gitlabReadyLabel, targetBranch, force }) =>
    Effect.gen(function* () {
      const result = initMorpheusRepo({
        target,
        gitlabProject,
        gitlabReadyLabel: Option.getOrUndefined(gitlabReadyLabel),
        targetBranch: Option.getOrUndefined(targetBranch),
        force,
      });

      if (result.status === "error") {
        if (result.error.kind === "existing_files") {
          return yield* Effect.fail(
            new Error(`Refusing to overwrite existing files:\n${result.error.paths.join("\n")}`),
          );
        }

        return yield* Effect.fail(new Error(`${result.error.kind}: ${result.error.path}`));
      }

      return yield* Console.log(
        [
          "Morpheus initialized",
          `target: ${result.target}`,
          `config: ${result.configPath}`,
          `created: ${result.created.length}`,
          `updated: ${result.updated.length}`,
        ].join("\n"),
      );
    }),
).pipe(Command.withDescription("Initialize Morpheus files in a target repository"));

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

const logWorkflowResult = (output: string): Effect.Effect<void, Error> =>
  Console.log(output).pipe(
    Effect.flatMap(() =>
      output.startsWith("Failed ") || output.startsWith("State rejected ")
        ? Effect.fail(new Error(output))
        : Effect.void,
    ),
  );

const prepare = Command.make("prepare", { issueId, configPath }, ({ issueId, configPath }) =>
  providePreparation(configPath, prepareIssueForCli(issueId)).pipe(
    Effect.flatMap(logWorkflowResult),
  ),
).pipe(Command.withDescription("Prepare one Beads issue"));

const implement = Command.make("implement", { issueId, configPath }, ({ issueId, configPath }) =>
  provideImplementation(configPath, startImplementationForCli(issueId)).pipe(
    Effect.flatMap(logWorkflowResult),
  ),
).pipe(Command.withDescription("Create workspace branch and Draft MR for one prepared issue"));

const review = Command.make("review", { issueId, configPath }, ({ issueId, configPath }) =>
  provideReview(configPath, reviewIssueForCli(issueId)).pipe(Effect.flatMap(logWorkflowResult)),
).pipe(Command.withDescription("Run read-only review for one running issue"));

const once = Options.boolean("once");

const daemon = Command.make("daemon", { configPath, once }, ({ configPath, once }) =>
  Effect.gen(function* () {
    const config = loadCliConfig(configPath);

    if (once) {
      const output = yield* daemonTickForConfig(config, configPath);
      return yield* Console.log(output);
    }

    return yield* provideDaemon(
      configPath,
      runDaemonLoopForCli(
        {
          project: config.gitlab.project,
          readyLabel: config.gitlab.readyLabel,
          pollIntervalSeconds: config.daemon.pollIntervalSeconds,
          capacities: {
            preparation: config.lanes.preparation.concurrency,
            implementation: config.lanes.implementation.concurrency,
            review: config.lanes.review.concurrency,
          },
        },
        Console.log,
      ),
    );
  }),
).pipe(Command.withDescription("Poll, sync, schedule, and run Morpheus lanes"));

const command = Command.make("morpheus", {}, () =>
  Console.log("Morpheus local agent orchestration"),
).pipe(
  Command.withDescription("Morpheus local agent orchestration"),
  Command.withSubcommands([
    config,
    setup,
    init,
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
    daemon,
  ]),
);

const run = Command.run(command, {
  name: "Morpheus",
  version: pkg.version,
});

run(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);
