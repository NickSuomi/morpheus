import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as Schema from "@effect/schema/Schema";
import {
  agentStates,
  failureKinds,
  planAgentStateTransition,
  renderDraftReviewArtifact,
  renderReviewArtifact,
  scheduleLanes,
} from "@morpheus/core";
import { Context, Effect, Either, Schema as EffectSchema } from "effect";
import type {
  AgentReadyContract,
  AgentState,
  AgentStateTransitionPlan,
  DerivedIssueState,
  FailureKind,
  Lane,
  LaneCapacityConfig,
  LaneSchedule,
  ReviewFinding,
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

export class ProcessRunner extends Context.Tag(
  "@morpheus/runtime/ProcessRunner",
)<
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

export type PreparedReviewWorkspace = {
  readonly workspacePath: string;
  readonly worktreePath?: string;
  readonly branch?: string;
  readonly permissions: "read-only";
};

export class WorkspaceRuntimeError extends EffectSchema.TaggedError<WorkspaceRuntimeError>(
  "WorkspaceRuntimeError",
)("WorkspaceRuntimeError", {
  operation: EffectSchema.String,
  message: EffectSchema.String,
}) {}

export class WorkspaceRuntime extends Context.Tag(
  "@morpheus/runtime/WorkspaceRuntime",
)<
  WorkspaceRuntime,
  {
    readonly prepareImplementationWorkspace: (input: {
      readonly issueId: string;
      readonly runId: string;
    }) => Effect.Effect<PreparedImplementationWorkspace, WorkspaceRuntimeError>;
    readonly prepareReviewWorkspace: (input: {
      readonly issueId: string;
      readonly runId: string;
      readonly implementationRun: RunSummary;
    }) => Effect.Effect<PreparedReviewWorkspace, WorkspaceRuntimeError>;
  }
>() {}

export type WorkspaceRuntimeService = Context.Tag.Service<
  typeof WorkspaceRuntime
>;

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

export class MergeRequestClient extends Context.Tag(
  "@morpheus/runtime/MergeRequestClient",
)<
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

export type MergeRequestClientService = Context.Tag.Service<
  typeof MergeRequestClient
>;

export type GitLabIssueInput = {
  readonly project: string;
  readonly iid: number;
  readonly title: string;
  readonly description: string;
  readonly webUrl: string;
  readonly labels: readonly string[];
};

export type ListGitLabReadyIssuesInput = {
  readonly project: string;
  readonly readyLabel: string;
};

export class GitLabIssueSourceAccessError extends EffectSchema.TaggedError<GitLabIssueSourceAccessError>(
  "GitLabIssueSourceAccessError",
)("GitLabIssueSourceAccessError", {
  operation: EffectSchema.String,
  failureKind: EffectSchema.Literal("operator_access"),
  message: EffectSchema.String,
}) {}

export class GitLabIssueSourceCommandError extends EffectSchema.TaggedError<GitLabIssueSourceCommandError>(
  "GitLabIssueSourceCommandError",
)("GitLabIssueSourceCommandError", {
  operation: EffectSchema.String,
  command: EffectSchema.String,
  args: EffectSchema.Array(EffectSchema.String),
  exitCode: EffectSchema.Number,
  stderr: EffectSchema.String,
}) {}

export class GitLabIssueSourceParseError extends EffectSchema.TaggedError<GitLabIssueSourceParseError>(
  "GitLabIssueSourceParseError",
)("GitLabIssueSourceParseError", {
  operation: EffectSchema.String,
  command: EffectSchema.String,
  args: EffectSchema.Array(EffectSchema.String),
  message: EffectSchema.String,
}) {}

export class GitLabIssueSourceSchemaError extends EffectSchema.TaggedError<GitLabIssueSourceSchemaError>(
  "GitLabIssueSourceSchemaError",
)("GitLabIssueSourceSchemaError", {
  operation: EffectSchema.String,
  command: EffectSchema.String,
  args: EffectSchema.Array(EffectSchema.String),
  message: EffectSchema.String,
}) {}

export type GitLabIssueSourceError =
  | GitLabIssueSourceAccessError
  | GitLabIssueSourceCommandError
  | GitLabIssueSourceParseError
  | GitLabIssueSourceSchemaError;

export class GitLabIssueSource extends Context.Tag(
  "@morpheus/runtime/GitLabIssueSource",
)<
  GitLabIssueSource,
  {
    readonly listReadyIssues: (
      input: ListGitLabReadyIssuesInput,
    ) => Effect.Effect<readonly GitLabIssueInput[], GitLabIssueSourceError>;
  }
>() {}

export type GitLabIssueSourceService = Context.Tag.Service<
  typeof GitLabIssueSource
>;

export type TrackedIssue = {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly labels: readonly string[];
  readonly priority?: number;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly dependencyCount?: number;
  readonly dependentCount?: number;
  readonly dependencyIds?: readonly string[];
  readonly dependentIds?: readonly string[];
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
      readonly plan: Exclude<
        AgentStateTransitionPlan,
        { readonly status: "planned" }
      >;
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

export type ImportedGitLabIssueMetadata = {
  readonly project: string;
  readonly iid: number;
  readonly webUrl: string;
  readonly labels: readonly string[];
  readonly lastSyncedAt: string;
  readonly title: string;
  readonly description: string;
};

export type ImportedGitLabIssue = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly labels: readonly string[];
  readonly metadata: ImportedGitLabIssueMetadata;
};

export type UpsertImportedGitLabIssueInput = {
  readonly source: GitLabIssueInput;
  readonly syncedAt: string;
};

export type UpsertImportedGitLabIssueResult =
  | {
      readonly status: "created";
      readonly issueId: string;
      readonly addedReadyLabel: boolean;
    }
  | {
      readonly status: "updated";
      readonly issueId: string;
      readonly addedReadyLabel: boolean;
    }
  | {
      readonly status: "skipped";
      readonly issueId: string;
      readonly reason: "unchanged" | "duplicate_detected";
      readonly duplicateIssueIds?: readonly string[];
    };

type CreatedImportedGitLabIssueResult = Extract<
  UpsertImportedGitLabIssueResult,
  { readonly status: "created" }
>;
type UpdatedImportedGitLabIssueResult = Extract<
  UpsertImportedGitLabIssueResult,
  { readonly status: "updated" }
>;
type SkippedImportedGitLabIssueResult = Extract<
  UpsertImportedGitLabIssueResult,
  { readonly status: "skipped" }
>;

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
    readonly listImportedGitLabIssues: () => Effect.Effect<
      readonly ImportedGitLabIssue[],
      ProcessRunnerError | IssueTrackerCommandError | IssueTrackerJsonParseError
    >;
    readonly upsertImportedGitLabIssue: (
      input: UpsertImportedGitLabIssueInput,
    ) => Effect.Effect<UpsertImportedGitLabIssueResult, IssueTrackerError>;
  }
>() {}

export type IssueTrackerService = Context.Tag.Service<typeof IssueTracker>;

export type OperatorHealthStatus = "ok" | "warn" | "fail";

export type OperatorHealthCheck = {
  readonly name:
    | "beads"
    | "gitlab"
    | "docker"
    | "workspace"
    | "labels"
    | "daemon"
    | "containers"
    | "worktrees"
    | "ledger"
    | "config";
  readonly status: OperatorHealthStatus;
  readonly detail: string;
};

export class OperatorHealth extends Context.Tag(
  "@morpheus/runtime/OperatorHealth",
)<
  OperatorHealth,
  {
    readonly check: () => Effect.Effect<readonly OperatorHealthCheck[], never>;
  }
>() {}

export type OperatorHealthService = Context.Tag.Service<typeof OperatorHealth>;

export type ScheduleLaneWorkInput = {
  readonly capacities?: LaneCapacityConfig;
};

export type ScheduledLaneWorkCommand = {
  readonly lane: RunnableLane;
  readonly issueId: string;
};

export type DaemonTickPlan = {
  readonly schedule: LaneSchedule;
  readonly commands: Record<RunnableLane, readonly ScheduledLaneWorkCommand[]>;
  readonly reconciliation: {
    readonly excluded: LaneSchedule["excluded"];
  };
};

const commandsFromSchedule = (
  schedule: LaneSchedule,
): Record<RunnableLane, readonly ScheduledLaneWorkCommand[]> => ({
  preparation: schedule.selected.preparation.map((issue) => ({
    lane: "preparation",
    issueId: issue.id,
  })),
  implementation: schedule.selected.implementation.map((issue) => ({
    lane: "implementation",
    issueId: issue.id,
  })),
  review: schedule.selected.review.map((issue) => ({
    lane: "review",
    issueId: issue.id,
  })),
});

export const planDaemonTick = (schedule: LaneSchedule): DaemonTickPlan => ({
  schedule,
  commands: commandsFromSchedule(schedule),
  reconciliation: {
    excluded: schedule.excluded,
  },
});

export const scheduleLaneWork = (
  input: ScheduleLaneWorkInput = {},
): Effect.Effect<DaemonTickPlan, IssueTrackerError, IssueTracker> =>
  Effect.gen(function* () {
    const tracker = yield* IssueTracker;
    const issues = yield* tracker.listRunnableIssues();

    return planDaemonTick(scheduleLanes(issues, input.capacities));
  });

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

export type ImplementationEvidence = {
  readonly summary: string;
  readonly files: readonly string[];
};

export type VerificationEvidence = {
  readonly command: string;
  readonly status: "passed" | "failed";
  readonly output?: string;
};

export type ImplementationAgentInput = {
  readonly issue: TrackedIssue;
  readonly contract: AgentReadyContract;
  readonly workspace: PreparedImplementationWorkspace;
  readonly mergeRequest: MergeRequestReference;
};

export type ImplementationAgentResult =
  | {
      readonly status: "implemented";
      readonly implementationEvidence: readonly ImplementationEvidence[];
      readonly verificationEvidence: readonly VerificationEvidence[];
      readonly transcript: string;
      readonly artifact: unknown;
    }
  | {
      readonly status: "failed";
      readonly failureKind: FailureKind;
      readonly message: string;
      readonly implementationEvidence: readonly ImplementationEvidence[];
      readonly verificationEvidence: readonly VerificationEvidence[];
      readonly transcript: string;
      readonly artifact: unknown;
    };

export type ReviewAgentInput = {
  readonly issue: TrackedIssue;
  readonly contract: AgentReadyContract;
  readonly workspace: PreparedReviewWorkspace;
  readonly mergeRequest: MergeRequestReference;
  readonly implementationEvidence: readonly ImplementationEvidence[];
  readonly verificationEvidence: readonly VerificationEvidence[];
};

export type ReviewAgentResult =
  | {
      readonly status: "passed";
      readonly findings: readonly ReviewFinding[];
      readonly transcript: string;
      readonly artifact: unknown;
    }
  | {
      readonly status: "blocked";
      readonly reason: string;
      readonly findings: readonly ReviewFinding[];
      readonly transcript: string;
      readonly artifact: unknown;
    }
  | {
      readonly status: "failed";
      readonly failureKind: FailureKind;
      readonly message: string;
      readonly findings: readonly ReviewFinding[];
      readonly transcript: string;
      readonly artifact: unknown;
    };

export class AgentRunnerError extends EffectSchema.TaggedError<AgentRunnerError>(
  "AgentRunnerError",
)("AgentRunnerError", {
  operation: EffectSchema.String,
  failureKind: EffectSchema.optional(EffectSchema.Literal("operator_access", "runtime_error")),
  message: EffectSchema.String,
}) {}

export class AgentRunner extends Context.Tag("@morpheus/runtime/AgentRunner")<
  AgentRunner,
  {
    readonly checkAccess?: () => Effect.Effect<void, AgentRunnerError>;
    readonly prepareIssue: (
      input: PreparationAgentInput,
    ) => Effect.Effect<PreparationAgentResult, AgentRunnerError>;
    readonly implementIssue?: (
      input: ImplementationAgentInput,
    ) => Effect.Effect<unknown, AgentRunnerError>;
    readonly reviewIssue?: (
      input: ReviewAgentInput,
    ) => Effect.Effect<unknown, AgentRunnerError>;
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
  readonly prunedAt?: string;
  readonly prunedBy?: string;
  readonly pruneReason?: string;
  readonly eventsPrunedAt?: string;
  readonly artifactsPrunedAt?: string;
  readonly artifactBytesDeleted?: number;
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

export type CreateReviewRunInput = {
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

export type RunArtifact = {
  readonly runId: string;
  readonly artifactPath: string;
  readonly artifact: string;
};

export type RunPrunePolicy = {
  readonly completedIntermediate: {
    readonly keepDays: number;
    readonly keepLast: number;
  };
  readonly failed: "manual";
  readonly reviewCandidate: "until-mr-closed-or-manual";
  readonly active: "never";
};

export type RunPruneCandidate = {
  readonly runId: string;
  readonly issueId: string;
  readonly lane: RunnableLane;
  readonly status: RunStatus;
  readonly artifactPaths: readonly string[];
  readonly artifactBytes: number;
  readonly reason: string;
};

export type RunPruneInput = {
  readonly apply: boolean;
  readonly policy: RunPrunePolicy;
  readonly prunedBy: string;
  readonly reason: string;
};

export type RunPruneResult = {
  readonly applied: boolean;
  readonly eligibleRuns: readonly RunPruneCandidate[];
  readonly totalArtifactBytes: number;
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

export class RunLedgerArtifactNotFoundError extends EffectSchema.TaggedError<RunLedgerArtifactNotFoundError>(
  "RunLedgerArtifactNotFoundError",
)("RunLedgerArtifactNotFoundError", {
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
  | RunLedgerArtifactNotFoundError
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
    readonly createReviewRun: (
      input: CreateReviewRunInput,
    ) => Effect.Effect<RunSummary, RunLedgerPersistenceError>;
    readonly recordImplementationWorkspace: (
      runId: string,
      input: RecordImplementationWorkspaceInput,
    ) => Effect.Effect<
      RunSummary,
      | RunLedgerInvalidStateError
      | RunLedgerNotFoundError
      | RunLedgerPersistenceError
    >;
    readonly recordMergeRequest: (
      runId: string,
      input: RecordMergeRequestInput,
    ) => Effect.Effect<
      RunSummary,
      | RunLedgerInvalidStateError
      | RunLedgerNotFoundError
      | RunLedgerPersistenceError
    >;
    readonly finishRun: (
      runId: string,
      input: FinishRunInput,
    ) => Effect.Effect<
      RunSummary,
      | RunLedgerInvalidStateError
      | RunLedgerNotFoundError
      | RunLedgerPersistenceError
    >;
    readonly writeRunArtifacts: (
      runId: string,
      input: WriteRunArtifactsInput,
    ) => Effect.Effect<
      RunSummary,
      RunLedgerNotFoundError | RunLedgerPersistenceError
    >;
    readonly getRunLogs: (
      runId: string,
    ) => Effect.Effect<
      RunLogs,
      RunLedgerLogsNotFoundError | RunLedgerPersistenceError
    >;
    readonly getRunArtifact: (
      runId: string,
    ) => Effect.Effect<
      RunArtifact,
      RunLedgerArtifactNotFoundError | RunLedgerPersistenceError
    >;
    readonly listRuns: () => Effect.Effect<
      readonly RunSummary[],
      RunLedgerPersistenceError
    >;
    readonly getRun: (
      runId: string,
    ) => Effect.Effect<RunSummary | undefined, RunLedgerPersistenceError>;
    readonly getRunEvents: (
      runId: string,
    ) => Effect.Effect<readonly RunEvent[], RunLedgerPersistenceError>;
    readonly pruneRuns: (
      input: RunPruneInput,
    ) => Effect.Effect<RunPruneResult, RunLedgerPersistenceError>;
  }
>() {}

export type RunLedgerService = Context.Tag.Service<typeof RunLedger>;

export const renderRunList = (runs: readonly RunSummary[]): string => {
  if (runs.length === 0) {
    return "No Morpheus runs";
  }

  return runs
    .map(
      (run) =>
        `${run.id} ${run.issueId} ${run.lane} ${run.status} ${run.summary}`,
    )
    .join("\n");
};

export const renderRunDetail = (
  run: RunSummary,
  events: readonly RunEvent[],
): string =>
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
    `prunedAt: ${run.prunedAt ?? "None"}`,
    `prunedBy: ${run.prunedBy ?? "None"}`,
    `pruneReason: ${run.pruneReason ?? "None"}`,
    `eventsPrunedAt: ${run.eventsPrunedAt ?? "None"}`,
    `artifactsPrunedAt: ${run.artifactsPrunedAt ?? "None"}`,
    `artifactBytesDeleted: ${run.artifactBytesDeleted ?? 0}`,
    "events:",
    ...events.map(
      (event) =>
        `${event.sequence}. ${event.type}${event.message === undefined ? "" : ` - ${event.message}`}`,
    ),
  ].join("\n");

export const renderRunLogs = (logs: RunLogs): string => logs.transcript;

export const listRunsForCli: Effect.Effect<
  string,
  RunLedgerPersistenceError,
  RunLedger
> = Effect.gen(function* () {
  const ledger = yield* RunLedger;
  return renderRunList(yield* ledger.listRuns());
});

export const showRunForCli = (
  runId: string,
): Effect.Effect<
  string,
  RunLedgerNotFoundError | RunLedgerPersistenceError,
  RunLedger
> =>
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
): Effect.Effect<
  string,
  RunLedgerLogsNotFoundError | RunLedgerPersistenceError,
  RunLedger
> =>
  Effect.gen(function* () {
    const ledger = yield* RunLedger;
    return renderRunLogs(yield* ledger.getRunLogs(runId));
  });

export const renderRunPruneResult = (result: RunPruneResult): string => {
  const heading = result.applied
    ? "Morpheus prune apply"
    : "Morpheus prune dry-run";
  const lines =
    result.eligibleRuns.length === 0
      ? ["eligibleRuns: None"]
      : [
          "eligibleRuns:",
          ...result.eligibleRuns.flatMap((run) => [
            `- ${run.runId} ${run.issueId} ${run.lane} ${run.status} artifacts=${run.artifactPaths.length} bytes=${run.artifactBytes} reason=${run.reason}`,
            ...run.artifactPaths.map((path) => `  artifact: ${path}`),
          ]),
        ];

  return [
    heading,
    ...lines,
    `totalArtifactBytes: ${result.totalArtifactBytes}`,
  ].join("\n");
};

export const pruneRunsForCli = (
  input: RunPruneInput,
): Effect.Effect<string, RunLedgerPersistenceError, RunLedger> =>
  Effect.gen(function* () {
    const ledger = yield* RunLedger;
    return renderRunPruneResult(yield* ledger.pruneRuns(input));
  });

const laneCount = (
  issues: readonly TrackedIssue[],
  lane: RunnableLane,
): number => issues.filter((issue) => issue.lane === lane).length;

const stateCount = (
  issues: readonly TrackedIssue[],
  state: AgentState,
): number =>
  issues.filter(
    (issue) =>
      issue.derivedState.status === "active" &&
      issue.derivedState.state === state,
  ).length;

const runLine = (run: RunSummary): string =>
  `${run.id} ${run.issueId} ${run.lane} ${run.status} ${run.summary}`;

export type OperatorStatus = {
  readonly issues: readonly TrackedIssue[];
  readonly schedule: LaneSchedule;
  readonly runs: readonly RunSummary[];
};

export type OperatorSlice = {
  readonly issue: TrackedIssue;
  readonly runs: readonly RunSummary[];
  readonly events: Record<RunnableLane, readonly RunEvent[]>;
  readonly dependencyIds: readonly string[];
  readonly dependentIds: readonly string[];
};

export type OperatorDoctor = {
  readonly checks: readonly OperatorHealthCheck[];
};

export const renderOperatorStatus = ({
  issues,
  schedule,
  runs,
}: OperatorStatus): string => {
  const runningRuns = runs.filter((run) => run.status === "running");

  return [
    "Morpheus status",
    `lanes: preparation=${laneCount(issues, "preparation")} implementation=${laneCount(issues, "implementation")} review=${laneCount(issues, "review")}`,
    `runnable: preparation=${schedule.selected.preparation.length} implementation=${schedule.selected.implementation.length} review=${schedule.selected.review.length}`,
    `blocked=${stateCount(issues, "agent:blocked")} failed=${stateCount(issues, "agent:failed")}`,
    `conflicts=${schedule.excluded.filter((issue) => issue.reason === "state_conflict").length}`,
    "currentRuns:",
    ...(runningRuns.length === 0
      ? ["- None"]
      : runningRuns.map((run) => `- ${runLine(run)}`)),
  ].join("\n");
};

const runForLane = (
  runs: readonly RunSummary[],
  lane: RunnableLane,
): RunSummary | undefined => runs.find((run) => run.lane === lane);

const sliceRunLine = (
  lane: RunnableLane,
  run: RunSummary | undefined,
  events: readonly RunEvent[],
): string => {
  if (run === undefined) {
    return `${lane}: None`;
  }

  const tombstone = events.find((event) => event.type === "RunPruned");
  const suffix =
    tombstone === undefined ? "" : ` tombstone=${tombstone.occurredAt}`;

  return `${lane}: ${run.status} ${run.id}${suffix}`;
};

export const renderOperatorSlice = ({
  issue,
  runs,
  events,
  dependencyIds,
  dependentIds,
}: OperatorSlice): string => {
  const latestFailure = runs.find((run) => run.failureKind !== undefined);
  const latestMr = runs.find(
    (run) =>
      run.mergeRequestRef !== undefined || run.mergeRequestUrl !== undefined,
  );
  const latestRunsFirst = [...runs].reverse();
  const latestTranscript = latestRunsFirst.find(
    (run) => run.transcriptPath !== undefined,
  );
  const latestArtifact = latestRunsFirst.find(
    (run) => run.artifactPath !== undefined,
  );

  return [
    `Morpheus slice ${issue.id}`,
    `title: ${issue.title}`,
    `state: ${issue.derivedState.status === "active" ? issue.derivedState.state : issue.derivedState.status}`,
    `lane: ${issue.lane}`,
    `dependencies: ${dependencyIds.join(", ") || "None"}`,
    `dependents: ${dependentIds.join(", ") || "None"}`,
    sliceRunLine(
      "preparation",
      runForLane(runs, "preparation"),
      events.preparation,
    ),
    sliceRunLine(
      "implementation",
      runForLane(runs, "implementation"),
      events.implementation,
    ),
    sliceRunLine("review", runForLane(runs, "review"), events.review),
    `mergeRequest: ${latestMr?.mergeRequestRef ?? "None"}`,
    `mergeRequestUrl: ${latestMr?.mergeRequestUrl ?? "None"}`,
    `failure: ${latestFailure?.failureKind ?? "None"}`,
    `transcript: ${latestTranscript?.transcriptPath ?? "None"}`,
    `artifact: ${latestArtifact?.artifactPath ?? "None"}`,
  ].join("\n");
};

export const renderOperatorDoctor = ({ checks }: OperatorDoctor): string =>
  [
    "Morpheus doctor",
    ...checks.map(
      (check) => `${check.status.toUpperCase()} ${check.name}: ${check.detail}`,
    ),
  ].join("\n");

export const operatorStatus = (
  capacities: LaneCapacityConfig = {},
): Effect.Effect<
  OperatorStatus,
  IssueTrackerError | RunLedgerPersistenceError,
  IssueTracker | RunLedger
> =>
  Effect.gen(function* () {
    const tracker = yield* IssueTracker;
    const ledger = yield* RunLedger;
    const issues = yield* tracker.listRunnableIssues();
    const runs = yield* ledger.listRuns();

    return {
      issues,
      schedule: scheduleLanes(issues, capacities),
      runs,
    };
  });

export const operatorSlice = (
  issueId: string,
): Effect.Effect<
  OperatorSlice,
  IssueTrackerError | RunLedgerPersistenceError,
  IssueTracker | RunLedger
> =>
  Effect.gen(function* () {
    const tracker = yield* IssueTracker;
    const ledger = yield* RunLedger;
    const issue = yield* tracker.getIssue(issueId);
    const issues = yield* tracker.listRunnableIssues();
    const runs = (yield* ledger.listRuns()).filter(
      (run) => run.issueId === issueId,
    );
    const events: Record<RunnableLane, RunEvent[]> = {
      preparation: [],
      implementation: [],
      review: [],
    };

    for (const run of runs) {
      events[run.lane] = [
        ...events[run.lane],
        ...(yield* ledger.getRunEvents(run.id)),
      ];
    }

    return {
      issue,
      runs,
      events,
      dependencyIds: issue.dependencyIds ?? [],
      dependentIds: [
        ...(issue.dependentIds ?? []),
        ...issues
          .filter(
            (candidate) => candidate.dependencyIds?.includes(issueId) === true,
          )
          .map((candidate) => candidate.id),
      ].filter((id, index, ids) => ids.indexOf(id) === index),
    };
  });

export const operatorDoctor: Effect.Effect<
  OperatorDoctor,
  RunLedgerPersistenceError,
  RunLedger | OperatorHealth
> = Effect.gen(function* () {
  const ledger = yield* RunLedger;
  const health = yield* OperatorHealth;
  const checks = [...(yield* health.check())];

  const ledgerStatus = yield* Effect.either(ledger.listRuns());
  checks.push(
    Either.isRight(ledgerStatus)
      ? { name: "ledger", status: "ok", detail: "run ledger readable" }
      : { name: "ledger", status: "fail", detail: ledgerStatus.left.message },
  );

  return { checks };
});

export const operatorStatusForCli = (
  capacities: LaneCapacityConfig = {},
): Effect.Effect<
  string,
  IssueTrackerError | RunLedgerPersistenceError,
  IssueTracker | RunLedger
> => operatorStatus(capacities).pipe(Effect.map(renderOperatorStatus));

export const operatorSliceForCli = (
  issueId: string,
): Effect.Effect<
  string,
  IssueTrackerError | RunLedgerPersistenceError,
  IssueTracker | RunLedger
> => operatorSlice(issueId).pipe(Effect.map(renderOperatorSlice));

export const operatorDoctorForCli: Effect.Effect<
  string,
  RunLedgerPersistenceError,
  RunLedger | OperatorHealth
> = operatorDoctor.pipe(Effect.map(renderOperatorDoctor));

export type SyncGitLabIssuesInput = {
  readonly project: string;
  readonly readyLabel: string;
  readonly syncedAt?: string;
};

export type SyncGitLabIssueFailure = {
  readonly project: string;
  readonly iid?: number;
  readonly title?: string;
  readonly message: string;
};

export type SyncGitLabIssuesResult = {
  readonly created: readonly CreatedImportedGitLabIssueResult[];
  readonly updated: readonly UpdatedImportedGitLabIssueResult[];
  readonly skipped: readonly SkippedImportedGitLabIssueResult[];
  readonly failed: readonly SyncGitLabIssueFailure[];
};

const activeAgentLabels = new Set<string>(agentStates);

export const hasActiveAgentLifecycleLabel = (
  labels: readonly string[],
): boolean => labels.some((label) => activeAgentLabels.has(label));

const syncFailureFromError = (
  error: GitLabIssueSourceError | IssueTrackerError,
  project: string,
  source?: GitLabIssueInput,
): SyncGitLabIssueFailure => ({
  project: source?.project ?? project,
  iid: source?.iid,
  title: source?.title,
  message: errorMessage(error),
});

export const syncGitLabIssues = ({
  project,
  readyLabel,
  syncedAt = new Date().toISOString(),
}: SyncGitLabIssuesInput): Effect.Effect<
  SyncGitLabIssuesResult,
  never,
  GitLabIssueSource | IssueTracker
> =>
  Effect.gen(function* () {
    const source = yield* GitLabIssueSource;
    const tracker = yield* IssueTracker;
    const created: CreatedImportedGitLabIssueResult[] = [];
    const updated: UpdatedImportedGitLabIssueResult[] = [];
    const skipped: SkippedImportedGitLabIssueResult[] = [];
    const failed: SyncGitLabIssueFailure[] = [];

    const listed = yield* Effect.either(
      source.listReadyIssues({ project, readyLabel }),
    );

    if (Either.isLeft(listed)) {
      return {
        created,
        updated,
        skipped,
        failed: [syncFailureFromError(listed.left, project)],
      };
    }

    for (const issue of listed.right) {
      const result = yield* Effect.either(
        tracker.upsertImportedGitLabIssue({
          source: issue,
          syncedAt,
        }),
      );

      if (Either.isLeft(result)) {
        failed.push(syncFailureFromError(result.left, project, issue));
        continue;
      }

      switch (result.right.status) {
        case "created":
          created.push(result.right);
          break;
        case "updated":
          updated.push(result.right);
          break;
        case "skipped":
          skipped.push(result.right);
          break;
      }
    }

    return { created, updated, skipped, failed };
  });

export const renderSyncGitLabIssuesResult = (
  result: SyncGitLabIssuesResult,
): string =>
  [
    "Morpheus sync",
    `created=${result.created.length} updated=${result.updated.length} skipped=${result.skipped.length} failed=${result.failed.length}`,
    ...result.created.map((item) => `CREATED ${item.issueId}`),
    ...result.updated.map((item) => `UPDATED ${item.issueId}`),
    ...result.skipped.map((item) => {
      const duplicates =
        item.status === "skipped" &&
        item.reason === "duplicate_detected" &&
        item.duplicateIssueIds !== undefined
          ? ` duplicates=${item.duplicateIssueIds.join(",")}`
          : "";
      return `SKIPPED ${item.issueId} ${item.reason}${duplicates}`;
    }),
    ...result.failed.map(
      (item) =>
        `FAILED ${item.project}${item.iid === undefined ? "" : `#${item.iid}`}: ${item.message}`,
    ),
  ].join("\n");

export const syncGitLabIssuesForCli = (
  input: SyncGitLabIssuesInput,
): Effect.Effect<string, never, GitLabIssueSource | IssueTracker> =>
  syncGitLabIssues(input).pipe(Effect.map(renderSyncGitLabIssuesResult));

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
      readonly reason: Extract<
        IssueTrackerApplyResult,
        { readonly status: "rejected" }
      >["reason"];
      readonly failureKind: FailureKind;
    };

const artifactToString = (
  artifact: unknown,
): Effect.Effect<string, RunLedgerPersistenceError> =>
  Effect.try({
    try: () => JSON.stringify(artifact, null, 2),
    catch: (error) =>
      new RunLedgerPersistenceError({
        operation: "serializeRunArtifact",
        message: errorMessage(error),
      }),
  });

export type ImplementationAgentResultDecodeResult =
  | {
      readonly status: "valid";
      readonly result: ImplementationAgentResult;
    }
  | {
      readonly status: "invalid";
      readonly message: string;
    };

export type ReviewAgentResultDecodeResult =
  | {
      readonly status: "valid";
      readonly result: ReviewAgentResult;
    }
  | {
      readonly status: "invalid";
      readonly message: string;
    };

const ImplementationEvidenceSchema = Schema.Struct({
  summary: Schema.NonEmptyString,
  files: Schema.Array(Schema.String),
});

const VerificationEvidenceSchema = Schema.Struct({
  command: Schema.NonEmptyString,
  status: Schema.Literal("passed", "failed"),
  output: Schema.optional(Schema.String),
});

const ImplementationAgentResultSchema = Schema.Union(
  Schema.Struct({
    status: Schema.Literal("implemented"),
    implementationEvidence: Schema.NonEmptyArray(ImplementationEvidenceSchema),
    verificationEvidence: Schema.NonEmptyArray(VerificationEvidenceSchema),
    transcript: Schema.String,
    artifact: Schema.Unknown,
  }),
  Schema.Struct({
    status: Schema.Literal("failed"),
    failureKind: Schema.Literal(...failureKinds),
    message: Schema.NonEmptyString,
    implementationEvidence: Schema.NonEmptyArray(ImplementationEvidenceSchema),
    verificationEvidence: Schema.NonEmptyArray(VerificationEvidenceSchema),
    transcript: Schema.String,
    artifact: Schema.Unknown,
  }),
);

const ReviewFindingSchema = Schema.Struct({
  severity: Schema.Literal("info", "warning", "error"),
  summary: Schema.NonEmptyString,
});

const ReviewAgentResultSchema = Schema.Union(
  Schema.Struct({
    status: Schema.Literal("passed"),
    findings: Schema.Array(ReviewFindingSchema),
    transcript: Schema.String,
    artifact: Schema.Unknown,
  }),
  Schema.Struct({
    status: Schema.Literal("blocked"),
    reason: Schema.NonEmptyString,
    findings: Schema.Array(ReviewFindingSchema),
    transcript: Schema.String,
    artifact: Schema.Unknown,
  }),
  Schema.Struct({
    status: Schema.Literal("failed"),
    failureKind: Schema.Literal(...failureKinds),
    message: Schema.NonEmptyString,
    findings: Schema.Array(ReviewFindingSchema),
    transcript: Schema.String,
    artifact: Schema.Unknown,
  }),
);

export const decodeImplementationAgentResult = (
  value: unknown,
): ImplementationAgentResultDecodeResult => {
  const normalizedValue = normalizeImplementationAgentResult(value);

  try {
    return {
      status: "valid",
      result: Schema.decodeUnknownSync(ImplementationAgentResultSchema)(
        normalizedValue,
      ) as ImplementationAgentResult,
    };
  } catch (error) {
    return {
      status: "invalid",
      message: errorMessage(error),
    };
  }
};

const normalizeVerificationStatus = (
  status: unknown,
): "passed" | "failed" | undefined => {
  if (status === "passed" || status === "failed") {
    return status;
  }

  if (typeof status !== "string") {
    return undefined;
  }

  const normalized = status.trim().toLowerCase();
  if (normalized.startsWith("passed")) {
    return "passed";
  }

  return "failed";
};

const normalizeVerificationEvidence = (value: unknown): unknown => {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((item) => {
    if (!isRecord(item)) {
      return item;
    }

    const status = normalizeVerificationStatus(item.status);
    if (status === undefined) {
      return item;
    }

    return {
      ...item,
      status,
      output:
        typeof item.output === "string"
          ? item.output
          : typeof item.status === "string" && item.status !== status
            ? item.status
            : item.output,
    };
  });
};

const normalizeImplementationAgentResult = (value: unknown): unknown => {
  if (!isRecord(value)) {
    return value;
  }

  const status = value.status;
  if (status !== "implemented" && status !== "failed") {
    return value;
  }

  const verificationEvidence = normalizeVerificationEvidence(
    value.verificationEvidence,
  );

  if (status === "failed") {
    return {
      ...value,
      failureKind:
        typeof value.failureKind === "string"
          ? value.failureKind
          : "agent_contract_error",
      message:
        typeof value.message === "string" && value.message.trim().length > 0
          ? value.message
          : "Implementation agent returned failed status without required failureKind/message.",
      verificationEvidence,
    };
  }

  return {
    ...value,
    verificationEvidence,
  };
};

export const decodeReviewAgentResult = (
  value: unknown,
): ReviewAgentResultDecodeResult => {
  try {
    return {
      status: "valid",
      result: Schema.decodeUnknownSync(ReviewAgentResultSchema)(
        value,
      ) as ReviewAgentResult,
    };
  } catch (error) {
    return {
      status: "invalid",
      message: errorMessage(error),
    };
  }
};

const terminalPlanFromPreparing = (
  labels: readonly string[],
  event: "PreparationReady" | "PreparationBlocked" | "PreparationFailed",
): AgentStateTransitionPlan => planAgentStateTransition(labels, event);

const finishFailed = (
  ledger: RunLedgerService,
  runId: string,
  failureKind: FailureKind,
  message: string,
  terminalEvent:
    | "PreparationFailed"
    | "PreparationBlocked" = "PreparationFailed",
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
): Effect.Effect<
  Extract<PrepareIssueResult, { readonly status: "failed" }>,
  RunLedgerError
> =>
  Effect.gen(function* () {
    const message = `Preparation artifact write failed: ${errorMessage(writeError)}`;
    yield* Effect.either(
      applyTerminalTransition(tracker, issueId, "PreparationFailed"),
    );
    const terminalRun = yield* finishHandledFailure(
      ledger,
      runId,
      "runtime_error",
      message,
    );
    return failedPreparationResult(
      issueId,
      terminalRun,
      "runtime_error",
      message,
    );
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
      readonly result: Extract<
        PrepareIssueResult,
        { readonly status: "failed" }
      >;
    },
  RunLedgerError
> =>
  Effect.gen(function* () {
    const artifactResult = yield* Effect.either(
      artifactToString(input.artifact),
    );
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

  return terminalResult.right.status === "applied"
    ? appliedFailureKind
    : "state_conflict";
};

const terminalFailureMessage = (
  terminalResult: Either.Either<IssueTrackerApplyResult, IssueTrackerError>,
  successMessage: string,
  rejectedMessage: string,
): string => {
  if (Either.isLeft(terminalResult)) {
    return `${rejectedMessage}: ${errorMessage(terminalResult.left)}`;
  }

  return terminalResult.right.status === "applied"
    ? successMessage
    : rejectedMessage;
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

    const accessResult = yield* Effect.either(
      runner.checkAccess?.() ?? Effect.void,
    );
    if (Either.isLeft(accessResult)) {
      return {
        status: "failed",
        issueId,
        failureKind: accessResult.left.failureKind ?? "runtime_error",
        message: `Agent runner access check failed: ${accessResult.left.message}`,
      };
    }

    const issue = yield* tracker.getIssue(issueId);
    const startPlan = planAgentStateTransition(
      issue.labels,
      "StartPreparation",
    );
    if (startPlan.status !== "planned") {
      return {
        status: "state_rejected",
        issueId,
        reason: startPlan.status,
        failureKind:
          startPlan.status === "conflict" ? "state_conflict" : "runtime_error",
      };
    }

    const run = yield* ledger.createPreparationRun({
      issueId,
      summary: issue.title,
    });

    const startResult = yield* Effect.either(
      tracker.applyAgentState(issueId, startPlan),
    );
    if (Either.isLeft(startResult) || startResult.right.status === "rejected") {
      const failureKind = terminalFailureKind(startResult, "state_conflict");
      const message = terminalFailureMessage(
        startResult,
        "Preparation start rejected.",
        "Preparation start rejected.",
      );
      const terminalRun = yield* finishHandledFailure(
        ledger,
        run.id,
        failureKind,
        message,
      );

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
      const artifacts = yield* writeArtifactsOrFailRun(
        ledger,
        tracker,
        issueId,
        run.id,
        {
          transcript: message,
          artifact: {
            status: "failed",
            failureKind: "runtime_error",
            message,
          },
        },
      );
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
        terminalFailureMessage(
          terminal,
          message,
          "Preparation failed transition rejected",
        ),
      );

      return {
        status: "failed",
        issueId,
        run: terminalRun,
        failureKind:
          terminalRun.failureKind ??
          terminalFailureKind(terminal, "runtime_error"),
        message,
      };
    }

    const result = resultEither.right;

    if (result.status === "blocked") {
      const artifacts = yield* writeArtifactsOrFailRun(
        ledger,
        tracker,
        issueId,
        run.id,
        {
          transcript: result.transcript,
          artifact: result.artifact,
        },
      );
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
        terminalFailureMessage(
          terminal,
          message,
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

      return blockedPreparationResult(issueId, terminalRun, result.reason);
    }

    if (result.status === "failed") {
      const artifacts = yield* writeArtifactsOrFailRun(
        ledger,
        tracker,
        issueId,
        run.id,
        {
          transcript: result.transcript,
          artifact: result.artifact,
        },
      );
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
        terminalFailureMessage(
          terminal,
          result.message,
          "Preparation failed transition rejected",
        ),
      );

      return failedPreparationResult(
        issueId,
        terminalRun,
        terminalRun.failureKind ?? result.failureKind,
        result.message,
      );
    }

    const artifacts = yield* writeArtifactsOrFailRun(
      ledger,
      tracker,
      issueId,
      run.id,
      {
        transcript: result.transcript,
        artifact: result.artifact,
      },
    );
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
        terminalFailureMessage(
          terminal,
          message,
          "Preparation failed transition rejected",
        ),
      );

      return failedPreparationResult(
        issueId,
        terminalRun,
        terminalRun.failureKind ??
          terminalFailureKind(terminal, "agent_contract_error"),
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
    const readyPlan = terminalPlanFromPreparing(
      readyIssue.labels,
      "PreparationReady",
    );
    if (readyPlan.status !== "planned") {
      const message = "Preparation ready transition rejected.";
      const terminalRun = yield* finishHandledFailure(
        ledger,
        run.id,
        "state_conflict",
        message,
      );

      return failedPreparationResult(
        issueId,
        terminalRun,
        "state_conflict",
        message,
      );
    }

    const writeContractResult = yield* Effect.either(
      tracker.writeContract(issueId, afk.contract),
    );
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
        terminalRun.failureKind ??
          terminalFailureKind(terminal, "runtime_error"),
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
      readonly reason: Extract<
        IssueTrackerApplyResult,
        { readonly status: "rejected" }
      >["reason"];
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

const implementationEvidenceLines = (
  items: readonly ImplementationEvidence[],
): readonly string[] =>
  items.map((item) =>
    item.files.length === 0
      ? item.summary
      : `${item.summary} (${item.files.join(", ")})`,
  );

const verificationEvidenceLines = (
  items: readonly VerificationEvidence[],
): readonly string[] =>
  items.map((item) => {
    const suffix = item.output === undefined ? "" : ` - ${item.output}`;
    return `${item.status}: ${item.command}${suffix}`;
  });

const implementationArtifact = (
  result: ImplementationAgentResult,
  mergeRequest: MergeRequestReference,
) => ({
  status: result.status,
  implementationEvidence: result.implementationEvidence,
  verificationEvidence: result.verificationEvidence,
  mergeRequest,
  ...(result.status === "failed"
    ? {
        failureKind: result.failureKind,
        message: result.message,
      }
    : {}),
});

export const startImplementation = (
  issueId: string,
): Effect.Effect<
  StartImplementationResult,
  | IssueTrackerError
  | RunLedgerError
  | WorkspaceRuntimeError
  | MergeRequestClientError
  | AgentRunnerError,
  IssueTracker | RunLedger | WorkspaceRuntime | MergeRequestClient | AgentRunner
> =>
  Effect.gen(function* () {
    const tracker = yield* IssueTracker;
    const ledger = yield* RunLedger;
    const workspaceRuntime = yield* WorkspaceRuntime;
    const mergeRequests = yield* MergeRequestClient;
    const runner = yield* AgentRunner;

    const accessResult = yield* Effect.either(
      runner.checkAccess?.() ?? Effect.void,
    );
    if (Either.isLeft(accessResult)) {
      return {
        status: "failed",
        issueId,
        failureKind: accessResult.left.failureKind ?? "runtime_error",
        message: `Agent runner access check failed: ${accessResult.left.message}`,
      };
    }

    const issue = yield* tracker.getIssue(issueId);
    const startPlan = planAgentStateTransition(
      issue.labels,
      "StartImplementation",
    );
    if (startPlan.status !== "planned") {
      return {
        status: "state_rejected",
        issueId,
        reason: startPlan.status,
        failureKind:
          startPlan.status === "conflict" ? "state_conflict" : "runtime_error",
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
    const mrRunResult = yield* Effect.either(
      ledger.recordMergeRequest(run.id, mergeRequest),
    );
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

    const currentIssue = yield* tracker.getIssue(issueId);
    const currentStartPlan = planAgentStateTransition(
      currentIssue.labels,
      "StartImplementation",
    );
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

    const implementIssue = runner.implementIssue;
    if (implementIssue === undefined) {
      return yield* failImplementationStart(
        tracker,
        ledger,
        issueId,
        run.id,
        "runtime_error",
        "Agent runner does not support implementation.",
      );
    }

    const agentResult = yield* Effect.either(
      implementIssue({
        issue,
        contract,
        workspace,
        mergeRequest,
      }),
    );
    if (Either.isLeft(agentResult)) {
      return yield* failImplementationStart(
        tracker,
        ledger,
        issueId,
        run.id,
        "runtime_error",
        `Agent runner failed during implementation: ${agentResult.left.message}`,
      );
    }

    const decodedResult = decodeImplementationAgentResult(agentResult.right);
    if (decodedResult.status === "invalid") {
      return yield* failImplementationStart(
        tracker,
        ledger,
        issueId,
        run.id,
        "agent_contract_error",
        `Invalid implementation result: ${decodedResult.message}`,
      );
    }

    const implementationResult = decodedResult.result;
    const artifactResult = yield* Effect.either(
      artifactToString(
        implementationArtifact(implementationResult, mergeRequest),
      ),
    );
    if (Either.isLeft(artifactResult)) {
      return yield* failImplementationStart(
        tracker,
        ledger,
        issueId,
        run.id,
        "runtime_error",
        `Implementation artifact serialization failed: ${errorMessage(artifactResult.left)}`,
      );
    }

    const artifactRunResult = yield* Effect.either(
      ledger.writeRunArtifacts(run.id, {
        transcript: implementationResult.transcript,
        artifact: artifactResult.right,
      }),
    );
    if (Either.isLeft(artifactRunResult)) {
      return yield* failImplementationStart(
        tracker,
        ledger,
        issueId,
        run.id,
        "runtime_error",
        `Implementation artifact write failed: ${errorMessage(artifactRunResult.left)}`,
      );
    }

    const updateResult = yield* Effect.either(
      mergeRequests.updateDescription({
        reference: mergeRequest.reference,
        description: renderReviewArtifact({
          issueId: issue.id,
          contract,
          implementationEvidence: implementationEvidenceLines(
            implementationResult.implementationEvidence,
          ),
          verificationEvidence: verificationEvidenceLines(
            implementationResult.verificationEvidence,
          ),
          reviewVerdict: "pending",
          reviewFindings: [],
          humanChecklist: [
            "Review implementation evidence before marking ready.",
          ],
        }),
      }),
    );
    if (Either.isLeft(updateResult)) {
      return yield* failImplementationStart(
        tracker,
        ledger,
        issueId,
        run.id,
        updateResult.left.failureKind,
        `MR evidence update failed: ${updateResult.left.message}`,
      );
    }

    if (implementationResult.status === "failed") {
      return yield* failImplementationStart(
        tracker,
        ledger,
        issueId,
        run.id,
        implementationResult.failureKind,
        implementationResult.message,
      );
    }

    const failedVerification = implementationResult.verificationEvidence.find(
      (evidence) => evidence.status === "failed",
    );
    if (failedVerification !== undefined) {
      return yield* failImplementationStart(
        tracker,
        ledger,
        issueId,
        run.id,
        "verification_error",
        `Implementation verification failed: ${failedVerification.command}`,
      );
    }

    return {
      status: "started",
      issueId,
      run: artifactRunResult.right,
      workspace,
      mergeRequest,
    };
  });

export type ReviewIssueResult =
  | {
      readonly status: "review_candidate";
      readonly issueId: string;
      readonly run: RunSummary;
      readonly findings: readonly ReviewFinding[];
      readonly mergeRequest: MergeRequestReference;
    }
  | {
      readonly status: "blocked";
      readonly issueId: string;
      readonly run: RunSummary;
      readonly reason: string;
      readonly findings: readonly ReviewFinding[];
    }
  | {
      readonly status: "failed";
      readonly issueId: string;
      readonly run?: RunSummary;
      readonly failureKind: FailureKind;
      readonly message: string;
      readonly findings?: readonly ReviewFinding[];
    }
  | {
      readonly status: "state_rejected";
      readonly issueId: string;
      readonly reason: Extract<
        IssueTrackerApplyResult,
        { readonly status: "rejected" }
      >["reason"];
      readonly failureKind: FailureKind;
    };

type ImplementationArtifactForReview = {
  readonly implementationEvidence: readonly ImplementationEvidence[];
  readonly verificationEvidence: readonly VerificationEvidence[];
  readonly mergeRequest: MergeRequestReference;
};

const ImplementationArtifactForReviewSchema = Schema.Struct({
  implementationEvidence: Schema.NonEmptyArray(ImplementationEvidenceSchema),
  verificationEvidence: Schema.NonEmptyArray(VerificationEvidenceSchema),
  mergeRequest: Schema.Struct({
    reference: Schema.NonEmptyString,
    url: Schema.optional(Schema.String),
  }),
});

const decodeImplementationArtifactForReview = (
  value: unknown,
):
  | {
      readonly status: "valid";
      readonly artifact: ImplementationArtifactForReview;
    }
  | {
      readonly status: "invalid";
      readonly message: string;
    } => {
  try {
    return {
      status: "valid",
      artifact: Schema.decodeUnknownSync(ImplementationArtifactForReviewSchema)(
        value,
      ) as ImplementationArtifactForReview,
    };
  } catch (error) {
    return {
      status: "invalid",
      message: errorMessage(error),
    };
  }
};

const readImplementationArtifactForReview = (
  ledger: RunLedgerService,
  run: RunSummary,
): Effect.Effect<
  ImplementationArtifactForReview,
  RunLedgerArtifactNotFoundError | RunLedgerPersistenceError
> =>
  Effect.gen(function* () {
    const runArtifact = yield* ledger.getRunArtifact(run.id);
    const parsed = yield* Effect.try({
      try: () => JSON.parse(runArtifact.artifact) as unknown,
      catch: (error) =>
        new RunLedgerPersistenceError({
          operation: "decodeImplementationArtifactForReview",
          message: errorMessage(error),
        }),
    });
    const decoded = decodeImplementationArtifactForReview(parsed);
    if (decoded.status === "invalid") {
      return yield* new RunLedgerPersistenceError({
        operation: "readImplementationArtifactForReview",
        message: decoded.message,
      });
    }
    return decoded.artifact;
  });

const findImplementationRunForReview = (
  runs: readonly RunSummary[],
  issueId: string,
): RunSummary | undefined =>
  runs.find(
    (run) =>
      run.issueId === issueId &&
      run.lane === "implementation" &&
      run.mergeRequestRef !== undefined &&
      run.artifactPath !== undefined,
  );

const reviewArtifact = (
  result: ReviewAgentResult,
  mergeRequest: MergeRequestReference,
) => ({
  status: result.status,
  findings: result.findings,
  mergeRequest,
  ...(result.status === "blocked"
    ? {
        reason: result.reason,
      }
    : {}),
  ...(result.status === "failed"
    ? {
        failureKind: result.failureKind,
        message: result.message,
      }
    : {}),
});

const reviewFailureResult = (
  issueId: string,
  run: RunSummary,
  failureKind: FailureKind,
  message: string,
  findings?: readonly ReviewFinding[],
): Extract<ReviewIssueResult, { readonly status: "failed" }> => ({
  status: "failed",
  issueId,
  run,
  failureKind,
  message,
  findings,
});

const finishReview = (
  tracker: IssueTrackerService,
  ledger: RunLedgerService,
  issueId: string,
  runId: string,
  event: "ReviewPassed" | "ReviewBlocked" | "ReviewFailed",
  terminal: FinishRunInput,
): Effect.Effect<RunSummary, IssueTrackerError | RunLedgerError> =>
  Effect.gen(function* () {
    const currentIssue = yield* tracker.getIssue(issueId);
    const transition = planAgentStateTransition(currentIssue.labels, event);
    const transitionResult = yield* Effect.either(
      tracker.applyAgentState(issueId, transition),
    );
    if (
      Either.isLeft(transitionResult) ||
      transitionResult.right.status === "rejected"
    ) {
      return yield* ledger.finishRun(runId, {
        status: "failed",
        failureKind: terminalFailureKind(transitionResult, "state_conflict"),
        terminalEvent: "ReviewFailed",
        message: terminalFailureMessage(
          transitionResult,
          "Review terminal transition rejected.",
          "Review terminal transition rejected.",
        ),
      });
    }

    return yield* ledger.finishRun(runId, terminal);
  });

const failReviewAfterStart = (
  tracker: IssueTrackerService,
  ledger: RunLedgerService,
  issueId: string,
  runId: string,
  failureKind: FailureKind,
  message: string,
  findings?: readonly ReviewFinding[],
): Effect.Effect<
  Extract<ReviewIssueResult, { readonly status: "failed" }>,
  IssueTrackerError | RunLedgerError
> =>
  Effect.gen(function* () {
    const terminalRun = yield* finishReview(
      tracker,
      ledger,
      issueId,
      runId,
      "ReviewFailed",
      {
        status: "failed",
        failureKind,
        terminalEvent: "ReviewFailed",
        message,
      },
    );
    return reviewFailureResult(
      issueId,
      terminalRun,
      terminalRun.failureKind ?? failureKind,
      message,
      findings,
    );
  });

export const reviewIssue = (
  issueId: string,
): Effect.Effect<
  ReviewIssueResult,
  | IssueTrackerError
  | RunLedgerError
  | WorkspaceRuntimeError
  | AgentRunnerError
  | MergeRequestClientError,
  IssueTracker | RunLedger | WorkspaceRuntime | AgentRunner | MergeRequestClient
> =>
  Effect.gen(function* () {
    const tracker = yield* IssueTracker;
    const ledger = yield* RunLedger;
    const workspaceRuntime = yield* WorkspaceRuntime;
    const runner = yield* AgentRunner;
    const mergeRequests = yield* MergeRequestClient;

    const accessResult = yield* Effect.either(
      runner.checkAccess?.() ?? Effect.void,
    );
    if (Either.isLeft(accessResult)) {
      return {
        status: "failed",
        issueId,
        failureKind: accessResult.left.failureKind ?? "runtime_error",
        message: `Agent runner access check failed: ${accessResult.left.message}`,
      };
    }

    const issue = yield* tracker.getIssue(issueId);
    const startPlan = planAgentStateTransition(
      issue.labels,
      "ImplementationReadyForReview",
    );
    if (startPlan.status !== "planned") {
      return {
        status: "state_rejected",
        issueId,
        reason: startPlan.status,
        failureKind:
          startPlan.status === "conflict" ? "state_conflict" : "runtime_error",
      };
    }

    const startResult = yield* Effect.either(
      tracker.applyAgentState(issueId, startPlan),
    );
    if (Either.isLeft(startResult) || startResult.right.status === "rejected") {
      const failureKind = terminalFailureKind(startResult, "state_conflict");
      const message = terminalFailureMessage(
        startResult,
        "Review start transition rejected.",
        "Review start transition rejected.",
      );
      return {
        status: "failed",
        issueId,
        failureKind,
        message,
      };
    }

    const run = yield* ledger.createReviewRun({
      issueId,
      summary: issue.title,
    });

    const contractResult = yield* Effect.either(tracker.readContract(issueId));
    if (Either.isLeft(contractResult)) {
      return yield* failReviewAfterStart(
        tracker,
        ledger,
        issueId,
        run.id,
        "runtime_error",
        `Agent-Ready Contract read failed: ${errorMessage(contractResult.left)}`,
      );
    }
    if (contractResult.right.status === "missing") {
      return yield* failReviewAfterStart(
        tracker,
        ledger,
        issueId,
        run.id,
        "agent_contract_error",
        "Agent-Ready Contract metadata missing.",
      );
    }
    const contract = contractResult.right.contract;

    const implementationRun = findImplementationRunForReview(
      yield* ledger.listRuns(),
      issueId,
    );
    if (implementationRun === undefined) {
      return yield* failReviewAfterStart(
        tracker,
        ledger,
        issueId,
        run.id,
        "runtime_error",
        "Implementation run artifact missing for review.",
      );
    }

    const implementationArtifactResult = yield* Effect.either(
      readImplementationArtifactForReview(ledger, implementationRun),
    );
    if (Either.isLeft(implementationArtifactResult)) {
      return yield* failReviewAfterStart(
        tracker,
        ledger,
        issueId,
        run.id,
        "runtime_error",
        `Implementation artifact read failed: ${errorMessage(implementationArtifactResult.left)}`,
      );
    }
    const implementationArtifact = implementationArtifactResult.right;
    const mergeRequest = implementationArtifact.mergeRequest;
    const mergeRequestRunResult = yield* Effect.either(
      ledger.recordMergeRequest(run.id, mergeRequest),
    );
    if (Either.isLeft(mergeRequestRunResult)) {
      return yield* failReviewAfterStart(
        tracker,
        ledger,
        issueId,
        run.id,
        "runtime_error",
        `Review MR ledger update failed: ${errorMessage(mergeRequestRunResult.left)}`,
      );
    }

    const reviewIssueRunner = runner.reviewIssue;
    if (reviewIssueRunner === undefined) {
      return yield* failReviewAfterStart(
        tracker,
        ledger,
        issueId,
        run.id,
        "runtime_error",
        "Agent runner does not support review.",
      );
    }

    const reviewWorkspaceResult = yield* Effect.either(
      workspaceRuntime.prepareReviewWorkspace({
        issueId,
        runId: run.id,
        implementationRun,
      }),
    );
    if (Either.isLeft(reviewWorkspaceResult)) {
      return yield* failReviewAfterStart(
        tracker,
        ledger,
        issueId,
        run.id,
        "runtime_error",
        `Review workspace preparation failed: ${reviewWorkspaceResult.left.message}`,
      );
    }
    const reviewWorkspace = reviewWorkspaceResult.right;

    const agentResult = yield* Effect.either(
      reviewIssueRunner({
        issue,
        contract,
        workspace: reviewWorkspace,
        mergeRequest,
        implementationEvidence: implementationArtifact.implementationEvidence,
        verificationEvidence: implementationArtifact.verificationEvidence,
      }),
    );
    if (Either.isLeft(agentResult)) {
      return yield* failReviewAfterStart(
        tracker,
        ledger,
        issueId,
        run.id,
        "runtime_error",
        `Agent runner failed during review: ${agentResult.left.message}`,
      );
    }

    const decodedResult = decodeReviewAgentResult(agentResult.right);
    if (decodedResult.status === "invalid") {
      return yield* failReviewAfterStart(
        tracker,
        ledger,
        issueId,
        run.id,
        "agent_contract_error",
        `Invalid review result: ${decodedResult.message}`,
      );
    }

    const reviewResult = decodedResult.result;
    const artifactResult = yield* Effect.either(
      artifactToString(reviewArtifact(reviewResult, mergeRequest)),
    );
    if (Either.isLeft(artifactResult)) {
      return yield* failReviewAfterStart(
        tracker,
        ledger,
        issueId,
        run.id,
        "runtime_error",
        `Review artifact serialization failed: ${errorMessage(artifactResult.left)}`,
        reviewResult.findings,
      );
    }
    const artifactRunResult = yield* Effect.either(
      ledger.writeRunArtifacts(run.id, {
        transcript: reviewResult.transcript,
        artifact: artifactResult.right,
      }),
    );
    if (Either.isLeft(artifactRunResult)) {
      return yield* failReviewAfterStart(
        tracker,
        ledger,
        issueId,
        run.id,
        "runtime_error",
        `Review artifact write failed: ${errorMessage(artifactRunResult.left)}`,
        reviewResult.findings,
      );
    }

    const updateResult = yield* Effect.either(
      mergeRequests.updateDescription({
        reference: mergeRequest.reference,
        description: renderReviewArtifact({
          issueId: issue.id,
          contract,
          implementationEvidence: implementationEvidenceLines(
            implementationArtifact.implementationEvidence,
          ),
          verificationEvidence: verificationEvidenceLines(
            implementationArtifact.verificationEvidence,
          ),
          reviewVerdict: reviewResult.status,
          reviewFindings: reviewResult.findings,
          humanChecklist:
            reviewResult.status === "passed"
              ? ["Human reviewer owns final GitLab approval and merge."]
              : ["Resolve review outcome before human merge."],
        }),
      }),
    );
    if (Either.isLeft(updateResult)) {
      return yield* failReviewAfterStart(
        tracker,
        ledger,
        issueId,
        run.id,
        updateResult.left.failureKind,
        `MR review update failed: ${updateResult.left.message}`,
        reviewResult.findings,
      );
    }

    if (reviewResult.status === "blocked") {
      const terminalRun = yield* finishReview(
        tracker,
        ledger,
        issueId,
        run.id,
        "ReviewBlocked",
        {
          status: "failed",
          failureKind: "agent_contract_error",
          terminalEvent: "ReviewBlocked",
          message: `Review blocked: ${reviewResult.reason}`,
        },
      );
      return {
        status: "blocked",
        issueId,
        run: terminalRun,
        reason: reviewResult.reason,
        findings: reviewResult.findings,
      };
    }

    if (reviewResult.status === "failed") {
      return yield* failReviewAfterStart(
        tracker,
        ledger,
        issueId,
        run.id,
        reviewResult.failureKind,
        reviewResult.message,
        reviewResult.findings,
      );
    }

    const terminalRun = yield* finishReview(
      tracker,
      ledger,
      issueId,
      run.id,
      "ReviewPassed",
      {
        status: "succeeded",
        terminalEvent: "ReviewPassed",
        message: "Review passed.",
      },
    );

    return {
      status: "review_candidate",
      issueId,
      run: terminalRun,
      findings: reviewResult.findings,
      mergeRequest,
    };
  });

export type DaemonLaneExecution =
  | {
      readonly lane: "preparation";
      readonly issueId: string;
      readonly result: PrepareIssueResult;
    }
  | {
      readonly lane: "implementation";
      readonly issueId: string;
      readonly result: StartImplementationResult;
    }
  | {
      readonly lane: "review";
      readonly issueId: string;
      readonly result: ReviewIssueResult;
    }
  | {
      readonly lane: RunnableLane;
      readonly issueId: string;
      readonly result: {
        readonly status: "failed";
        readonly message: string;
      };
    };

export type RunDaemonOnceInput = SyncGitLabIssuesInput & {
  readonly capacities?: LaneCapacityConfig;
};

export type RunDaemonLoopInput = RunDaemonOnceInput & {
  readonly pollIntervalSeconds: number;
};

export type DaemonOnceResult = {
  readonly sync: SyncGitLabIssuesResult;
  readonly tick: DaemonTickPlan;
  readonly executions: readonly DaemonLaneExecution[];
};

type DaemonRunError =
  | IssueTrackerError
  | RunLedgerError
  | AgentRunnerError
  | WorkspaceRuntimeError
  | MergeRequestClientError;

const executeDaemonCommand = (
  command: ScheduledLaneWorkCommand,
): Effect.Effect<
  DaemonLaneExecution,
  never,
  IssueTracker | RunLedger | AgentRunner | WorkspaceRuntime | MergeRequestClient
> =>
  Effect.gen(function* () {
    const execution = yield* Effect.either(
      command.lane === "preparation"
        ? prepareIssue(command.issueId).pipe(
            Effect.map(
              (result): DaemonLaneExecution => ({
                lane: "preparation",
                issueId: command.issueId,
                result,
              }),
            ),
          )
        : command.lane === "implementation"
          ? startImplementation(command.issueId).pipe(
              Effect.map(
                (result): DaemonLaneExecution => ({
                  lane: "implementation",
                  issueId: command.issueId,
                  result,
                }),
              ),
            )
          : reviewIssue(command.issueId).pipe(
              Effect.map(
                (result): DaemonLaneExecution => ({
                  lane: "review",
                  issueId: command.issueId,
                  result,
                }),
              ),
            ),
    );

    if (Either.isRight(execution)) {
      return execution.right;
    }

    return {
      lane: command.lane,
      issueId: command.issueId,
      result: {
        status: "failed",
        message: errorMessage(execution.left),
      },
    };
  });

export const runDaemonOnce = (
  input: RunDaemonOnceInput,
): Effect.Effect<
  DaemonOnceResult,
  DaemonRunError,
  | IssueTracker
  | GitLabIssueSource
  | RunLedger
  | AgentRunner
  | WorkspaceRuntime
  | MergeRequestClient
> =>
  Effect.gen(function* () {
    const sync = yield* syncGitLabIssues(input);
    const tick = yield* scheduleLaneWork({ capacities: input.capacities });
    const [preparation, implementation, review] = yield* Effect.all(
      [
        Effect.all(tick.commands.preparation.map(executeDaemonCommand), {
          concurrency: "unbounded",
        }),
        Effect.all(tick.commands.implementation.map(executeDaemonCommand), {
          concurrency: "unbounded",
        }),
        Effect.all(tick.commands.review.map(executeDaemonCommand), {
          concurrency: "unbounded",
        }),
      ],
      { concurrency: "unbounded" },
    );

    return {
      sync,
      tick,
      executions: [...preparation, ...implementation, ...review],
    };
  });

const daemonResultLine = (execution: DaemonLaneExecution): string => {
  const status = execution.result.status;
  if (status === "failed") {
    const failureKind =
      "failureKind" in execution.result
        ? ` failureKind=${execution.result.failureKind}`
        : "";
    const message =
      "message" in execution.result ? ` ${execution.result.message}` : "";
    return `- ${execution.lane} ${execution.issueId}: failed${failureKind}${message}`;
  }

  if (status === "state_rejected") {
    return `- ${execution.lane} ${execution.issueId}: state_rejected reason=${execution.result.reason}`;
  }

  return `- ${execution.lane} ${execution.issueId}: ${status}`;
};

export const renderDaemonOnceResult = (result: DaemonOnceResult): string => {
  const noWork = result.executions.length === 0;

  return [
    "Morpheus daemon tick",
    `sync: created=${result.sync.created.length} updated=${result.sync.updated.length} skipped=${result.sync.skipped.length} failed=${result.sync.failed.length}`,
    `selected: preparation=${result.tick.commands.preparation.length} implementation=${result.tick.commands.implementation.length} review=${result.tick.commands.review.length}`,
    `excluded: ${result.tick.reconciliation.excluded.length}`,
    noWork ? "work: None" : "work:",
    ...result.executions.map(daemonResultLine),
  ].join("\n");
};

export const runDaemonOnceForCli = (
  input: RunDaemonOnceInput,
): Effect.Effect<
  string,
  DaemonRunError,
  | IssueTracker
  | GitLabIssueSource
  | RunLedger
  | AgentRunner
  | WorkspaceRuntime
  | MergeRequestClient
> => runDaemonOnce(input).pipe(Effect.map(renderDaemonOnceResult));

const sleepUntilNextDaemonTick = (
  seconds: number,
  signal: AbortSignal,
): Effect.Effect<void, never> =>
  Effect.promise(
    () =>
      new Promise<void>((resolveSleep) => {
        if (signal.aborted) {
          resolveSleep();
          return;
        }

        const timeout = setTimeout(resolveSleep, seconds * 1000);
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timeout);
            resolveSleep();
          },
          { once: true },
        );
      }),
  );

export const runDaemonLoopForCli = (
  input: RunDaemonLoopInput,
  writeOutput: (output: string) => Effect.Effect<void, never>,
): Effect.Effect<
  void,
  DaemonRunError,
  | IssueTracker
  | GitLabIssueSource
  | RunLedger
  | AgentRunner
  | WorkspaceRuntime
  | MergeRequestClient
> =>
  Effect.gen(function* () {
    const controller = new AbortController();
    const stop = () => controller.abort();
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);

    try {
      while (!controller.signal.aborted) {
        const output = yield* runDaemonOnceForCli(input);
        yield* writeOutput(output);

        if (!controller.signal.aborted) {
          yield* sleepUntilNextDaemonTick(
            input.pollIntervalSeconds,
            controller.signal,
          );
        }
      }
    } finally {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
    }

    yield* writeOutput("Morpheus daemon stopped");
  });

export const renderPrepareIssueResult = (
  result: PrepareIssueResult,
): string => {
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

export const renderStartImplementationResult = (
  result: StartImplementationResult,
): string => {
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

export const renderReviewIssueResult = (result: ReviewIssueResult): string => {
  if (result.status === "review_candidate") {
    return [
      `Review candidate ${result.issueId}`,
      `run: ${result.run.id}`,
      `mergeRequest: ${result.mergeRequest.reference}`,
      `findings: ${result.findings.length}`,
    ].join("\n");
  }

  if (result.status === "blocked") {
    return [
      `Blocked ${result.issueId}`,
      `run: ${result.run.id}`,
      `reason: ${result.reason}`,
      `findings: ${result.findings.length}`,
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
    `findings: ${result.findings?.length ?? 0}`,
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
  | IssueTrackerError
  | RunLedgerError
  | WorkspaceRuntimeError
  | MergeRequestClientError
  | AgentRunnerError,
  IssueTracker | RunLedger | WorkspaceRuntime | MergeRequestClient | AgentRunner
> =>
  startImplementation(issueId).pipe(
    Effect.map(renderStartImplementationResult),
  );

export const reviewIssueForCli = (
  issueId: string,
): Effect.Effect<
  string,
  | IssueTrackerError
  | RunLedgerError
  | WorkspaceRuntimeError
  | AgentRunnerError
  | MergeRequestClientError,
  IssueTracker | RunLedger | WorkspaceRuntime | MergeRequestClient | AgentRunner
> => reviewIssue(issueId).pipe(Effect.map(renderReviewIssueResult));

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const withFallback = (
  value: Record<string, unknown>,
  canonicalKey: string,
  fallbackKey: string,
): unknown => value[canonicalKey] ?? value[fallbackKey];

const normalizeAgentReadyContract = (value: unknown): unknown => {
  if (!isRecord(value)) {
    return value;
  }

  return {
    ...value,
    currentBehavior: withFallback(value, "currentBehavior", "current_behavior"),
    desiredBehavior: withFallback(value, "desiredBehavior", "desired_behavior"),
    keyInterfaces: withFallback(value, "keyInterfaces", "key_interfaces"),
    acceptanceCriteria: withFallback(
      value,
      "acceptanceCriteria",
      "acceptance_criteria",
    ),
    outOfScope: withFallback(value, "outOfScope", "out_of_scope"),
    verificationPlan: withFallback(
      value,
      "verificationPlan",
      "verification_plan",
    ),
    blockedBy: withFallback(value, "blockedBy", "blocked_by"),
    hitlDecisions: withFallback(value, "hitlDecisions", "hitl_decisions"),
    riskLevel: withFallback(value, "riskLevel", "risk_level"),
  };
};

export const decodeAgentReadyContract = (
  value: unknown,
): AgentReadyContractDecodeResult => {
  try {
    return {
      status: "valid",
      contract: Schema.decodeUnknownSync(AgentReadyContractSchema)(
        normalizeAgentReadyContract(value),
      ) as AgentReadyContract,
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
  const emptyTextEntry = requiredTextEntries.find(
    ([, value]) => value.trim().length === 0,
  );
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
    ([, values]) =>
      values.length === 0 || values.some((value) => value.trim().length === 0),
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

const LaneConcurrencySchema = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
);
const PositiveIntegerSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
);

const ContainerMountSchema = Schema.Struct({
  hostPath: Schema.String,
  containerPath: Schema.String,
  readOnly: Schema.optional(Schema.Boolean),
});

const SkillMappingSchema = Schema.Struct({
  name: Schema.String,
  path: Schema.String,
});

export const MorpheusConfigSchema = Schema.Struct({
  targetRepo: Schema.String,
  issueTracker: Schema.Struct({
    kind: Schema.Literal("beads"),
  }),
  gitlab: Schema.Struct({
    project: Schema.String,
    readyLabel: Schema.String,
    targetBranch: Schema.String,
  }),
  daemon: Schema.Struct({
    pollIntervalSeconds: PositiveIntegerSchema,
  }),
  mergeRequests: Schema.Struct({
    kind: Schema.Literal("gitlab-glab"),
  }),
  agentRunner: Schema.Struct({
    kind: Schema.Literal("container"),
    agent: Schema.Struct({
      provider: Schema.Literal("codex"),
      model: Schema.String,
      effort: Schema.Literal("low", "medium", "high", "xhigh"),
    }),
    auth: Schema.Struct({
      envFile: Schema.String,
      requiredKeys: Schema.Array(Schema.NonEmptyString),
    }),
    container: Schema.Struct({
      image: Schema.String,
      profile: Schema.String,
      mounts: Schema.Array(ContainerMountSchema),
      setupHooks: Schema.Array(Schema.String),
    }),
    skills: Schema.Struct({
      mappings: Schema.Array(SkillMappingSchema),
    }),
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

export type InitMorpheusRepoOptions = {
  readonly target: string;
  readonly gitlabProject: string;
  readonly gitlabReadyLabel?: string;
  readonly targetBranch?: string;
  readonly force?: boolean;
};

export type InitMorpheusRepoResult =
  | {
      readonly status: "initialized";
      readonly target: string;
      readonly configPath: string;
      readonly created: readonly string[];
      readonly updated: readonly string[];
    }
  | {
      readonly status: "error";
      readonly error:
        | {
            readonly kind: "existing_files";
            readonly paths: readonly string[];
          }
        | ConfigLoadError;
    };

const configPathFromOptions = (options: ConfigLoadOptions): string => {
  if (options.configPath !== undefined) {
    return resolve(options.configPath);
  }

  return resolve(options.targetRepo ?? process.cwd(), "morpheus.config.json");
};

export const loadMorpheusConfig = (
  options: ConfigLoadOptions = {},
): ConfigLoadResult => {
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

const defaultPromptPaths = {
  prepare: ".morpheus/prompts/prepare.md",
  implement: ".morpheus/prompts/implement.md",
  review: ".morpheus/prompts/review.md",
} as const;

const makeInitialConfig = (
  options: InitMorpheusRepoOptions,
): MorpheusConfig => ({
  targetRepo: ".",
  issueTracker: { kind: "beads" },
  gitlab: {
    project: options.gitlabProject,
    readyLabel: options.gitlabReadyLabel ?? "agent:ready",
    targetBranch: options.targetBranch ?? "main",
  },
  daemon: { pollIntervalSeconds: 30 },
  mergeRequests: { kind: "gitlab-glab" },
  agentRunner: {
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
  },
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
  prompts: defaultPromptPaths,
});

export const defaultAgentSkillInstructions = [
  "## Default Morpheus Agent Skills",
  "",
  "These instructions are bundled by Morpheus. Do not depend on user-local skill paths.",
  "",
  "### Caveman",
  "",
  "Respond terse. Drop filler. Keep technical accuracy. Use fragments when clear. Code and exact errors stay unchanged.",
  "",
  "### Nick Suomi Flow",
  "",
  "No code before durable intent, issue context, decisions, task contract, failing test when practical, and verification evidence.",
  "Use Beads as default tracker. Read repo guidance first. Do not create markdown TODO trackers.",
  "Pipeline: restate intent, PRD/spec, grill ambiguity, slice issues, align architecture/docs, define task contract, TDD/red-green-refactor, verify before done.",
  "Per issue: claim/show issue, ensure contract, implement only contract, run verification, update evidence.",
  "",
  "### PRD/Spec",
  "",
  "Capture problem, goals, non-goals, behavior, acceptance criteria, risks, and verification before implementation.",
  "",
  "### Grill",
  "",
  "If intent, acceptance, ownership, or risk is unclear, return blocked with concrete questions instead of inventing requirements.",
  "",
  "### Issue Slicing",
  "",
  "Work must be independently grabbable. Use dependencies for ordering. Keep scope small and observable.",
  "",
  "### Architecture",
  "",
  "Read docs and ADRs. Prefer existing architecture. If change contradicts an ADR, surface that explicitly.",
  "",
  "### TDD",
  "",
  "Prefer observed failing test before production code. Keep tests focused on behavior and public interfaces.",
  "",
  "### Verification Before Completion",
  "",
  "Completion requires exact verification commands and results. If verification is blocked, report blocker as failed evidence with cause and next action.",
].join("\n");

const starterPrompts = {
  prepare: [
    "# Morpheus Prepare Prompt",
    "",
    defaultAgentSkillInstructions,
    "",
    "Read the issue, repo guidance, and relevant code before answering.",
    "Produce an Agent-Ready Contract with current behavior, desired behavior, key interfaces, acceptance criteria, out of scope, verification plan, blockers, HITL decisions, and risk level.",
    "If intent is unclear, return a blocked result instead of inventing requirements.",
    "",
  ].join("\n"),
  implement: [
    "# Morpheus Implement Prompt",
    "",
    defaultAgentSkillInstructions,
    "",
    "Implement the prepared contract only.",
    "Keep changes scoped, preserve user work, and follow repo guidance.",
    "Run the configured verification commands or explain why they could not run.",
    "Return concise evidence: changed behavior, files touched, verification, and remaining risk.",
    "",
  ].join("\n"),
  review: [
    "# Morpheus Review Prompt",
    "",
    defaultAgentSkillInstructions,
    "",
    "Review the implementation against the Agent-Ready Contract.",
    "Stay read-only. Report correctness bugs, regressions, missing verification, and risk.",
    "Return a verdict with actionable findings and verification evidence.",
    "",
  ].join("\n"),
} as const;

const gitignoreEntries = [
  ".morpheus/ledger.sqlite*",
  ".morpheus/runs/",
  ".morpheus/agent-logs/",
  ".morpheus/cache/",
  ".morpheus/secrets/agent.env",
] as const;

const agentEnvExample = [
  "# Copy to .morpheus/secrets/agent.env and fill with a real token.",
  "# Morpheus requires this explicit file for agent runs.",
  "OPENAI_API_KEY=",
  "",
].join("\n");

const containerDockerfileTemplate = [
  "# Morpheus container profile",
  "# Edit this Dockerfile to add target-repository toolchains needed by agents.",
  "FROM node:22-bookworm-slim",
  "",
  "WORKDIR /workspace",
  "",
  "RUN corepack enable",
  "",
].join("\n");

const containerReadmeTemplate = [
  "# Morpheus container profile",
  "",
  "This directory is the editable Morpheus container runtime surface for this target repository.",
  "Morpheus uses Docker-compatible runtime semantics, so Docker Desktop, OrbStack, Colima, or a remote Docker context may provide the runtime.",
  "",
  "Build the default image before running container-backed agents:",
  "",
  "```bash",
  "docker build -f .morpheus/container/Dockerfile -t morpheus-agent:local .",
  "```",
  "",
  "The generated `morpheus.config.json` points `agentRunner.container.profile` at `.morpheus/container/Dockerfile` and `agentRunner.container.image` at `morpheus-agent:local`.",
  "Keep this profile tracked. Local runtime data, logs, cache, ledger files, and secrets are ignored by the generated `.gitignore` entries.",
  "",
].join("\n");

export const initMorpheusRepo = (
  options: InitMorpheusRepoOptions,
): InitMorpheusRepoResult => {
  const target = resolve(options.target);
  const configPath = join(target, "morpheus.config.json");
  const containerDockerfilePath = join(target, ".morpheus", "container", "Dockerfile");
  const containerReadmePath = join(target, ".morpheus", "container", "README.md");
  const agentEnvExamplePath = join(target, ".morpheus", "secrets", "agent.env.example");
  const promptPaths = [
    join(target, defaultPromptPaths.prepare),
    join(target, defaultPromptPaths.implement),
    join(target, defaultPromptPaths.review),
  ];
  const managedPaths = [
    configPath,
    containerDockerfilePath,
    containerReadmePath,
    agentEnvExamplePath,
    ...promptPaths,
  ];
  const existingPaths =
    options.force === true
      ? []
      : managedPaths.filter((path) => existsSync(path));

  if (existingPaths.length > 0) {
    return {
      status: "error",
      error: {
        kind: "existing_files",
        paths: existingPaths,
      },
    };
  }

  const config = makeInitialConfig(options);
  const decodedConfig = Schema.decodeUnknownSync(MorpheusConfigSchema)(config);
  const created: string[] = [];
  const updated: string[] = [];

  mkdirSync(join(target, ".morpheus", "prompts"), { recursive: true });
  mkdirSync(join(target, ".morpheus", "secrets"), { recursive: true });
  mkdirSync(join(target, ".morpheus", "container"), { recursive: true });

  for (const [path, contents] of [
    [configPath, `${JSON.stringify(decodedConfig, null, 2)}\n`],
    [containerDockerfilePath, containerDockerfileTemplate],
    [containerReadmePath, containerReadmeTemplate],
    [agentEnvExamplePath, agentEnvExample],
    [promptPaths[0], starterPrompts.prepare],
    [promptPaths[1], starterPrompts.implement],
    [promptPaths[2], starterPrompts.review],
  ] as const) {
    const existed = existsSync(path);
    writeFileSync(path, contents);
    (existed ? updated : created).push(path);
  }

  const gitignorePath = join(target, ".gitignore");
  const gitignoreExisted = existsSync(gitignorePath);
  const gitignore = gitignoreExisted ? readFileSync(gitignorePath, "utf8") : "";
  const lines = gitignore.split(/\r?\n/).filter((line) => line.length > 0);
  const missingEntries = gitignoreEntries.filter(
    (entry) => !lines.includes(entry),
  );

  if (missingEntries.length > 0) {
    const prefix =
      gitignore.length > 0 && !gitignore.endsWith("\n") ? "\n" : "";
    writeFileSync(
      gitignorePath,
      `${gitignore}${prefix}${missingEntries.join("\n")}\n`,
    );
    (gitignoreExisted ? updated : created).push(gitignorePath);
  }

  const validation = loadMorpheusConfig({ configPath });
  if (validation.status === "error") {
    return {
      status: "error",
      error: validation.error,
    };
  }

  return {
    status: "initialized",
    target,
    configPath,
    created,
    updated,
  };
};
