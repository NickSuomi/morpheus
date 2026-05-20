import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { codex, run as sandcastleRun } from "@ai-hero/sandcastle";
import type { AgentProvider, RunOptions, RunResult } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import type { SandboxProvider } from "@ai-hero/sandcastle";
import { agentStates, deriveIssueState, deriveLane, planAgentStateTransition } from "@morpheus/core";
import type { AgentStateTransitionPlan } from "@morpheus/core";
import {
  AgentRunner,
  AgentRunnerError,
  decodeAgentReadyContract,
  GitLabIssueSource,
  GitLabIssueSourceAccessError,
  GitLabIssueSourceCommandError,
  GitLabIssueSourceParseError,
  GitLabIssueSourceSchemaError,
  IssueTracker,
  IssueTrackerCommandError,
  IssueTrackerContractSchemaError,
  IssueTrackerJsonParseError,
  IssueTrackerMalformedMetadataError,
  MergeRequestClient,
  MergeRequestClientError,
  OperatorHealth,
  ProcessRunner,
  ProcessRunnerError,
  WorkspaceRuntime,
  WorkspaceRuntimeError,
} from "@morpheus/runtime";
import type {
  AgentReadyContract,
  AgentRunnerService,
  GitLabIssueInput,
  GitLabIssueSourceService,
  ImportedGitLabIssue,
  ImportedGitLabIssueMetadata,
  PreparationAgentResult,
  ImplementationAgentInput,
  MergeRequestClientService,
  ProcessResult,
  ProcessRunnerService,
  ReviewAgentInput,
  ImplementationAgentResult,
  ReviewAgentResult,
  TrackedIssue,
  IssueTrackerService,
  OperatorHealthCheck,
  OperatorHealthService,
  WorkspaceRuntimeService,
} from "@morpheus/runtime";
import { Effect, Layer } from "effect";
export { createSqliteRunLedger, sqliteRunLedgerLayer } from "./sqlite-ledger/index.js";
export type { SqliteRunLedgerOptions } from "./sqlite-ledger/index.js";

export interface AdapterInfo {
  readonly name: "MorpheusAdapters";
}

export const adapterInfo: AdapterInfo = {
  name: "MorpheusAdapters",
};

type NodeProcessRunnerOptions = {
  readonly cwd: string;
};

type BeadsIssueTrackerOptions = {
  readonly processRunner: ProcessRunnerService;
};

type GitWorkspaceRuntimeOptions = {
  readonly processRunner: ProcessRunnerService;
};

type GlabMergeRequestClientOptions = {
  readonly processRunner: ProcessRunnerService;
};

type GlabIssueSourceOptions = {
  readonly processRunner: ProcessRunnerService;
};

type GitLabIssueJson = {
  readonly iid?: unknown;
  readonly title?: unknown;
  readonly description?: unknown;
  readonly body?: unknown;
  readonly web_url?: unknown;
  readonly webUrl?: unknown;
  readonly labels?: unknown;
};

type BeadsIssueJson = {
  readonly id?: unknown;
  readonly title?: unknown;
  readonly labels?: unknown;
  readonly priority?: unknown;
  readonly created_at?: unknown;
  readonly updated_at?: unknown;
  readonly dependency_count?: unknown;
  readonly dependent_count?: unknown;
  readonly dependencies?: unknown;
  readonly metadata?: unknown;
  readonly description?: unknown;
};

export {
  IssueTrackerCommandError as BeadsCommandError,
  IssueTrackerJsonParseError as BeadsJsonParseError,
  MergeRequestClientError as GlabMergeRequestClientError,
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const runBdEffect = (
  processRunner: ProcessRunnerService,
  args: readonly string[],
): Effect.Effect<ProcessResult, ProcessRunnerError | IssueTrackerCommandError> =>
  processRunner.run("bd", args).pipe(
    Effect.flatMap((result) => {
      if (result.exitCode !== 0) {
        return Effect.fail(
          new IssueTrackerCommandError({
            operation: "bd",
            command: "bd",
            args: [...args],
            exitCode: result.exitCode,
            stderr: result.stderr,
          }),
        );
      }

      return Effect.succeed(result);
    }),
  );

const runGitEffect = (
  processRunner: ProcessRunnerService,
  args: readonly string[],
): Effect.Effect<ProcessResult, WorkspaceRuntimeError> =>
  processRunner.run("git", args).pipe(
    Effect.mapError(
      (error) =>
        new WorkspaceRuntimeError({
          operation: "git",
          message: error.message,
        }),
    ),
    Effect.flatMap((result) => {
      if (result.exitCode !== 0) {
        return Effect.fail(
          new WorkspaceRuntimeError({
            operation: "git",
            message: result.stderr,
          }),
        );
      }

      return Effect.succeed(result);
    }),
  );

const operatorAccessPatterns = [
  "authentication",
  "authenticate",
  "unauthorized",
  "forbidden",
  "permission",
  "access denied",
  "not logged in",
  "login required",
] as const;

const classifyGlabFailureKind = (stderr: string): "operator_access" | "runtime_error" => {
  const normalized = stderr.toLowerCase();
  return operatorAccessPatterns.some((pattern) => normalized.includes(pattern))
    ? "operator_access"
    : "runtime_error";
};

const runGlabEffect = (
  processRunner: ProcessRunnerService,
  operation: string,
  args: readonly string[],
): Effect.Effect<ProcessResult, MergeRequestClientError> =>
  processRunner.run("glab", args).pipe(
    Effect.mapError(
      (error) =>
        new MergeRequestClientError({
          operation,
          failureKind: "runtime_error",
          message: error.message,
        }),
    ),
    Effect.flatMap((result) => {
      if (result.exitCode !== 0) {
        return Effect.fail(
          new MergeRequestClientError({
            operation,
            failureKind: classifyGlabFailureKind(result.stderr),
            message: result.stderr,
          }),
        );
      }

      return Effect.succeed(result);
    }),
  );

const runGlabIssueSourceEffect = (
  processRunner: ProcessRunnerService,
  operation: string,
  args: readonly string[],
): Effect.Effect<ProcessResult, GitLabIssueSourceAccessError | GitLabIssueSourceCommandError> =>
  Effect.gen(function* () {
    const result = yield* processRunner.run("glab", args).pipe(
      Effect.mapError(
        (error) =>
          new GitLabIssueSourceCommandError({
            operation,
            command: error.command,
            args: [...error.args],
            exitCode: 1,
            stderr: error.message,
          }),
      ),
    );

    if (result.exitCode === 0) {
      return result;
    }

    if (classifyGlabFailureKind(result.stderr) === "operator_access") {
      return yield* new GitLabIssueSourceAccessError({
        operation,
        failureKind: "operator_access",
        message: result.stderr,
      });
    }

    return yield* new GitLabIssueSourceCommandError({
      operation,
      command: "glab",
      args: [...args],
      exitCode: result.exitCode,
      stderr: result.stderr,
    });
  });

const parseJsonArray = (
  stdout: string,
  command: string,
  args: readonly string[],
): Effect.Effect<readonly unknown[], IssueTrackerJsonParseError> =>
  Effect.try({
    try: () => JSON.parse(stdout) as unknown,
    catch: (error) =>
      new IssueTrackerJsonParseError({
        operation: "parse_json",
        command,
        args: [...args],
        message: errorMessage(error),
      }),
  }).pipe(
    Effect.flatMap((parsed) =>
      Array.isArray(parsed)
        ? Effect.succeed(parsed)
        : Effect.fail(
            new IssueTrackerJsonParseError({
              operation: "parse_json",
              command,
              args: [...args],
              message: "Expected JSON array",
            }),
          ),
    ),
  );

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const optionalNumber = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const optionalString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const requiredString = (value: unknown, field: string): string => {
  if (typeof value !== "string") {
    throw new Error(`Expected issue ${field} to be a string`);
  }

  return value;
};

const labelsFromIssue = (value: unknown): readonly string[] => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("Expected issue labels to be an array");
  }

  if (!value.every((label): label is string => typeof label === "string")) {
    throw new Error("Expected issue labels to contain only strings");
  }

  return value;
};

const labelsFromGitLabIssue = (value: unknown): readonly string[] => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("Expected GitLab issue labels to be an array");
  }

  return value.map((label) => {
    if (typeof label === "string") {
      return label;
    }

    if (isRecord(label) && typeof label.name === "string") {
      return label.name;
    }

    throw new Error("Expected GitLab issue labels to contain strings or objects with name");
  });
};

const requiredNumber = (value: unknown, field: string): number => {
  if (typeof value !== "number") {
    throw new Error(`Expected GitLab issue ${field} to be a number`);
  }

  return value;
};

const gitLabIssueFromJson = (project: string, issue: GitLabIssueJson): GitLabIssueInput => ({
  project,
  iid: requiredNumber(issue.iid, "iid"),
  title: requiredString(issue.title, "title"),
  description: requiredString(issue.description ?? issue.body, "description"),
  webUrl: requiredString(issue.web_url ?? issue.webUrl, "web_url"),
  labels: labelsFromGitLabIssue(issue.labels),
});

const gitLabIssuesFromJson = (
  project: string,
  stdout: string,
  args: readonly string[],
): Effect.Effect<
  readonly GitLabIssueInput[],
  GitLabIssueSourceParseError | GitLabIssueSourceSchemaError
> =>
  Effect.try({
    try: () => JSON.parse(stdout) as unknown,
    catch: (error) =>
      new GitLabIssueSourceParseError({
        operation: "parse_gitlab_issues",
        command: "glab",
        args: [...args],
        message: errorMessage(error),
      }),
  }).pipe(
    Effect.flatMap((parsed) => {
      if (!Array.isArray(parsed)) {
        return Effect.fail(
          new GitLabIssueSourceSchemaError({
            operation: "parse_gitlab_issues",
            command: "glab",
            args: [...args],
            message: "Expected JSON array",
          }),
        );
      }

      return Effect.try({
        try: () =>
          parsed.map((issue) => {
            if (!isRecord(issue)) {
              throw new Error("Expected GitLab issue row to be an object");
            }

            return gitLabIssueFromJson(project, issue);
          }),
        catch: (error) =>
          new GitLabIssueSourceSchemaError({
            operation: "parse_gitlab_issues",
            command: "glab",
            args: [...args],
            message: errorMessage(error),
          }),
      });
    }),
  );

const dependencyIdsFromIssue = (issueId: string, value: unknown): readonly string[] => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((dependency) => {
    if (!isRecord(dependency)) {
      return [];
    }

    const dependencyIssueId = optionalString(dependency.issue_id);
    const dependsOnId = optionalString(dependency.depends_on_id);

    return dependencyIssueId === issueId && dependsOnId !== undefined ? [dependsOnId] : [];
  });
};

const issueFromJson = (issue: BeadsIssueJson): TrackedIssue => {
  const labels = labelsFromIssue(issue.labels);
  const id = requiredString(issue.id, "id");
  const derivedState = deriveIssueState(labels);
  const lane = derivedState.status === "active" ? deriveLane(derivedState.state) : "none";

  return {
    id,
    title: requiredString(issue.title, "title"),
    description: optionalString(issue.description),
    labels,
    priority: optionalNumber(issue.priority),
    createdAt: optionalString(issue.created_at),
    updatedAt: optionalString(issue.updated_at),
    dependencyCount: optionalNumber(issue.dependency_count),
    dependentCount: optionalNumber(issue.dependent_count),
    dependencyIds: dependencyIdsFromIssue(id, issue.dependencies),
    derivedState,
    lane,
  };
};

const issueJsonFromUnknown = (issue: unknown): BeadsIssueJson => {
  if (!isRecord(issue)) {
    throw new Error("Expected issue row to be an object");
  }

  return issue;
};

const issuesFromJson = (
  stdout: string,
  args: readonly string[],
): Effect.Effect<readonly TrackedIssue[], IssueTrackerJsonParseError> =>
  parseJsonArray(stdout, "bd", args).pipe(
    Effect.flatMap((issues) =>
      Effect.try({
        try: () => issues.map((issue) => issueFromJson(issueJsonFromUnknown(issue))),
        catch: (error) =>
          new IssueTrackerJsonParseError({
            operation: "parse_json",
            command: "bd",
            args: [...args],
            message: errorMessage(error),
          }),
      }),
    ),
  );

const firstIssueFromJson = (
  stdout: string,
  args: readonly string[],
): Effect.Effect<BeadsIssueJson, IssueTrackerJsonParseError> =>
  Effect.try({
    try: () => JSON.parse(stdout) as unknown,
    catch: (error) =>
      new IssueTrackerJsonParseError({
        operation: "parse_json",
        command: "bd",
        args: [...args],
        message: errorMessage(error),
      }),
  }).pipe(
    Effect.flatMap((parsed) =>
      Effect.try({
        try: () => {
          const issue = Array.isArray(parsed) ? parsed[0] : parsed;
          if (issue === undefined) {
            throw new Error("Expected one issue");
          }

          return issueJsonFromUnknown(issue);
        },
        catch: (error) =>
          new IssueTrackerJsonParseError({
            operation: "parse_json",
            command: "bd",
            args: [...args],
            message: errorMessage(error),
          }),
      }),
    ),
  );

const trackedIssueFromJson = (
  stdout: string,
  args: readonly string[],
): Effect.Effect<TrackedIssue, IssueTrackerJsonParseError> =>
  firstIssueFromJson(stdout, args).pipe(
    Effect.flatMap((issue) =>
      Effect.try({
        try: () => issueFromJson(issue),
        catch: (error) =>
          new IssueTrackerJsonParseError({
            operation: "parse_json",
            command: "bd",
            args: [...args],
            message: errorMessage(error),
          }),
      }),
    ),
  );

const importedGitLabMetadataFromRecord = (
  issueId: string,
  value: unknown,
): ImportedGitLabIssueMetadata | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`Expected ${issueId} morpheus.gitlab metadata to be an object`);
  }

  return {
    project: requiredString(value.project, "morpheus.gitlab.project"),
    iid: requiredNumber(value.iid, "morpheus.gitlab.iid"),
    webUrl: requiredString(value.webUrl, "morpheus.gitlab.webUrl"),
    labels: labelsFromIssue(value.labels),
    lastSyncedAt: requiredString(value.lastSyncedAt, "morpheus.gitlab.lastSyncedAt"),
    title: requiredString(value.title, "morpheus.gitlab.title"),
    description: requiredString(value.description, "morpheus.gitlab.description"),
  };
};

const importedGitLabIssueFromJson = (issue: BeadsIssueJson): ImportedGitLabIssue | undefined => {
  const id = requiredString(issue.id, "id");
  const metadata = issue.metadata;

  if (!isRecord(metadata)) {
    return undefined;
  }

  const morpheus = metadata.morpheus;
  if (!isRecord(morpheus)) {
    return undefined;
  }

  const gitlab = importedGitLabMetadataFromRecord(id, morpheus.gitlab);
  if (gitlab === undefined) {
    return undefined;
  }

  return {
    id,
    title: requiredString(issue.title, "title"),
    description: optionalString(issue.description) ?? "",
    labels: labelsFromIssue(issue.labels),
    metadata: gitlab,
  };
};

const importedGitLabIssuesFromJson = (
  stdout: string,
  args: readonly string[],
): Effect.Effect<readonly ImportedGitLabIssue[], IssueTrackerJsonParseError> =>
  parseJsonArray(stdout, "bd", args).pipe(
    Effect.flatMap((issues) =>
      Effect.try({
        try: () =>
          issues.flatMap((issue) => {
            const imported = importedGitLabIssueFromJson(issueJsonFromUnknown(issue));
            return imported === undefined ? [] : [imported];
          }),
        catch: (error) =>
          new IssueTrackerJsonParseError({
            operation: "parse_json",
            command: "bd",
            args: [...args],
            message: errorMessage(error),
          }),
      }),
    ),
  );

const readMetadata = (
  issueId: string,
  issue: BeadsIssueJson,
): Effect.Effect<Record<string, unknown>, IssueTrackerMalformedMetadataError> => {
  if (issue.metadata === undefined) {
    return Effect.succeed({});
  }

  if (isRecord(issue.metadata)) {
    return Effect.succeed(issue.metadata);
  }

  return Effect.fail(
    new IssueTrackerMalformedMetadataError({
      issueId,
      message: "Expected issue metadata to be an object",
    }),
  );
};

const rejectPlan = (
  issueId: string,
  plan: Exclude<AgentStateTransitionPlan, { readonly status: "planned" }>,
) => ({
  status: "rejected" as const,
  issueId,
  reason: plan.status,
  plan,
});

const setLabelArgs = (labels: readonly string[]): string[] =>
  labels.flatMap((label) => ["--set-labels", label]);

const activeAgentLabels = new Set<string>(agentStates);

const hasAgentLifecycleLabel = (labels: readonly string[]): boolean =>
  labels.some((label) => activeAgentLabels.has(label));

const importedMetadataFromGitLabIssue = (
  source: GitLabIssueInput,
  syncedAt: string,
): ImportedGitLabIssueMetadata => ({
  project: source.project,
  iid: source.iid,
  webUrl: source.webUrl,
  labels: source.labels,
  lastSyncedAt: syncedAt,
  title: source.title,
  description: source.description,
});

const metadataWithGitLabImport = (
  current: Record<string, unknown>,
  source: GitLabIssueInput,
  syncedAt: string,
): Record<string, unknown> => ({
  ...current,
  morpheus: {
    ...(isRecord(current.morpheus) ? current.morpheus : {}),
    gitlab: importedMetadataFromGitLabIssue(source, syncedAt),
  },
});

const importedIssueChanged = (
  issue: ImportedGitLabIssue,
  source: GitLabIssueInput,
): boolean =>
  issue.title !== source.title ||
  issue.description !== source.description ||
  issue.metadata.project !== source.project ||
  issue.metadata.iid !== source.iid ||
  issue.metadata.webUrl !== source.webUrl ||
  issue.metadata.title !== source.title ||
  issue.metadata.description !== source.description ||
  JSON.stringify(issue.metadata.labels) !== JSON.stringify(source.labels);

export const createNodeProcessRunner = ({
  cwd,
}: NodeProcessRunnerOptions): ProcessRunnerService => ({
  run: (command, args) =>
    Effect.async<ProcessResult, ProcessRunnerError>((resume) => {
      execFile(
        command,
        [...args],
        {
          cwd,
          encoding: "utf8",
          maxBuffer: 10 * 1024 * 1024,
        },
        (error, stdout, stderr) => {
          if (error !== null && typeof error.code !== "number") {
            resume(
              Effect.fail(
                new ProcessRunnerError({
                  command,
                  args: [...args],
                  message: errorMessage(error),
                }),
              ),
            );
            return;
          }

          const exitCode = error === null ? 0 : typeof error.code === "number" ? error.code : 1;
          resume(
            Effect.succeed({
              stdout,
              stderr,
              exitCode,
            }),
          );
        },
      );
    }),
});

export const nodeProcessRunnerLayer = (
  options: NodeProcessRunnerOptions,
): Layer.Layer<ProcessRunner> => Layer.succeed(ProcessRunner, createNodeProcessRunner(options));

export type FakeAgentRunnerScenario =
  | "prepared"
  | "blocked"
  | "failed"
  | "invalid_contract"
  | "blocked_contract"
  | "implemented"
  | "malformed_implementation"
  | "verification_failed"
  | "review_passed"
  | "review_blocked"
  | "review_failed"
  | "malformed_review";

type FakeAgentRunnerOptions = {
  readonly scenario?: FakeAgentRunnerScenario;
};

type SandcastlePhase = "prepare" | "implement" | "review";

type SandcastleRun = (options: RunOptions) => Promise<RunResult>;

export type SandcastleAgentRunnerOptions = {
  readonly cwd: string;
  readonly promptPaths?: Partial<Record<SandcastlePhase, string>>;
  readonly logDirectory: string;
  readonly run?: SandcastleRun;
  readonly agent?: AgentProvider;
  readonly sandbox?: SandboxProvider;
};

const fakeContract = (issue: TrackedIssue): AgentReadyContract => ({
  category: "task",
  summary: issue.title,
  currentBehavior: "Current behavior is described by the source Beads issue.",
  desiredBehavior: "Morpheus should prepare the issue into a validated Agent-Ready Contract.",
  keyInterfaces: ["IssueTracker", "RunLedger", "AgentRunner"],
  acceptanceCriteria: [
    "Preparation records run evidence.",
    "Valid preparation writes an Agent-Ready Contract.",
  ],
  outOfScope: ["Implementation", "review", "merge request creation"],
  verificationPlan: ["pnpm check"],
  blockedBy: "None",
  hitlDecisions: "None",
  riskLevel: "medium",
});

const fakeTranscript = (issue: TrackedIssue, status: string): string =>
  [`FakeAgentRunner preparation`, `issue: ${issue.id}`, `status: ${status}`].join("\n");

const fakeImplementationTranscript = (issue: TrackedIssue, status: string): string =>
  [`FakeAgentRunner implementation`, `issue: ${issue.id}`, `status: ${status}`].join("\n");

const fakeReviewTranscript = (issue: TrackedIssue, status: string): string =>
  [`FakeAgentRunner review`, `issue: ${issue.id}`, `status: ${status}`].join("\n");

const fakeImplementationResult = (
  issue: TrackedIssue,
  status: "implemented" | "verification_failed",
): ImplementationAgentResult => {
  const verificationStatus = status === "implemented" ? "passed" : "failed";
  return {
    status: "implemented",
    implementationEvidence: [
      {
        summary: `Fake implementation completed for ${issue.id}.`,
        files: ["packages/runtime/src/index.ts"],
      },
    ],
    verificationEvidence: [
      {
        command: "pnpm check",
        status: verificationStatus,
        output:
          status === "implemented" ? "Fake verification passed." : "Fake verification failed.",
      },
    ],
    transcript: fakeImplementationTranscript(issue, status),
    artifact: {
      scenario: status,
      issueId: issue.id,
    },
  };
};

const fakeReviewResult = (
  issue: TrackedIssue,
  status: "review_passed" | "review_blocked" | "review_failed",
): ReviewAgentResult => {
  const findings = [
    {
      severity: status === "review_failed" ? "error" : "info",
      summary: `Fake review finding for ${issue.id}.`,
    },
  ] as const;

  if (status === "review_blocked") {
    return {
      status: "blocked",
      reason: "Fake review needs human clarification.",
      findings,
      transcript: fakeReviewTranscript(issue, status),
      artifact: { scenario: status, issueId: issue.id },
    };
  }

  if (status === "review_failed") {
    return {
      status: "failed",
      failureKind: "verification_error",
      message: "Fake review found a failing verification claim.",
      findings,
      transcript: fakeReviewTranscript(issue, status),
      artifact: { scenario: status, issueId: issue.id },
    };
  }

  return {
    status: "passed",
    findings,
    transcript: fakeReviewTranscript(issue, status),
    artifact: { scenario: status, issueId: issue.id },
  };
};

export const createFakeAgentRunner = ({
  scenario = "prepared",
}: FakeAgentRunnerOptions = {}): AgentRunnerService => ({
  prepareIssue: ({ issue }) => {
    if (scenario === "blocked") {
      return Effect.succeed({
        status: "blocked",
        reason: "Fake preparation needs more product context.",
        transcript: fakeTranscript(issue, "blocked"),
        artifact: {
          scenario,
          reason: "Fake preparation needs more product context.",
        },
      });
    }

    if (scenario === "failed") {
      return Effect.succeed({
        status: "failed",
        failureKind: "runtime_error",
        message: "Fake preparation failed before producing a contract.",
        transcript: fakeTranscript(issue, "failed"),
        artifact: {
          scenario,
          message: "Fake preparation failed before producing a contract.",
        },
      });
    }

    if (scenario === "invalid_contract") {
      const { desiredBehavior: _desiredBehavior, ...contract } = fakeContract(issue);
      return Effect.succeed({
        status: "prepared",
        contract,
        transcript: fakeTranscript(issue, "invalid_contract"),
        artifact: {
          scenario,
          contract,
        },
      });
    }

    if (scenario === "blocked_contract") {
      const contract = {
        ...fakeContract(issue),
        blockedBy: "Needs product decision.",
      };
      return Effect.succeed({
        status: "prepared",
        contract,
        transcript: fakeTranscript(issue, "blocked_contract"),
        artifact: {
          scenario,
          contract,
        },
      });
    }

    const contract = fakeContract(issue);
    return Effect.succeed({
      status: "prepared",
      contract,
      transcript: fakeTranscript(issue, "prepared"),
      artifact: {
        scenario,
        contract,
      },
    });
  },
  implementIssue: ({ issue }) => {
    if (scenario === "malformed_implementation") {
      return Effect.succeed({
        status: "implemented",
        implementationEvidence: [{ summary: "Missing files field." }],
        verificationEvidence: [],
        transcript: fakeImplementationTranscript(issue, "malformed_implementation"),
        artifact: {
          scenario,
        },
      });
    }

    if (scenario === "verification_failed") {
      return Effect.succeed(fakeImplementationResult(issue, "verification_failed"));
    }

    return Effect.succeed(fakeImplementationResult(issue, "implemented"));
  },
  reviewIssue: ({ issue }) => {
    if (scenario === "malformed_review") {
      return Effect.succeed({
        status: "passed",
        findings: [{ severity: "critical", summary: "Invalid severity." }],
        transcript: fakeReviewTranscript(issue, "malformed_review"),
        artifact: { scenario },
      });
    }

    if (
      scenario === "review_passed" ||
      scenario === "review_blocked" ||
      scenario === "review_failed"
    ) {
      return Effect.succeed(fakeReviewResult(issue, scenario));
    }

    return Effect.succeed(fakeReviewResult(issue, "review_passed"));
  },
});

export const fakeAgentRunnerLayer = (
  options: FakeAgentRunnerOptions = {},
): Layer.Layer<AgentRunner> => Layer.succeed(AgentRunner, createFakeAgentRunner(options));

const resultTag = "morpheus_result";

type SandcastlePhaseInput =
  | { readonly phase: "prepare"; readonly issue: TrackedIssue }
  | ({ readonly phase: "implement" } & ImplementationAgentInput)
  | ({ readonly phase: "review" } & ReviewAgentInput);

const builtInPrompt = (input: SandcastlePhaseInput): string => {
  const { phase, issue } = input;
  const base = [
    `You are a Morpheus ${phase} agent.`,
    `Issue: ${issue.id}`,
    `Title: ${issue.title}`,
    `Description: ${issue.description ?? "None"}`,
    "Do not commit. Do not close Beads issues.",
    `Return only JSON inside <${resultTag}>...</${resultTag}>.`,
  ];

  if (phase === "prepare") {
    return [
      ...base,
      'AgentReadyContract fields: {"category":"task|bug|feature|chore","summary":"...","currentBehavior":"...","desiredBehavior":"...","keyInterfaces":["..."],"acceptanceCriteria":["..."],"outOfScope":["..."],"verificationPlan":["..."],"blockedBy":"None or ...","hitlDecisions":"None or ...","riskLevel":"low|medium|high"}. Use these exact camelCase keys.',
      "JSON shape: {\"status\":\"prepared\",\"contract\":AgentReadyContract,\"transcript\":\"...\",\"artifact\":{}} or blocked/failed variant.",
    ].join("\n");
  }

  if (phase === "implement") {
    return [
      ...base,
      `Workspace: ${input.workspace.workspacePath}`,
      `Worktree: ${input.workspace.worktreePath ?? "None"}`,
      `Branch: ${input.workspace.branch}`,
      `Target branch: ${input.workspace.targetBranch}`,
      `Remote: ${input.workspace.remote}`,
      `Merge request: ${input.mergeRequest.reference}`,
      `Merge request URL: ${input.mergeRequest.url ?? "None"}`,
      `Contract: ${JSON.stringify(input.contract)}`,
      "JSON shape: {\"status\":\"implemented\",\"implementationEvidence\":[{\"summary\":\"...\",\"files\":[]}],\"verificationEvidence\":[{\"command\":\"...\",\"status\":\"passed\"}],\"transcript\":\"...\",\"artifact\":{}} or failed variant.",
    ].join("\n");
  }

  return [
    ...base,
    `Workspace: ${input.workspace.workspacePath}`,
    `Worktree: ${input.workspace.worktreePath ?? "None"}`,
    `Branch: ${input.workspace.branch ?? "None"}`,
    `Permissions: ${input.workspace.permissions}`,
    `Merge request: ${input.mergeRequest.reference}`,
    `Merge request URL: ${input.mergeRequest.url ?? "None"}`,
    `Contract: ${JSON.stringify(input.contract)}`,
    `Implementation evidence: ${JSON.stringify(input.implementationEvidence)}`,
    `Verification evidence: ${JSON.stringify(input.verificationEvidence)}`,
    "JSON shape: {\"status\":\"passed\",\"findings\":[],\"transcript\":\"...\",\"artifact\":{}} or blocked/failed variant.",
  ].join("\n");
};

const resolvePromptText = (
  input: SandcastlePhaseInput,
  promptPaths: Partial<Record<SandcastlePhase, string>> = {},
  cwd: string,
): string => {
  const { phase } = input;
  const configuredPath = promptPaths[phase];
  if (configuredPath === undefined) {
    return builtInPrompt(input);
  }

  const promptPath = resolve(cwd, configuredPath);
  if (!existsSync(promptPath)) {
    throw new Error(`Prompt override not found: ${promptPath}`);
  }

  return [builtInPrompt(input), "Additional instructions:", readFileSync(promptPath, "utf8")].join(
    "\n\n",
  );
};

const extractTaggedJson = (stdout: string): unknown => {
  const match = stdout.match(new RegExp(`<${resultTag}>([\\s\\S]*?)</${resultTag}>`));
  if (match === null) {
    throw new Error(`Missing <${resultTag}> output`);
  }

  return JSON.parse(match[1]);
};

const runSandcastlePhase = (
  options: SandcastleAgentRunnerOptions,
  input: SandcastlePhaseInput,
): Effect.Effect<unknown, AgentRunnerError> =>
  Effect.tryPromise({
    try: async () => {
      const { phase, issue } = input;
      const cwd =
        phase === "implement" || phase === "review" ? input.workspace.workspacePath : options.cwd;
      mkdirSync(options.logDirectory, { recursive: true });
      const runner = options.run ?? sandcastleRun;
      const result = await runner({
        agent: options.agent ?? codex("gpt-5.4-mini", { effort: "medium" }),
        sandbox:
          options.sandbox ??
          docker({
            mounts: [{ hostPath: "~/.codex", sandboxPath: "/home/agent/.codex" }],
          }),
        cwd,
        prompt: resolvePromptText(input, options.promptPaths, options.cwd),
        logging: {
          type: "file",
          path: join(options.logDirectory, `${issue.id}-${phase}.log`),
        },
        name: `morpheus-${phase}-${issue.id}`,
        maxIterations: 1,
      });
      const output = extractTaggedJson(result.stdout);

      return {
        ...(typeof output === "object" && output !== null ? output : {}),
        transcript: result.stdout,
        artifact: {
          output,
          logFilePath: result.logFilePath,
          branch: result.branch,
          commits: result.commits,
          preservedWorktreePath: result.preservedWorktreePath,
        },
      };
    },
    catch: (error) =>
      new AgentRunnerError({
        operation: `sandcastle.${input.phase}`,
        message: errorMessage(error),
      }),
  });

export const createSandcastleAgentRunner = (
  options: SandcastleAgentRunnerOptions,
): AgentRunnerService => ({
  prepareIssue: ({ issue }) =>
    runSandcastlePhase(options, { phase: "prepare", issue }) as Effect.Effect<
      PreparationAgentResult,
      AgentRunnerError
    >,
  implementIssue: (input) => runSandcastlePhase(options, { ...input, phase: "implement" }),
  reviewIssue: (input) => runSandcastlePhase(options, { ...input, phase: "review" }),
});

export const sandcastleAgentRunnerLayer = (
  options: SandcastleAgentRunnerOptions,
): Layer.Layer<AgentRunner> => Layer.succeed(AgentRunner, createSandcastleAgentRunner(options));

const checkCommand = (
  processRunner: ProcessRunnerService,
  name: OperatorHealthCheck["name"],
  command: string,
  args: readonly string[],
  okDetail: string,
): Effect.Effect<OperatorHealthCheck, never> =>
  processRunner.run(command, args).pipe(
    Effect.match({
      onFailure: (error) => ({
        name,
        status: "warn" as const,
        detail: error.message,
      }),
      onSuccess: (result) =>
        result.exitCode === 0
          ? {
              name,
              status: "ok" as const,
              detail: okDetail,
            }
          : {
              name,
              status: "warn" as const,
              detail: result.stderr || `${command} exited ${result.exitCode}`,
            },
    }),
  );

export const createOperatorHealth = ({
  processRunner,
}: BeadsIssueTrackerOptions): OperatorHealthService => ({
  check: () =>
    Effect.all([
      checkCommand(processRunner, "beads", "bd", ["list", "--limit", "1", "--json"], "bd readable"),
      checkCommand(processRunner, "gitlab", "glab", ["auth", "status"], "glab authenticated"),
      checkCommand(processRunner, "docker", "docker", ["info"], "docker reachable"),
      checkCommand(processRunner, "workspace", "git", ["rev-parse", "--show-toplevel"], "workspace readable"),
      checkCommand(processRunner, "labels", "bd", ["list", "--label-pattern", "agent:*", "--limit", "1", "--json"], "agent labels readable"),
      checkCommand(processRunner, "daemon", "git", ["status", "--short"], "daemon assumptions readable"),
      checkCommand(processRunner, "containers", "docker", ["ps", "--format", "{{.ID}}"], "containers readable"),
      checkCommand(processRunner, "worktrees", "git", ["worktree", "list", "--porcelain"], "worktrees readable"),
      Effect.succeed({
        name: "config",
        status: "ok",
        detail: "config loaded",
      } satisfies OperatorHealthCheck),
    ]),
});

export const operatorHealthLayer: Layer.Layer<OperatorHealth, never, ProcessRunner> = Layer.effect(
  OperatorHealth,
  Effect.map(ProcessRunner, (processRunner) => createOperatorHealth({ processRunner })),
);

export const createBeadsIssueTracker = ({
  processRunner,
}: BeadsIssueTrackerOptions): IssueTrackerService => ({
  listRunnableIssues: () =>
    Effect.gen(function* () {
      const args = ["list", "--status", "open,in_progress", "--limit", "0", "--json"] as const;
      const result = yield* runBdEffect(processRunner, args);
      return yield* issuesFromJson(result.stdout, args);
    }),
  getIssue: (issueId: string) =>
    Effect.gen(function* () {
      const args = ["show", issueId, "--json"] as const;
      const result = yield* runBdEffect(processRunner, args);
      return yield* trackedIssueFromJson(result.stdout, args);
    }),
  applyAgentState: (issueId: string, transitionPlan: AgentStateTransitionPlan) =>
    Effect.gen(function* () {
      if (transitionPlan.status !== "planned") {
        return rejectPlan(issueId, transitionPlan);
      }

      const showArgs = ["show", issueId, "--json"] as const;
      const result = yield* runBdEffect(processRunner, showArgs);
      const currentIssue = yield* trackedIssueFromJson(result.stdout, showArgs);
      const currentPlan = planAgentStateTransition(currentIssue.labels, transitionPlan.event);

      if (currentPlan.status !== "planned") {
        return rejectPlan(issueId, currentPlan);
      }

      yield* runBdEffect(processRunner, [
        "update",
        issueId,
        ...setLabelArgs(currentPlan.finalLabels),
      ]);

      return {
        status: "applied",
        issueId,
        addLabels: currentPlan.addLabels,
        removeLabels: currentPlan.removeLabels,
      };
    }),
  writeContract: (issueId: string, contract: AgentReadyContract) =>
    Effect.gen(function* () {
      const showArgs = ["show", issueId, "--json"] as const;
      const result = yield* runBdEffect(processRunner, showArgs);
      const issue = yield* firstIssueFromJson(result.stdout, showArgs);
      const metadata = yield* readMetadata(issueId, issue);

      const decoded = decodeAgentReadyContract(contract);

      if (decoded.status === "invalid") {
        return yield* new IssueTrackerContractSchemaError({
          issueId,
          message: decoded.message,
        });
      }

      const nextMetadata = {
        ...metadata,
        morpheus: {
          contractVersion: 1,
          agentReadyContract: decoded.contract,
        },
      };

      yield* runBdEffect(processRunner, [
        "update",
        issueId,
        "--metadata",
        JSON.stringify(nextMetadata),
      ]);

      return {
        status: "written",
        issueId,
      };
    }),
  readContract: (issueId: string) =>
    Effect.gen(function* () {
      const args = ["show", issueId, "--json"] as const;
      const result = yield* runBdEffect(processRunner, args);
      const issue = yield* firstIssueFromJson(result.stdout, args);
      const metadata = yield* readMetadata(issueId, issue);

      const morpheus = metadata.morpheus;

      if (morpheus === undefined) {
        return {
          status: "missing",
          issueId,
        };
      }

      if (!isRecord(morpheus)) {
        return yield* new IssueTrackerMalformedMetadataError({
          issueId,
          message: "Expected morpheus metadata to be an object",
        });
      }

      if (morpheus.agentReadyContract === undefined) {
        return {
          status: "missing",
          issueId,
        };
      }

      if (morpheus.contractVersion !== 1) {
        return yield* new IssueTrackerMalformedMetadataError({
          issueId,
          message: "Expected morpheus.contractVersion to be 1",
        });
      }

      const decoded = decodeAgentReadyContract(morpheus.agentReadyContract);

      if (decoded.status === "invalid") {
        return yield* new IssueTrackerContractSchemaError({
          issueId,
          message: decoded.message,
        });
      }

      return {
        status: "present",
        issueId,
        contract: decoded.contract,
      };
    }),
  listImportedGitLabIssues: () =>
    Effect.gen(function* () {
      const args = ["list", "--all", "--limit", "0", "--json"] as const;
      const result = yield* runBdEffect(processRunner, args);
      return yield* importedGitLabIssuesFromJson(result.stdout, args);
    }),
  upsertImportedGitLabIssue: ({ source, syncedAt }) =>
    Effect.gen(function* () {
      const importedIssues = yield* createBeadsIssueTracker({
        processRunner,
      }).listImportedGitLabIssues();
      const existing = importedIssues.find(
        (issue) => issue.metadata.project === source.project && issue.metadata.iid === source.iid,
      );

      if (existing === undefined) {
        const metadata = metadataWithGitLabImport({}, source, syncedAt);
        const labels = ["agent:ready"];
        const args = [
          "create",
          source.title,
          "--description",
          source.description,
          "--type",
          "task",
          "--priority",
          "P2",
          "--labels",
          labels.join(","),
          "--metadata",
          JSON.stringify(metadata),
          "--json",
        ] as const;
        const result = yield* runBdEffect(processRunner, args);
        const issue = yield* trackedIssueFromJson(result.stdout, args);

        return {
          status: "created",
          issueId: issue.id,
          addedReadyLabel: true,
        };
      }

      const showArgs = ["show", existing.id, "--json"] as const;
      const showResult = yield* runBdEffect(processRunner, showArgs);
      const currentIssueJson = yield* firstIssueFromJson(showResult.stdout, showArgs);
      const currentMetadata = yield* readMetadata(existing.id, currentIssueJson);
      const currentLabels = labelsFromIssue(currentIssueJson.labels);
      const shouldAddReady = !hasAgentLifecycleLabel(currentLabels);
      const nextLabels = shouldAddReady ? [...currentLabels, "agent:ready"] : currentLabels;
      const nextMetadata = metadataWithGitLabImport(currentMetadata, source, syncedAt);
      const contentChanged = importedIssueChanged(existing, source);

      if (!contentChanged && !shouldAddReady) {
        yield* runBdEffect(processRunner, [
          "update",
          existing.id,
          "--metadata",
          JSON.stringify(nextMetadata),
        ]);

        return {
          status: "skipped",
          issueId: existing.id,
          reason: "unchanged",
        };
      }

      yield* runBdEffect(processRunner, [
        "update",
        existing.id,
        "--title",
        source.title,
        "--description",
        source.description,
        "--metadata",
        JSON.stringify(nextMetadata),
        ...setLabelArgs(nextLabels),
      ]);

      return {
        status: "updated",
        issueId: existing.id,
        addedReadyLabel: shouldAddReady,
      };
    }),
});

export const beadsIssueTrackerLayer: Layer.Layer<IssueTracker, never, ProcessRunner> = Layer.effect(
  IssueTracker,
  Effect.gen(function* () {
    const processRunner = yield* ProcessRunner;
    return createBeadsIssueTracker({ processRunner });
  }),
);

const branchSafeIssueId = (issueId: string): string => issueId.replaceAll(/[^A-Za-z0-9._-]/g, "-");

const branchSafeRunId = (runId: string): string => runId.replaceAll(/[^A-Za-z0-9._-]/g, "-");

export const createGitWorkspaceRuntime = ({
  processRunner,
}: GitWorkspaceRuntimeOptions): WorkspaceRuntimeService => ({
  prepareImplementationWorkspace: ({ issueId, runId }) =>
    Effect.gen(function* () {
      const root = (yield* runGitEffect(processRunner, [
        "rev-parse",
        "--show-toplevel",
      ])).stdout.trim();
      const targetBranch =
        (yield* runGitEffect(processRunner, ["branch", "--show-current"])).stdout.trim() || "main";
      const branch = `morpheus/${branchSafeIssueId(issueId)}-${branchSafeRunId(runId)}`;
      const remote = "origin";
      const worktreePath = join(dirname(root), `.morpheus-worktree-${branchSafeRunId(runId)}`);
      yield* runGitEffect(processRunner, [
        "worktree",
        "add",
        "-b",
        branch,
        worktreePath,
        targetBranch,
      ]);
      yield* runGitEffect(processRunner, ["push", "--set-upstream", remote, branch]);

      return {
        workspacePath: root,
        worktreePath,
        branch,
        targetBranch,
        remote,
      };
    }),
  prepareReviewWorkspace: ({ implementationRun }) =>
    Effect.succeed({
      workspacePath: implementationRun.workspacePath ?? implementationRun.worktreePath ?? ".",
      worktreePath: implementationRun.worktreePath,
      branch: implementationRun.branch,
      permissions: "read-only",
    }),
});

export const gitWorkspaceRuntimeLayer: Layer.Layer<WorkspaceRuntime, never, ProcessRunner> =
  Layer.effect(
    WorkspaceRuntime,
    Effect.gen(function* () {
      const processRunner = yield* ProcessRunner;
      return createGitWorkspaceRuntime({ processRunner });
    }),
  );

export const createGlabIssueSource = ({
  processRunner,
}: GlabIssueSourceOptions): GitLabIssueSourceService => ({
  listReadyIssues: ({ project, readyLabel }) =>
    Effect.gen(function* () {
      const args = [
        "issue",
        "list",
        "--repo",
        project,
        "--label",
        readyLabel,
        "--output",
        "json",
        "--per-page",
        "100",
      ] as const;
      const result = yield* runGlabIssueSourceEffect(
        processRunner,
        "listReadyGitLabIssues",
        args,
      );

      return yield* gitLabIssuesFromJson(project, result.stdout, args);
    }),
});

export const glabIssueSourceLayer: Layer.Layer<GitLabIssueSource, never, ProcessRunner> =
  Layer.effect(
    GitLabIssueSource,
    Effect.gen(function* () {
      const processRunner = yield* ProcessRunner;
      return createGlabIssueSource({ processRunner });
    }),
  );

const parseMergeRequestReference = (stdout: string): MergeRequestClientError | string => {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    return new MergeRequestClientError({
      operation: "parseDraftMergeRequest",
      failureKind: "runtime_error",
      message: "glab returned empty MR output",
    });
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (isRecord(parsed)) {
      const reference =
        optionalString(parsed.reference) ??
        optionalString(parsed.web_url) ??
        optionalString(parsed.url) ??
        optionalString(parsed.iid);
      if (reference !== undefined) {
        return reference;
      }
    }
  } catch {
    return trimmed.split("\n").at(-1) ?? trimmed;
  }

  return new MergeRequestClientError({
    operation: "parseDraftMergeRequest",
    failureKind: "runtime_error",
    message: "glab MR output did not include a reference",
  });
};

const parseMergeRequestUrl = (stdout: string): string | undefined => {
  try {
    const parsed = JSON.parse(stdout.trim()) as unknown;
    if (isRecord(parsed)) {
      return optionalString(parsed.web_url) ?? optionalString(parsed.url);
    }
  } catch {
    return stdout
      .split(/\s+/)
      .find((part) => part.startsWith("http://") || part.startsWith("https://"));
  }

  return undefined;
};

export const createGlabMergeRequestClient = ({
  processRunner,
}: GlabMergeRequestClientOptions): MergeRequestClientService => ({
  createDraftMergeRequest: (input) =>
    Effect.gen(function* () {
      const result = yield* runGlabEffect(processRunner, "createDraftMergeRequest", [
        "mr",
        "create",
        "--draft",
        "--source-branch",
        input.sourceBranch,
        "--target-branch",
        input.targetBranch,
        "--title",
        input.title,
        "--description",
        input.description,
        "--yes",
      ]);
      const reference = parseMergeRequestReference(result.stdout);
      if (reference instanceof MergeRequestClientError) {
        return yield* Effect.fail(reference);
      }

      return {
        reference,
        url: parseMergeRequestUrl(result.stdout),
      };
    }),
  updateDescription: (input) =>
    Effect.gen(function* () {
      const result = yield* runGlabEffect(processRunner, "updateMergeRequestDescription", [
        "mr",
        "update",
        input.reference,
        "--description",
        input.description,
        "--yes",
      ]);

      return {
        reference: input.reference,
        url: parseMergeRequestUrl(result.stdout),
      };
    }),
});

export const glabMergeRequestClientLayer: Layer.Layer<MergeRequestClient, never, ProcessRunner> =
  Layer.effect(
    MergeRequestClient,
    Effect.gen(function* () {
      const processRunner = yield* ProcessRunner;
      return createGlabMergeRequestClient({ processRunner });
    }),
  );
