import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as Schema from "@effect/schema/Schema";
import { Context, Effect, Schema as EffectSchema } from "effect";
import type {
  AgentReadyContract,
  AgentStateTransitionPlan,
  DerivedIssueState,
  FailureKind,
  Lane,
} from "@morpheus/core";

export type { AgentReadyContract } from "@morpheus/core";

export interface RuntimeInfo {
  readonly name: "MorpheusRuntime";
}

export const runtimeInfo: RuntimeInfo = {
  name: "MorpheusRuntime",
};

export type ProcessResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

export class ProcessRunnerError extends EffectSchema.TaggedError<ProcessRunnerError>(
  "ProcessRunnerError",
)("ProcessRunnerError", {
  command: EffectSchema.String,
  args: EffectSchema.Array(EffectSchema.String),
  message: EffectSchema.String,
}) {}

export class ProcessRunner extends Context.Tag("@morpheus/runtime/ProcessRunner")<
  ProcessRunner,
  {
    readonly run: (
      command: string,
      args: readonly string[],
    ) => Effect.Effect<ProcessResult, ProcessRunnerError>;
  }
>() {}

export type ProcessRunnerService = Context.Tag.Service<typeof ProcessRunner>;

export type TrackedIssue = {
  readonly id: string;
  readonly title: string;
  readonly labels: readonly string[];
  readonly priority?: number;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly derivedState: DerivedIssueState;
  readonly lane: Lane;
};

export type IssueTrackerApplyResult =
  | {
      readonly status: "applied";
      readonly issueId: string;
      readonly addLabels: readonly string[];
      readonly removeLabels: readonly string[];
    }
  | {
      readonly status: "rejected";
      readonly issueId: string;
      readonly reason: Exclude<AgentStateTransitionPlan["status"], "planned">;
      readonly plan: Exclude<AgentStateTransitionPlan, { readonly status: "planned" }>;
    };

export type IssueTrackerWriteContractResult = {
  readonly status: "written";
  readonly issueId: string;
};

export type IssueTrackerReadContractResult =
  | {
      readonly status: "present";
      readonly issueId: string;
      readonly contract: AgentReadyContract;
    }
  | {
      readonly status: "missing";
      readonly issueId: string;
    };

export class IssueTrackerCommandError extends EffectSchema.TaggedError<IssueTrackerCommandError>(
  "IssueTrackerCommandError",
)("IssueTrackerCommandError", {
  operation: EffectSchema.String,
  command: EffectSchema.String,
  args: EffectSchema.Array(EffectSchema.String),
  exitCode: EffectSchema.Number,
  stderr: EffectSchema.String,
}) {}

export class IssueTrackerJsonParseError extends EffectSchema.TaggedError<IssueTrackerJsonParseError>(
  "IssueTrackerJsonParseError",
)("IssueTrackerJsonParseError", {
  operation: EffectSchema.String,
  command: EffectSchema.String,
  args: EffectSchema.Array(EffectSchema.String),
  message: EffectSchema.String,
}) {}

export class IssueTrackerMalformedMetadataError extends EffectSchema.TaggedError<IssueTrackerMalformedMetadataError>(
  "IssueTrackerMalformedMetadataError",
)("IssueTrackerMalformedMetadataError", {
  issueId: EffectSchema.String,
  message: EffectSchema.String,
}) {}

export class IssueTrackerContractSchemaError extends EffectSchema.TaggedError<IssueTrackerContractSchemaError>(
  "IssueTrackerContractSchemaError",
)("IssueTrackerContractSchemaError", {
  issueId: EffectSchema.String,
  message: EffectSchema.String,
}) {}

export type IssueTrackerError =
  | ProcessRunnerError
  | IssueTrackerCommandError
  | IssueTrackerJsonParseError
  | IssueTrackerMalformedMetadataError
  | IssueTrackerContractSchemaError;

export class IssueTracker extends Context.Tag("@morpheus/runtime/IssueTracker")<
  IssueTracker,
  {
    readonly listRunnableIssues: () => Effect.Effect<
      readonly TrackedIssue[],
      ProcessRunnerError | IssueTrackerCommandError | IssueTrackerJsonParseError
    >;
    readonly getIssue: (
      issueId: string,
    ) => Effect.Effect<
      TrackedIssue,
      ProcessRunnerError | IssueTrackerCommandError | IssueTrackerJsonParseError
    >;
    readonly applyAgentState: (
      issueId: string,
      transitionPlan: AgentStateTransitionPlan,
    ) => Effect.Effect<IssueTrackerApplyResult, ProcessRunnerError | IssueTrackerCommandError>;
    readonly writeContract: (
      issueId: string,
      contract: AgentReadyContract,
    ) => Effect.Effect<
      IssueTrackerWriteContractResult,
      | ProcessRunnerError
      | IssueTrackerCommandError
      | IssueTrackerJsonParseError
      | IssueTrackerMalformedMetadataError
      | IssueTrackerContractSchemaError
    >;
    readonly readContract: (
      issueId: string,
    ) => Effect.Effect<
      IssueTrackerReadContractResult,
      | ProcessRunnerError
      | IssueTrackerCommandError
      | IssueTrackerJsonParseError
      | IssueTrackerMalformedMetadataError
      | IssueTrackerContractSchemaError
    >;
  }
>() {}

export type IssueTrackerService = Context.Tag.Service<typeof IssueTracker>;

export type RunStatus = "running" | "succeeded" | "failed";

export type RunSummary = {
  readonly id: string;
  readonly issueId: string;
  readonly lane: Lane;
  readonly status: RunStatus;
  readonly summary: string;
  readonly startedAt: string;
  readonly endedAt?: string;
  readonly failureKind?: FailureKind;
  readonly transcriptPath?: string;
  readonly artifactPath?: string;
};

export type RunEvent = {
  readonly sequence: number;
  readonly runId: string;
  readonly type: string;
  readonly occurredAt: string;
  readonly message?: string;
};

export type CreatePreparationRunInput = {
  readonly issueId: string;
  readonly summary: string;
};

export type FinishRunInput =
  | {
      readonly status: "succeeded";
      readonly message?: string;
    }
  | {
      readonly status: "failed";
      readonly failureKind: FailureKind;
      readonly message?: string;
    };

export type WriteRunArtifactsInput = {
  readonly transcript: string;
  readonly artifact: string;
};

export type RunLogs = {
  readonly runId: string;
  readonly transcriptPath: string;
  readonly transcript: string;
};

export class RunLedgerPersistenceError extends EffectSchema.TaggedError<RunLedgerPersistenceError>(
  "RunLedgerPersistenceError",
)("RunLedgerPersistenceError", {
  operation: EffectSchema.String,
  message: EffectSchema.String,
}) {}

export class RunLedgerNotFoundError extends EffectSchema.TaggedError<RunLedgerNotFoundError>(
  "RunLedgerNotFoundError",
)("RunLedgerNotFoundError", {
  runId: EffectSchema.String,
}) {}

export class RunLedgerLogsNotFoundError extends EffectSchema.TaggedError<RunLedgerLogsNotFoundError>(
  "RunLedgerLogsNotFoundError",
)("RunLedgerLogsNotFoundError", {
  runId: EffectSchema.String,
}) {}

export class RunLedgerInvalidStateError extends EffectSchema.TaggedError<RunLedgerInvalidStateError>(
  "RunLedgerInvalidStateError",
)("RunLedgerInvalidStateError", {
  runId: EffectSchema.String,
  status: EffectSchema.String,
  operation: EffectSchema.String,
}) {}

export type RunLedgerError =
  | RunLedgerPersistenceError
  | RunLedgerNotFoundError
  | RunLedgerLogsNotFoundError
  | RunLedgerInvalidStateError;

export class RunLedger extends Context.Tag("@morpheus/runtime/RunLedger")<
  RunLedger,
  {
    readonly createPreparationRun: (
      input: CreatePreparationRunInput,
    ) => Effect.Effect<RunSummary, RunLedgerPersistenceError>;
    readonly finishRun: (
      runId: string,
      input: FinishRunInput,
    ) => Effect.Effect<
      RunSummary,
      RunLedgerInvalidStateError | RunLedgerNotFoundError | RunLedgerPersistenceError
    >;
    readonly writeRunArtifacts: (
      runId: string,
      input: WriteRunArtifactsInput,
    ) => Effect.Effect<RunSummary, RunLedgerNotFoundError | RunLedgerPersistenceError>;
    readonly getRunLogs: (
      runId: string,
    ) => Effect.Effect<RunLogs, RunLedgerLogsNotFoundError | RunLedgerPersistenceError>;
    readonly listRuns: () => Effect.Effect<readonly RunSummary[], RunLedgerPersistenceError>;
    readonly getRun: (
      runId: string,
    ) => Effect.Effect<RunSummary | undefined, RunLedgerPersistenceError>;
    readonly getRunEvents: (
      runId: string,
    ) => Effect.Effect<readonly RunEvent[], RunLedgerPersistenceError>;
  }
>() {}

export type RunLedgerService = Context.Tag.Service<typeof RunLedger>;

export const renderRunList = (runs: readonly RunSummary[]): string => {
  if (runs.length === 0) {
    return "No Morpheus runs";
  }

  return runs
    .map((run) => `${run.id} ${run.issueId} ${run.lane} ${run.status} ${run.summary}`)
    .join("\n");
};

export const renderRunDetail = (run: RunSummary, events: readonly RunEvent[]): string =>
  [
    `Run ${run.id}`,
    `issue: ${run.issueId}`,
    `lane: ${run.lane}`,
    `status: ${run.status}`,
    `summary: ${run.summary}`,
    `failureKind: ${run.failureKind ?? "None"}`,
    `transcript: ${run.transcriptPath ?? "None"}`,
    "events:",
    ...events.map(
      (event) =>
        `${event.sequence}. ${event.type}${event.message === undefined ? "" : ` - ${event.message}`}`,
    ),
  ].join("\n");

export const renderRunLogs = (logs: RunLogs): string => logs.transcript;

export const listRunsForCli: Effect.Effect<string, RunLedgerPersistenceError, RunLedger> =
  Effect.gen(function* () {
    const ledger = yield* RunLedger;
    return renderRunList(yield* ledger.listRuns());
  });

export const showRunForCli = (
  runId: string,
): Effect.Effect<string, RunLedgerNotFoundError | RunLedgerPersistenceError, RunLedger> =>
  Effect.gen(function* () {
    const ledger = yield* RunLedger;
    const run = yield* ledger.getRun(runId);

    if (run === undefined) {
      return yield* new RunLedgerNotFoundError({ runId });
    }

    return renderRunDetail(run, yield* ledger.getRunEvents(runId));
  });

export const showRunLogsForCli = (
  runId: string,
): Effect.Effect<string, RunLedgerLogsNotFoundError | RunLedgerPersistenceError, RunLedger> =>
  Effect.gen(function* () {
    const ledger = yield* RunLedger;
    return renderRunLogs(yield* ledger.getRunLogs(runId));
  });

export const AgentReadyContractSchema = Schema.Struct({
  category: Schema.String,
  summary: Schema.String,
  currentBehavior: Schema.String,
  desiredBehavior: Schema.String,
  keyInterfaces: Schema.Array(Schema.String),
  acceptanceCriteria: Schema.Array(Schema.String),
  outOfScope: Schema.Array(Schema.String),
  verificationPlan: Schema.Array(Schema.String),
  blockedBy: Schema.String,
  hitlDecisions: Schema.String,
  riskLevel: Schema.Literal("low", "medium", "high"),
});

export type AgentReadyContractDecodeResult =
  | {
      readonly status: "valid";
      readonly contract: AgentReadyContract;
    }
  | {
      readonly status: "invalid";
      readonly message: string;
    };

export type AfkReadyContractValidationResult =
  | {
      readonly status: "valid";
      readonly contract: AgentReadyContract;
    }
  | {
      readonly status: "invalid";
      readonly reason: "blocked_by_present" | "hitl_decisions_present";
    };

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const decodeAgentReadyContract = (value: unknown): AgentReadyContractDecodeResult => {
  try {
    return {
      status: "valid",
      contract: Schema.decodeUnknownSync(AgentReadyContractSchema)(value) as AgentReadyContract,
    };
  } catch (error) {
    return {
      status: "invalid",
      message: errorMessage(error),
    };
  }
};

export const validateAfkReadyContract = (
  contract: AgentReadyContract,
): AfkReadyContractValidationResult => {
  if (contract.blockedBy !== "None") {
    return {
      status: "invalid",
      reason: "blocked_by_present",
    };
  }

  if (contract.hitlDecisions !== "None") {
    return {
      status: "invalid",
      reason: "hitl_decisions_present",
    };
  }

  return {
    status: "valid",
    contract,
  };
};

const LaneConcurrencySchema = Schema.Number.pipe(Schema.int(), Schema.positive());

export const MorpheusConfigSchema = Schema.Struct({
  targetRepo: Schema.String,
  issueTracker: Schema.Struct({
    kind: Schema.Literal("beads"),
  }),
  mergeRequests: Schema.Struct({
    kind: Schema.Literal("gitlab-glab"),
  }),
  agentRunner: Schema.Struct({
    kind: Schema.Literal("sandcastle"),
  }),
  ledger: Schema.Struct({
    path: Schema.String,
  }),
  lanes: Schema.Struct({
    preparation: Schema.Struct({
      concurrency: LaneConcurrencySchema,
    }),
    implementation: Schema.Struct({
      concurrency: LaneConcurrencySchema,
    }),
    review: Schema.Struct({
      concurrency: LaneConcurrencySchema,
    }),
  }),
  verification: Schema.Struct({
    commands: Schema.Array(Schema.String),
  }),
  retention: Schema.Struct({
    completedIntermediate: Schema.Struct({
      keepDays: Schema.Number,
      keepLast: Schema.Number,
    }),
    failed: Schema.Literal("manual"),
    reviewCandidate: Schema.Literal("until-mr-closed-or-manual"),
    active: Schema.Literal("never"),
  }),
  prompts: Schema.optional(
    Schema.Struct({
      prepare: Schema.String,
      implement: Schema.String,
      review: Schema.String,
    }),
  ),
});

export type MorpheusConfig = Schema.Schema.Type<typeof MorpheusConfigSchema>;

export type ConfigLoadOptions = {
  readonly configPath?: string;
  readonly targetRepo?: string;
};

export type ConfigLoadError =
  | {
      readonly kind: "missing_config";
      readonly path: string;
    }
  | {
      readonly kind: "malformed_json";
      readonly path: string;
      readonly message: string;
    }
  | {
      readonly kind: "schema_validation";
      readonly path: string;
      readonly message: string;
    };

export type ConfigLoadResult =
  | {
      readonly status: "loaded";
      readonly path: string;
      readonly config: MorpheusConfig;
    }
  | {
      readonly status: "error";
      readonly error: ConfigLoadError;
    };

const configPathFromOptions = (options: ConfigLoadOptions): string => {
  if (options.configPath !== undefined) {
    return resolve(options.configPath);
  }

  return resolve(options.targetRepo ?? process.cwd(), "morpheus.config.json");
};

export const loadMorpheusConfig = (options: ConfigLoadOptions = {}): ConfigLoadResult => {
  const path = configPathFromOptions(options);

  if (!existsSync(path)) {
    return {
      status: "error",
      error: {
        kind: "missing_config",
        path,
      },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    return {
      status: "error",
      error: {
        kind: "malformed_json",
        path,
        message: errorMessage(error),
      },
    };
  }

  try {
    return {
      status: "loaded",
      path,
      config: Schema.decodeUnknownSync(MorpheusConfigSchema)(parsed),
    };
  } catch (error) {
    return {
      status: "error",
      error: {
        kind: "schema_validation",
        path,
        message: errorMessage(error),
      },
    };
  }
};
