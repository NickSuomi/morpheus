import { deriveIssueState, deriveLane } from "@morpheus/core";
import type { AgentStateTransitionPlan } from "@morpheus/core";
import {
  decodeAgentReadyContract,
  IssueTracker,
  IssueTrackerCommandError,
  IssueTrackerContractSchemaError,
  IssueTrackerJsonParseError,
  IssueTrackerMalformedMetadataError,
  ProcessRunner,
} from "@morpheus/runtime";
import type {
  AgentReadyContract,
  ProcessResult,
  ProcessRunnerError,
  ProcessRunnerService,
  TrackedIssue,
  IssueTrackerService,
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

type BeadsIssueTrackerOptions = {
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

      yield* runBdEffect(processRunner, [
        "update",
        issueId,
        ...setLabelArgs(transitionPlan.finalLabels),
      ]);

      return {
        status: "applied",
        issueId,
        addLabels: transitionPlan.addLabels,
        removeLabels: transitionPlan.removeLabels,
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
