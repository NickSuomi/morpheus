import { execFile } from "node:child_process";
import { dirname, join } from "node:path";
import { deriveIssueState, deriveLane, planAgentStateTransition } from "@morpheus/core";
import type { AgentStateTransitionPlan } from "@morpheus/core";
import {
  AgentRunner,
  decodeAgentReadyContract,
  IssueTracker,
  IssueTrackerCommandError,
  IssueTrackerContractSchemaError,
  IssueTrackerJsonParseError,
  IssueTrackerMalformedMetadataError,
  MergeRequestClient,
  MergeRequestClientError,
  ProcessRunner,
  ProcessRunnerError,
  WorkspaceRuntime,
  WorkspaceRuntimeError,
} from "@morpheus/runtime";
import type {
  AgentReadyContract,
  AgentRunnerService,
  MergeRequestClientService,
  ProcessResult,
  ProcessRunnerService,
  TrackedIssue,
  IssueTrackerService,
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

type BeadsIssueJson = {
  readonly id?: unknown;
  readonly title?: unknown;
  readonly labels?: unknown;
  readonly priority?: unknown;
  readonly created_at?: unknown;
  readonly updated_at?: unknown;
  readonly metadata?: unknown;
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

const issueFromJson = (issue: BeadsIssueJson): TrackedIssue => {
  const labels = labelsFromIssue(issue.labels);
  const derivedState = deriveIssueState(labels);
  const lane = derivedState.status === "active" ? deriveLane(derivedState.state) : "none";

  return {
    id: requiredString(issue.id, "id"),
    title: requiredString(issue.title, "title"),
    labels,
    priority: optionalNumber(issue.priority),
    createdAt: optionalString(issue.created_at),
    updatedAt: optionalString(issue.updated_at),
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
  parseJsonArray(stdout, "bd", args).pipe(
    Effect.flatMap(([issue]) =>
      issue === undefined
        ? Effect.fail(
            new IssueTrackerJsonParseError({
              operation: "parse_json",
              command: "bd",
              args: [...args],
              message: "Expected one issue",
            }),
          )
        : Effect.try({
            try: () => issueJsonFromUnknown(issue),
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
  | "blocked_contract";

type FakeAgentRunnerOptions = {
  readonly scenario?: FakeAgentRunnerScenario;
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
});

export const fakeAgentRunnerLayer = (
  options: FakeAgentRunnerOptions = {},
): Layer.Layer<AgentRunner> => Layer.succeed(AgentRunner, createFakeAgentRunner(options));

export const createBeadsIssueTracker = ({
  processRunner,
}: BeadsIssueTrackerOptions): IssueTrackerService => ({
  listRunnableIssues: () =>
    Effect.gen(function* () {
      const args = ["ready", "--json"] as const;
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
});

export const beadsIssueTrackerLayer: Layer.Layer<IssueTracker, never, ProcessRunner> = Layer.effect(
  IssueTracker,
  Effect.gen(function* () {
    const processRunner = yield* ProcessRunner;
    return createBeadsIssueTracker({ processRunner });
  }),
);

const branchSafeIssueId = (issueId: string): string =>
  issueId.replaceAll(/[^A-Za-z0-9._-]/g, "-");

const branchSafeRunId = (runId: string): string => runId.replaceAll(/[^A-Za-z0-9._-]/g, "-");

export const createGitWorkspaceRuntime = ({
  processRunner,
}: GitWorkspaceRuntimeOptions): WorkspaceRuntimeService => ({
  prepareImplementationWorkspace: ({ issueId, runId }) =>
    Effect.gen(function* () {
      const root = (
        yield* runGitEffect(processRunner, ["rev-parse", "--show-toplevel"])
      ).stdout.trim();
      const targetBranch =
        (yield* runGitEffect(processRunner, ["branch", "--show-current"])).stdout.trim() || "main";
      const branch = `morpheus/${branchSafeIssueId(issueId)}-${branchSafeRunId(runId)}`;
      const remote = "origin";
      const worktreePath = join(dirname(root), `.morpheus-worktree-${branchSafeRunId(runId)}`);
      yield* runGitEffect(processRunner, ["worktree", "add", "-b", branch, worktreePath, targetBranch]);
      yield* runGitEffect(processRunner, ["push", "--set-upstream", remote, branch]);

      return {
        workspacePath: root,
        worktreePath,
        branch,
        targetBranch,
        remote,
      };
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
      const result = yield* runGlabEffect(
        processRunner,
        "createDraftMergeRequest",
        [
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
        ],
      );
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

export const glabMergeRequestClientLayer: Layer.Layer<
  MergeRequestClient,
  never,
  ProcessRunner
> = Layer.effect(
  MergeRequestClient,
  Effect.gen(function* () {
    const processRunner = yield* ProcessRunner;
    return createGlabMergeRequestClient({ processRunner });
  }),
);
