import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as Schema from "@effect/schema/Schema";
import { planAgentStateTransition, renderDraftReviewArtifact } from "@morpheus/core";
import { Context, Effect, Either, Schema as EffectSchema } from "effect";
import type {
  AgentReadyContract,
  AgentStateTransitionPlan,
  DerivedIssueState,
  FailureKind,
  Lane,
  RunnableLane,
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

export type PreparedImplementationWorkspace = {
  readonly workspacePath: string;
  readonly worktreePath?: string;
  readonly branch: string;
  readonly targetBranch: string;
  readonly remote: string;
};

export class WorkspaceRuntimeError extends EffectSchema.TaggedError<WorkspaceRuntimeError>(
  "WorkspaceRuntimeError",
)("WorkspaceRuntimeError", {
  operation: EffectSchema.String,
  message: EffectSchema.String,
}) {}

export class WorkspaceRuntime extends Context.Tag("@morpheus/runtime/WorkspaceRuntime")<
  WorkspaceRuntime,
  {
    readonly prepareImplementationWorkspace: (input: {
      readonly issueId: string;
      readonly runId: string;
    }) => Effect.Effect<PreparedImplementationWorkspace, WorkspaceRuntimeError>;
  }
>() {}

export type WorkspaceRuntimeService = Context.Tag.Service<typeof WorkspaceRuntime>;

export type DraftMergeRequestInput = {
  readonly issueId: string;
  readonly title: string;
  readonly sourceBranch: string;
  readonly targetBranch: string;
  readonly description: string;
};

export type UpdateMergeRequestDescriptionInput = {
  readonly reference: string;
  readonly description: string;
};

export type MergeRequestReference = {
  readonly reference: string;
  readonly url?: string;
};

export class MergeRequestClientError extends EffectSchema.TaggedError<MergeRequestClientError>(
  "MergeRequestClientError",
)("MergeRequestClientError", {
  operation: EffectSchema.String,
  failureKind: EffectSchema.Literal("operator_access", "runtime_error"),
  message: EffectSchema.String,
}) {}

export class MergeRequestClient extends Context.Tag("@morpheus/runtime/MergeRequestClient")<
  MergeRequestClient,
  {
    readonly createDraftMergeRequest: (
      input: DraftMergeRequestInput,
    ) => Effect.Effect<MergeRequestReference, MergeRequestClientError>;
    readonly updateDescription: (
      input: UpdateMergeRequestDescriptionInput,
    ) => Effect.Effect<MergeRequestReference, MergeRequestClientError>;
  }
>() {}

export type MergeRequestClientService = Context.Tag.Service<typeof MergeRequestClient>;

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
    ) => Effect.Effect<
      IssueTrackerApplyResult,
      ProcessRunnerError | IssueTrackerCommandError | IssueTrackerJsonParseError
    >;
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

export type PreparationAgentInput = {
  readonly issue: TrackedIssue;
};

export type PreparationAgentResult =
  | {
      readonly status: "prepared";
      readonly contract: unknown;
      readonly transcript: string;
      readonly artifact: unknown;
    }
  | {
      readonly status: "blocked";
      readonly reason: string;
      readonly transcript: string;
      readonly artifact: unknown;
    }
  | {
      readonly status: "failed";
      readonly failureKind: FailureKind;
      readonly message: string;
      readonly transcript: string;
      readonly artifact: unknown;
    };

export class AgentRunnerError extends EffectSchema.TaggedError<AgentRunnerError>(
  "AgentRunnerError",
)("AgentRunnerError", {
  operation: EffectSchema.String,
  message: EffectSchema.String,
}) {}

export class AgentRunner extends Context.Tag("@morpheus/runtime/AgentRunner")<
  AgentRunner,
  {
    readonly prepareIssue: (
      input: PreparationAgentInput,
    ) => Effect.Effect<PreparationAgentResult, AgentRunnerError>;
  }
>() {}

export type AgentRunnerService = Context.Tag.Service<typeof AgentRunner>;

export const runStatuses = ["running", "succeeded", "failed"] as const;

export type RunStatus = (typeof runStatuses)[number];

export type RunSummary = {
  readonly id: string;
  readonly issueId: string;
  readonly lane: RunnableLane;
  readonly status: RunStatus;
  readonly summary: string;
  readonly startedAt: string;
  readonly endedAt?: string;
  readonly failureKind?: FailureKind;
  readonly transcriptPath?: string;
  readonly artifactPath?: string;
  readonly workspacePath?: string;
  readonly worktreePath?: string;
  readonly branch?: string;
  readonly mergeRequestRef?: string;
  readonly mergeRequestUrl?: string;
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

export type CreateImplementationRunInput = {
  readonly issueId: string;
  readonly summary: string;
};

export type FinishRunInput =
  | {
      readonly status: "succeeded";
      readonly terminalEvent?: string;
      readonly message?: string;
    }
  | {
      readonly status: "failed";
      readonly failureKind: FailureKind;
      readonly terminalEvent?: string;
      readonly message?: string;
    };

export type RecordImplementationWorkspaceInput = {
  readonly workspacePath: string;
  readonly worktreePath?: string;
  readonly branch: string;
};

export type RecordMergeRequestInput = {
  readonly reference: string;
  readonly url?: string;
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
    readonly createImplementationRun: (
      input: CreateImplementationRunInput,
    ) => Effect.Effect<RunSummary, RunLedgerPersistenceError>;
    readonly recordImplementationWorkspace: (
      runId: string,
      input: RecordImplementationWorkspaceInput,
    ) => Effect.Effect<
      RunSummary,
      RunLedgerInvalidStateError | RunLedgerNotFoundError | RunLedgerPersistenceError
    >;
    readonly recordMergeRequest: (
      runId: string,
      input: RecordMergeRequestInput,
    ) => Effect.Effect<
      RunSummary,
      RunLedgerInvalidStateError | RunLedgerNotFoundError | RunLedgerPersistenceError
    >;
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
    `workspace: ${run.workspacePath ?? "None"}`,
    `worktree: ${run.worktreePath ?? "None"}`,
    `branch: ${run.branch ?? "None"}`,
    `mergeRequest: ${run.mergeRequestRef ?? "None"}`,
    `mergeRequestUrl: ${run.mergeRequestUrl ?? "None"}`,
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

export type PrepareIssueResult =
  | {
      readonly status: "prepared";
      readonly issueId: string;
      readonly run: RunSummary;
      readonly contract: AgentReadyContract;
    }
  | {
      readonly status: "blocked";
      readonly issueId: string;
      readonly run: RunSummary;
      readonly reason: string;
    }
  | {
      readonly status: "failed";
      readonly issueId: string;
      readonly run?: RunSummary;
      readonly failureKind: FailureKind;
      readonly message: string;
    }
  | {
      readonly status: "state_rejected";
      readonly issueId: string;
      readonly reason: Extract<IssueTrackerApplyResult, { readonly status: "rejected" }>["reason"];
      readonly failureKind: FailureKind;
    };

const artifactToString = (artifact: unknown): Effect.Effect<string, RunLedgerPersistenceError> =>
  Effect.try({
    try: () => JSON.stringify(artifact, null, 2),
    catch: (error) =>
      new RunLedgerPersistenceError({
        operation: "serializeRunArtifact",
        message: errorMessage(error),
      }),
  });

const terminalPlanFromPreparing = (
  labels: readonly string[],
  event: "PreparationReady" | "PreparationBlocked" | "PreparationFailed",
): AgentStateTransitionPlan => planAgentStateTransition(labels, event);

const finishFailed = (
  ledger: RunLedgerService,
  runId: string,
  failureKind: FailureKind,
  message: string,
  terminalEvent: "PreparationFailed" | "PreparationBlocked" = "PreparationFailed",
): Effect.Effect<RunSummary, RunLedgerError> =>
  ledger.finishRun(runId, {
    status: "failed",
    failureKind,
    terminalEvent,
    message,
  });

const applyTerminalTransition = (
  tracker: IssueTrackerService,
  issueId: string,
  event: "PreparationReady" | "PreparationBlocked" | "PreparationFailed",
): Effect.Effect<IssueTrackerApplyResult, IssueTrackerError> =>
  Effect.gen(function* () {
    const currentIssue = yield* tracker.getIssue(issueId);
    return yield* tracker.applyAgentState(
      issueId,
      terminalPlanFromPreparing(currentIssue.labels, event),
    );
  });

const failedPreparationResult = (
  issueId: string,
  run: RunSummary,
  failureKind: FailureKind,
  message: string,
): Extract<PrepareIssueResult, { readonly status: "failed" }> => ({
  status: "failed",
  issueId,
  run,
  failureKind,
  message,
});

const blockedPreparationResult = (
  issueId: string,
  run: RunSummary,
  reason: string,
): Extract<PrepareIssueResult, { readonly status: "blocked" }> => ({
  status: "blocked",
  issueId,
  run,
  reason,
});

const finishHandledFailure = (
  ledger: RunLedgerService,
  runId: string,
  failureKind: FailureKind,
  message: string,
  terminalEvent?: "PreparationFailed" | "PreparationBlocked",
): Effect.Effect<RunSummary, RunLedgerError> =>
  finishFailed(ledger, runId, failureKind, message, terminalEvent);

const failRunAfterArtifactWriteFailure = (
  ledger: RunLedgerService,
  tracker: IssueTrackerService,
  issueId: string,
  runId: string,
  writeError: RunLedgerError,
): Effect.Effect<Extract<PrepareIssueResult, { readonly status: "failed" }>, RunLedgerError> =>
  Effect.gen(function* () {
    const message = `Preparation artifact write failed: ${errorMessage(writeError)}`;
    yield* Effect.either(applyTerminalTransition(tracker, issueId, "PreparationFailed"));
    const terminalRun = yield* finishHandledFailure(ledger, runId, "runtime_error", message);
    return failedPreparationResult(issueId, terminalRun, "runtime_error", message);
  });

const writeArtifactsOrFailRun = (
  ledger: RunLedgerService,
  tracker: IssueTrackerService,
  issueId: string,
  runId: string,
  input: {
    readonly transcript: string;
    readonly artifact: unknown;
  },
): Effect.Effect<
  | { readonly status: "written" }
  | {
      readonly status: "failed";
      readonly result: Extract<PrepareIssueResult, { readonly status: "failed" }>;
    },
  RunLedgerError
> =>
  Effect.gen(function* () {
    const artifactResult = yield* Effect.either(artifactToString(input.artifact));
    if (Either.isLeft(artifactResult)) {
      return {
        status: "failed",
        result: yield* failRunAfterArtifactWriteFailure(
          ledger,
          tracker,
          issueId,
          runId,
          artifactResult.left,
        ),
      };
    }

    const writeResult = yield* Effect.either(
      ledger.writeRunArtifacts(runId, {
        transcript: input.transcript,
        artifact: artifactResult.right,
      }),
    );
    if (Either.isLeft(writeResult)) {
      return {
        status: "failed",
        result: yield* failRunAfterArtifactWriteFailure(
          ledger,
          tracker,
          issueId,
          runId,
          writeResult.left,
        ),
      };
    }

    return { status: "written" };
  });

const terminalFailureKind = (
  terminalResult: Either.Either<IssueTrackerApplyResult, IssueTrackerError>,
  appliedFailureKind: FailureKind,
): FailureKind => {
  if (Either.isLeft(terminalResult)) {
    return "runtime_error";
  }

  return terminalResult.right.status === "applied" ? appliedFailureKind : "state_conflict";
};

const terminalFailureMessage = (
  terminalResult: Either.Either<IssueTrackerApplyResult, IssueTrackerError>,
  successMessage: string,
  rejectedMessage: string,
): string => {
  if (Either.isLeft(terminalResult)) {
    return `${rejectedMessage}: ${errorMessage(terminalResult.left)}`;
  }

  return terminalResult.right.status === "applied" ? successMessage : rejectedMessage;
};

const terminalEventWhenApplied = (
  terminalResult: Either.Either<IssueTrackerApplyResult, IssueTrackerError>,
  terminalEvent: "PreparationFailed" | "PreparationBlocked",
): "PreparationFailed" | "PreparationBlocked" =>
  Either.isRight(terminalResult) && terminalResult.right.status === "applied"
    ? terminalEvent
    : "PreparationFailed";

export const prepareIssue = (
  issueId: string,
): Effect.Effect<
  PrepareIssueResult,
  IssueTrackerError | RunLedgerError | AgentRunnerError,
  IssueTracker | RunLedger | AgentRunner
> =>
  Effect.gen(function* () {
    const tracker = yield* IssueTracker;
    const ledger = yield* RunLedger;
    const runner = yield* AgentRunner;

    const issue = yield* tracker.getIssue(issueId);
    const startPlan = planAgentStateTransition(issue.labels, "StartPreparation");
    if (startPlan.status !== "planned") {
      return {
        status: "state_rejected",
        issueId,
        reason: startPlan.status,
        failureKind: startPlan.status === "conflict" ? "state_conflict" : "runtime_error",
      };
    }

    const run = yield* ledger.createPreparationRun({
      issueId,
      summary: issue.title,
    });

    const startResult = yield* Effect.either(tracker.applyAgentState(issueId, startPlan));
    if (Either.isLeft(startResult) || startResult.right.status === "rejected") {
      const failureKind = terminalFailureKind(startResult, "state_conflict");
      const message = terminalFailureMessage(
        startResult,
        "Preparation start rejected.",
        "Preparation start rejected.",
      );
      const terminalRun = yield* finishHandledFailure(ledger, run.id, failureKind, message);

      return failedPreparationResult(
        issueId,
        terminalRun,
        terminalRun.failureKind ?? failureKind,
        message,
      );
    }

    const resultEither = yield* Effect.either(runner.prepareIssue({ issue }));
    if (Either.isLeft(resultEither)) {
      const message = `Agent runner failed during preparation: ${resultEither.left.message}`;
      const artifacts = yield* writeArtifactsOrFailRun(ledger, tracker, issueId, run.id, {
        transcript: message,
        artifact: {
          status: "failed",
          failureKind: "runtime_error",
          message,
        },
      });
      if (artifacts.status === "failed") {
        return artifacts.result;
      }

      const terminal = yield* Effect.either(
        applyTerminalTransition(tracker, issueId, "PreparationFailed"),
      );
      const terminalRun = yield* finishHandledFailure(
        ledger,
        run.id,
        terminalFailureKind(terminal, "runtime_error"),
        terminalFailureMessage(terminal, message, "Preparation failed transition rejected"),
      );

      return {
        status: "failed",
        issueId,
        run: terminalRun,
        failureKind: terminalRun.failureKind ?? terminalFailureKind(terminal, "runtime_error"),
        message,
      };
    }

    const result = resultEither.right;

    if (result.status === "blocked") {
      const artifacts = yield* writeArtifactsOrFailRun(ledger, tracker, issueId, run.id, {
        transcript: result.transcript,
        artifact: result.artifact,
      });
      if (artifacts.status === "failed") {
        return artifacts.result;
      }

      const terminal = yield* Effect.either(
        applyTerminalTransition(tracker, issueId, "PreparationBlocked"),
      );
      const message = `Preparation blocked: ${result.reason}`;
      const terminalRun = yield* finishHandledFailure(
        ledger,
        run.id,
        terminalFailureKind(terminal, "agent_contract_error"),
        terminalFailureMessage(terminal, message, "Preparation blocked transition rejected"),
        terminalEventWhenApplied(terminal, "PreparationBlocked"),
      );

      if (terminalRun.failureKind !== "agent_contract_error") {
        return failedPreparationResult(
          issueId,
          terminalRun,
          terminalRun.failureKind ?? "state_conflict",
          "Preparation blocked transition rejected.",
        );
      }

      return blockedPreparationResult(issueId, terminalRun, result.reason);
    }

    if (result.status === "failed") {
      const artifacts = yield* writeArtifactsOrFailRun(ledger, tracker, issueId, run.id, {
        transcript: result.transcript,
        artifact: result.artifact,
      });
      if (artifacts.status === "failed") {
        return artifacts.result;
      }

      const terminal = yield* Effect.either(
        applyTerminalTransition(tracker, issueId, "PreparationFailed"),
      );
      const terminalRun = yield* finishHandledFailure(
        ledger,
        run.id,
        terminalFailureKind(terminal, result.failureKind),
        terminalFailureMessage(terminal, result.message, "Preparation failed transition rejected"),
      );

      return failedPreparationResult(
        issueId,
        terminalRun,
        terminalRun.failureKind ?? result.failureKind,
        result.message,
      );
    }

    const artifacts = yield* writeArtifactsOrFailRun(ledger, tracker, issueId, run.id, {
      transcript: result.transcript,
      artifact: result.artifact,
    });
    if (artifacts.status === "failed") {
      return artifacts.result;
    }

    const decoded = decodeAgentReadyContract(result.contract);
    if (decoded.status === "invalid") {
      const message = `Invalid Agent-Ready Contract: ${decoded.message}`;
      const terminal = yield* Effect.either(
        applyTerminalTransition(tracker, issueId, "PreparationFailed"),
      );
      const terminalRun = yield* finishHandledFailure(
        ledger,
        run.id,
        terminalFailureKind(terminal, "agent_contract_error"),
        terminalFailureMessage(terminal, message, "Preparation failed transition rejected"),
      );

      return failedPreparationResult(
        issueId,
        terminalRun,
        terminalRun.failureKind ?? terminalFailureKind(terminal, "agent_contract_error"),
        message,
      );
    }

    const afk = validateAfkReadyContract(decoded.contract);
    if (afk.status === "invalid") {
      const reason = afk.message;
      const terminal = yield* Effect.either(
        applyTerminalTransition(tracker, issueId, "PreparationBlocked"),
      );
      const terminalRun = yield* finishHandledFailure(
        ledger,
        run.id,
        terminalFailureKind(terminal, "agent_contract_error"),
        terminalFailureMessage(
          terminal,
          `Preparation blocked: ${reason}`,
          "Preparation blocked transition rejected",
        ),
        terminalEventWhenApplied(terminal, "PreparationBlocked"),
      );

      if (terminalRun.failureKind !== "agent_contract_error") {
        return failedPreparationResult(
          issueId,
          terminalRun,
          terminalRun.failureKind ?? "state_conflict",
          "Preparation blocked transition rejected.",
        );
      }

      return blockedPreparationResult(issueId, terminalRun, reason);
    }

    const readyIssue = yield* tracker.getIssue(issueId);
    const readyPlan = terminalPlanFromPreparing(readyIssue.labels, "PreparationReady");
    if (readyPlan.status !== "planned") {
      const message = "Preparation ready transition rejected.";
      const terminalRun = yield* finishHandledFailure(ledger, run.id, "state_conflict", message);

      return failedPreparationResult(issueId, terminalRun, "state_conflict", message);
    }

    const writeContractResult = yield* Effect.either(tracker.writeContract(issueId, afk.contract));
    if (Either.isLeft(writeContractResult)) {
      const terminal = yield* Effect.either(
        applyTerminalTransition(tracker, issueId, "PreparationFailed"),
      );
      const message = terminalFailureMessage(
        terminal,
        `Agent-Ready Contract write failed: ${errorMessage(writeContractResult.left)}`,
        `Agent-Ready Contract write failed: ${errorMessage(writeContractResult.left)}`,
      );
      const terminalRun = yield* finishHandledFailure(
        ledger,
        run.id,
        terminalFailureKind(terminal, "runtime_error"),
        message,
      );

      return failedPreparationResult(
        issueId,
        terminalRun,
        terminalRun.failureKind ?? terminalFailureKind(terminal, "runtime_error"),
        message,
      );
    }

    const terminal = yield* Effect.either(
      applyTerminalTransition(tracker, issueId, "PreparationReady"),
    );

    if (Either.isLeft(terminal) || terminal.right.status === "rejected") {
      const message = terminalFailureMessage(
        terminal,
        "Preparation ready transition rejected.",
        "Preparation ready transition rejected.",
      );
      const terminalRun = yield* finishHandledFailure(
        ledger,
        run.id,
        terminalFailureKind(terminal, "state_conflict"),
        message,
      );

      return failedPreparationResult(
        issueId,
        terminalRun,
        terminalRun.failureKind ?? "state_conflict",
        message,
      );
    }

    const terminalRun = yield* ledger.finishRun(run.id, {
      status: "succeeded",
      message: "Agent-Ready Contract written.",
    });

    return {
      status: "prepared",
      issueId,
      run: terminalRun,
      contract: afk.contract,
    };
  });

export type StartImplementationResult =
  | {
      readonly status: "started";
      readonly issueId: string;
      readonly run: RunSummary;
      readonly workspace: PreparedImplementationWorkspace;
      readonly mergeRequest: MergeRequestReference;
    }
  | {
      readonly status: "failed";
      readonly issueId: string;
      readonly run?: RunSummary;
      readonly failureKind: FailureKind;
      readonly message: string;
    }
  | {
      readonly status: "state_rejected";
      readonly issueId: string;
      readonly reason: Extract<IssueTrackerApplyResult, { readonly status: "rejected" }>["reason"];
      readonly failureKind: FailureKind;
    };

const failImplementationStart = (
  tracker: IssueTrackerService,
  ledger: RunLedgerService,
  issueId: string,
  runId: string,
  failureKind: FailureKind,
  message: string,
): Effect.Effect<
  Extract<StartImplementationResult, { readonly status: "failed" }>,
  RunLedgerError
> =>
  Effect.gen(function* () {
    const terminal = yield* Effect.either(
      Effect.gen(function* () {
        const currentIssue = yield* tracker.getIssue(issueId);
        return yield* tracker.applyAgentState(
          issueId,
          planAgentStateTransition(currentIssue.labels, "ImplementationFailed"),
        );
      }),
    );
    const terminalFailure = terminalFailureKind(terminal, failureKind);
    const terminalMessage = terminalFailureMessage(
      terminal,
      message,
      "Implementation failed transition rejected.",
    );

    const run = yield* ledger.finishRun(runId, {
      status: "failed",
      failureKind: terminalFailure,
      terminalEvent: "ImplementationFailed",
      message: terminalMessage,
    });

    return {
      status: "failed",
      issueId,
      run,
      failureKind: run.failureKind ?? terminalFailure,
      message: terminalMessage,
    };
  });

export const startImplementation = (
  issueId: string,
): Effect.Effect<
  StartImplementationResult,
  | IssueTrackerError
  | RunLedgerError
  | WorkspaceRuntimeError
  | MergeRequestClientError,
  IssueTracker | RunLedger | WorkspaceRuntime | MergeRequestClient
> =>
  Effect.gen(function* () {
    const tracker = yield* IssueTracker;
    const ledger = yield* RunLedger;
    const workspaceRuntime = yield* WorkspaceRuntime;
    const mergeRequests = yield* MergeRequestClient;

    const issue = yield* tracker.getIssue(issueId);
    const startPlan = planAgentStateTransition(issue.labels, "StartImplementation");
    if (startPlan.status !== "planned") {
      return {
        status: "state_rejected",
        issueId,
        reason: startPlan.status,
        failureKind: startPlan.status === "conflict" ? "state_conflict" : "runtime_error",
      };
    }

    const run = yield* ledger.createImplementationRun({
      issueId,
      summary: issue.title,
    });

    const workspaceResult = yield* Effect.either(
      workspaceRuntime.prepareImplementationWorkspace({
        issueId,
        runId: run.id,
      }),
    );
    if (Either.isLeft(workspaceResult)) {
      return yield* failImplementationStart(
        tracker,
        ledger,
        issueId,
        run.id,
        "runtime_error",
        `Workspace preparation failed: ${workspaceResult.left.message}`,
      );
    }

    const workspace = workspaceResult.right;
    const workspaceRunResult = yield* Effect.either(
      ledger.recordImplementationWorkspace(run.id, {
        workspacePath: workspace.workspacePath,
        worktreePath: workspace.worktreePath,
        branch: workspace.branch,
      }),
    );
    if (Either.isLeft(workspaceRunResult)) {
      return yield* failImplementationStart(
        tracker,
        ledger,
        issueId,
        run.id,
        "runtime_error",
        `Implementation workspace ledger update failed: ${errorMessage(workspaceRunResult.left)}`,
      );
    }

    const contractResult = yield* Effect.either(tracker.readContract(issueId));
    if (Either.isLeft(contractResult)) {
      return yield* failImplementationStart(
        tracker,
        ledger,
        issueId,
        run.id,
        "runtime_error",
        `Agent-Ready Contract read failed: ${errorMessage(contractResult.left)}`,
      );
    }
    if (contractResult.right.status === "missing") {
      return yield* failImplementationStart(
        tracker,
        ledger,
        issueId,
        run.id,
        "agent_contract_error",
        "Agent-Ready Contract metadata missing.",
      );
    }
    const contract = contractResult.right.contract;
    const mergeRequestResult = yield* Effect.either(
      mergeRequests.createDraftMergeRequest({
        issueId,
        title: `Draft: ${issue.title}`,
        sourceBranch: workspace.branch,
        targetBranch: workspace.targetBranch,
        description: renderDraftReviewArtifact({ issueId: issue.id, contract }),
      }),
    );
    if (Either.isLeft(mergeRequestResult)) {
      return yield* failImplementationStart(
        tracker,
        ledger,
        issueId,
        run.id,
        mergeRequestResult.left.failureKind,
        `Draft MR creation failed: ${mergeRequestResult.left.message}`,
      );
    }

    const mergeRequest = mergeRequestResult.right;
    const mrRunResult = yield* Effect.either(ledger.recordMergeRequest(run.id, mergeRequest));
    if (Either.isLeft(mrRunResult)) {
      return yield* failImplementationStart(
        tracker,
        ledger,
        issueId,
        run.id,
        "runtime_error",
        `Draft MR ledger update failed: ${errorMessage(mrRunResult.left)}`,
      );
    }

    const mrRun = mrRunResult.right;

    const currentIssue = yield* tracker.getIssue(issueId);
    const currentStartPlan = planAgentStateTransition(currentIssue.labels, "StartImplementation");
    const startResult = yield* Effect.either(
      tracker.applyAgentState(issueId, currentStartPlan),
    );
    if (Either.isLeft(startResult) || startResult.right.status === "rejected") {
      const message = terminalFailureMessage(
        startResult,
        "Implementation start transition rejected.",
        "Implementation start transition rejected.",
      );
      return yield* failImplementationStart(
        tracker,
        ledger,
        issueId,
        run.id,
        "state_conflict",
        message,
      );
    }

    return {
      status: "started",
      issueId,
      run: mrRun,
      workspace,
      mergeRequest,
    };
  });

export const renderPrepareIssueResult = (result: PrepareIssueResult): string => {
  if (result.status === "prepared") {
    return [
      `Prepared ${result.issueId}`,
      `run: ${result.run.id}`,
      `contract: written`,
      `transcript: ${result.run.transcriptPath ?? "None"}`,
      `artifact: ${result.run.artifactPath ?? "None"}`,
    ].join("\n");
  }

  if (result.status === "blocked") {
    return [
      `Blocked ${result.issueId}`,
      `run: ${result.run.id}`,
      `reason: ${result.reason}`,
      `failureKind: ${result.run.failureKind ?? "agent_contract_error"}`,
      `transcript: ${result.run.transcriptPath ?? "None"}`,
      `artifact: ${result.run.artifactPath ?? "None"}`,
    ].join("\n");
  }

  if (result.status === "state_rejected") {
    return [
      `State rejected ${result.issueId}`,
      `reason: ${result.reason}`,
      `failureKind: ${result.failureKind}`,
    ].join("\n");
  }

  return [
    `Failed ${result.issueId}`,
    `run: ${result.run?.id ?? "None"}`,
    `failureKind: ${result.failureKind}`,
    `message: ${result.message}`,
    `transcript: ${result.run?.transcriptPath ?? "None"}`,
    `artifact: ${result.run?.artifactPath ?? "None"}`,
  ].join("\n");
};

export const renderStartImplementationResult = (result: StartImplementationResult): string => {
  if (result.status === "started") {
    return [
      `Started implementation ${result.issueId}`,
      `run: ${result.run.id}`,
      `workspace: ${result.workspace.workspacePath}`,
      `worktree: ${result.workspace.worktreePath ?? "None"}`,
      `branch: ${result.workspace.branch}`,
      `mergeRequest: ${result.mergeRequest.reference}`,
      `mergeRequestUrl: ${result.mergeRequest.url ?? "None"}`,
    ].join("\n");
  }

  if (result.status === "state_rejected") {
    return [
      `State rejected ${result.issueId}`,
      `reason: ${result.reason}`,
      `failureKind: ${result.failureKind}`,
    ].join("\n");
  }

  return [
    `Failed ${result.issueId}`,
    `run: ${result.run?.id ?? "None"}`,
    `failureKind: ${result.failureKind}`,
    `message: ${result.message}`,
  ].join("\n");
};

export const prepareIssueForCli = (
  issueId: string,
): Effect.Effect<
  string,
  IssueTrackerError | RunLedgerError | AgentRunnerError,
  IssueTracker | RunLedger | AgentRunner
> => prepareIssue(issueId).pipe(Effect.map(renderPrepareIssueResult));

export const startImplementationForCli = (
  issueId: string,
): Effect.Effect<
  string,
  IssueTrackerError | RunLedgerError | WorkspaceRuntimeError | MergeRequestClientError,
  IssueTracker | RunLedger | WorkspaceRuntime | MergeRequestClient
> => startImplementation(issueId).pipe(Effect.map(renderStartImplementationResult));

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
      readonly message: string;
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
  const requiredTextEntries = [
    ["category", contract.category],
    ["summary", contract.summary],
    ["currentBehavior", contract.currentBehavior],
    ["desiredBehavior", contract.desiredBehavior],
    ["blockedBy", contract.blockedBy],
    ["hitlDecisions", contract.hitlDecisions],
  ] as const;
  const emptyTextEntry = requiredTextEntries.find(([, value]) => value.trim().length === 0);
  if (emptyTextEntry !== undefined) {
    return {
      status: "invalid",
      message: `${emptyTextEntry[0]} must not be empty`,
    };
  }

  const requiredListEntries = [
    ["keyInterfaces", contract.keyInterfaces],
    ["acceptanceCriteria", contract.acceptanceCriteria],
    ["outOfScope", contract.outOfScope],
    ["verificationPlan", contract.verificationPlan],
  ] as const;
  const emptyListEntry = requiredListEntries.find(
    ([, values]) => values.length === 0 || values.some((value) => value.trim().length === 0),
  );
  if (emptyListEntry !== undefined) {
    return {
      status: "invalid",
      message: `${emptyListEntry[0]} must contain non-empty entries`,
    };
  }

  if (contract.blockedBy !== "None") {
    return {
      status: "invalid",
      message: `blockedBy must be None: ${contract.blockedBy}`,
    };
  }

  if (contract.hitlDecisions !== "None") {
    return {
      status: "invalid",
      message: `hitlDecisions must be None: ${contract.hitlDecisions}`,
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
      prepare: Schema.optional(Schema.String),
      implement: Schema.optional(Schema.String),
      review: Schema.optional(Schema.String),
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
