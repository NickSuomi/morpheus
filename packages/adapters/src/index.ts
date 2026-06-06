import { execFile, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { codex, run as sandcastleRun } from "@ai-hero/sandcastle";
import type { AgentProvider, RunOptions, RunResult } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import type { SandboxProvider } from "@ai-hero/sandcastle";
import {
  agentStates,
  deriveIssueState,
  deriveLane,
  planAgentStateTransition,
} from "@morpheus/core";
import type { AgentState, AgentStateTransitionPlan } from "@morpheus/core";
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
  SetupEnvironment,
  SetupEnvironmentError,
  WorkspaceRuntime,
  WorkspaceRuntimeError,
  defaultAgentSkillInstructions,
  defaultAgentStageSkillMappings,
  defaultGitLabStopLabel,
  detectTargetCapabilities,
  gitignoreEntries,
  loadMorpheusConfig,
  normalizeGitLabProjectInput,
  setupGeneratedFileContents,
  setupSecretFileTemplate,
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
  MergeRequestReference,
  MorpheusConfig,
  ProcessResult,
  ProcessRunnerService,
  ReviewAgentInput,
  ImplementationAgentResult,
  ReviewAgentResult,
  SetupEnvironmentService,
  SetupPlanningInput,
  SetupPlan,
  TrackedIssue,
  IssueTrackerService,
  OperatorHealthCheck,
  OperatorHealthService,
  ToolchainProbeConfig,
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

const setupRunText = (
  cwd: string,
  command: string,
  args: readonly string[],
): string | undefined => {
  try {
    return execFileSync(command, [...args], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
};

const setupExistingFiles = (target: string, config?: MorpheusConfig): readonly string[] => {
  const paths = [
    "morpheus.config.json",
    ".morpheus/prompts/prepare.md",
    ".morpheus/prompts/implement.md",
    ".morpheus/prompts/review.md",
    ".morpheus/container/Dockerfile",
    ".morpheus/container/README.md",
    ".morpheus/secrets/agent.env",
    ".morpheus/secrets/agent.env.example",
    ".gitignore",
    ...(config === undefined
      ? []
      : [config.agentRunner.auth.envFile, config.agentRunner.container.profile]),
  ];

  return [...new Set(paths)].filter((path) =>
    existsSync(isAbsolute(path) ? path : join(target, path)),
  );
};

const setupAuthEnvKeys = (target: string, path: string): readonly string[] => {
  const fullPath = isAbsolute(path) ? path : join(target, path);
  if (!existsSync(fullPath)) {
    return [];
  }

  return readFileSync(fullPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#") && line.includes("="))
    .flatMap((line) => {
      const separator = line.indexOf("=");
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      return key.length > 0 && value.length > 0 ? [key] : [];
    })
    .filter((key) => key.length > 0);
};

const setupVerificationCommands = (target: string): readonly string[] => {
  const packageJsonPath = join(target, "package.json");
  if (!existsSync(packageJsonPath)) {
    return [];
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      readonly scripts?: Record<string, string>;
      readonly packageManager?: string;
    };
    const runner = packageJson.packageManager?.startsWith("pnpm@") ? "pnpm" : "npm run";
    return ["test", "typecheck"].flatMap((script) =>
      packageJson.scripts?.[script] === undefined ? [] : [`${runner} ${script}`],
    );
  } catch {
    return [];
  }
};

const setupGitlabProject = (target: string): string | undefined => {
  const glabProject = setupRunText(target, "glab", [
    "repo",
    "view",
    "--json",
    "fullPath",
    "-q",
    ".fullPath",
  ]);
  if (glabProject !== undefined && glabProject.length > 0) {
    return normalizeGitLabProjectInput(glabProject);
  }

  const remote = setupRunText(target, "git", ["remote", "get-url", "origin"]);
  const match = remote?.match(/[:/]([^/:]+(?:\/[^/]+)+?)(?:\.git)?$/);
  return match?.[1] === undefined ? undefined : normalizeGitLabProjectInput(match[1]);
};

const setupDefaultBranch = (target: string): string | undefined => {
  const current = setupRunText(target, "git", ["branch", "--show-current"]);
  if (current !== undefined && current.length > 0) {
    return current;
  }

  const symbolic = setupRunText(target, "git", [
    "symbolic-ref",
    "--short",
    "refs/remotes/origin/HEAD",
  ]);
  if (symbolic?.startsWith("origin/")) {
    return symbolic.slice("origin/".length);
  }

  return undefined;
};

type NodeProcessRunnerOptions = {
  readonly cwd: string;
};

type BeadsIssueTrackerOptions = {
  readonly processRunner: ProcessRunnerService;
};

type OperatorHealthOptions = {
  readonly processRunner: ProcessRunnerService;
  readonly cwd?: string;
  readonly gitlabProject?: string;
  readonly authEnvFile?: string;
  readonly authRequiredKeys?: readonly string[];
  readonly toolchainProbes?: readonly ToolchainProbeConfig[];
  readonly containerImage?: string;
  readonly containerProfile?: string;
};

type GitWorkspaceRuntimeOptions = {
  readonly processRunner: ProcessRunnerService;
  readonly targetBranch?: string;
};

type GlabMergeRequestClientOptions = {
  readonly processRunner: ProcessRunnerService;
};

type GlabIssueSourceOptions = {
  readonly processRunner: ProcessRunnerService;
};

type NodeSetupEnvironmentOptions = {
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
  readonly status?: unknown;
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
  if (optionalString(issue.status) === "closed") {
    return undefined;
  }

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

type SourceIdentityMatchedGitLabIssue = ImportedGitLabIssue & {
  readonly matchKind: "metadata" | "legacy_prose";
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const legacyGitLabSourcePatterns = (source: GitLabIssueInput): readonly RegExp[] =>
  [source.webUrl, `${source.project}#${source.iid}`]
    .filter((token) => token.length > 0)
    .map((token) => new RegExp(`(?:^|\\n)Source:\\s*${escapeRegExp(token)}(?:\\s|$)`, "u"));

const legacyGitLabSourceMatchesIssue = (
  issue: BeadsIssueJson,
  source: GitLabIssueInput,
): boolean => {
  const title = optionalString(issue.title) ?? "";
  const description = optionalString(issue.description) ?? "";
  const searchable = `${title}\n${description}`;

  return legacyGitLabSourcePatterns(source).some((pattern) => pattern.test(searchable));
};

const sourceIdentityMatchedGitLabIssueFromJson = (
  issue: BeadsIssueJson,
  source: GitLabIssueInput,
): SourceIdentityMatchedGitLabIssue | undefined => {
  const imported = importedGitLabIssueFromJson(issue);
  if (imported !== undefined) {
    return imported.metadata.project === source.project && imported.metadata.iid === source.iid
      ? { ...imported, matchKind: "metadata" }
      : undefined;
  }

  if (!legacyGitLabSourceMatchesIssue(issue, source)) {
    return undefined;
  }

  return {
    id: requiredString(issue.id, "id"),
    title: requiredString(issue.title, "title"),
    description: optionalString(issue.description) ?? "",
    labels: labelsFromIssue(issue.labels),
    metadata: importedMetadataFromGitLabIssue(source, ""),
    matchKind: "legacy_prose",
  };
};

const sourceIdentityMatchedGitLabIssuesFromJson = (
  stdout: string,
  args: readonly string[],
  source: GitLabIssueInput,
): Effect.Effect<readonly SourceIdentityMatchedGitLabIssue[], IssueTrackerJsonParseError> =>
  parseJsonArray(stdout, "bd", args).pipe(
    Effect.flatMap((issues) =>
      Effect.try({
        try: () =>
          issues.flatMap((issue) => {
            const matched = sourceIdentityMatchedGitLabIssueFromJson(
              issueJsonFromUnknown(issue),
              source,
            );
            return matched === undefined ? [] : [matched];
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

const agentLifecycleLabelsFrom = (labels: readonly string[]): readonly AgentState[] =>
  labels.filter((label): label is AgentState => activeAgentLabels.has(label));

const withoutAgentLifecycleLabels = (labels: readonly string[]): readonly string[] =>
  labels.filter((label) => !activeAgentLabels.has(label));

const replaceAgentLifecycleLabel = (
  labels: readonly string[],
  lifecycleLabel: AgentState,
): readonly string[] => [...withoutAgentLifecycleLabels(labels), lifecycleLabel];

const nextLabelsFromGitLabLifecycle = (
  currentLabels: readonly string[],
  sourceLabels: readonly string[],
  readyLabel: string,
  stopLabel: string,
): readonly string[] | undefined => {
  const currentLifecycleLabels = agentLifecycleLabelsFrom(currentLabels);
  const currentLifecycleLabel =
    currentLifecycleLabels.length === 1 ? currentLifecycleLabels[0] : undefined;

  if (sourceLabels.includes(stopLabel) || sourceLabels.includes("agent:blocked")) {
    return replaceAgentLifecycleLabel(currentLabels, "agent:blocked");
  }

  if (sourceLabels.includes("agent:failed")) {
    return replaceAgentLifecycleLabel(currentLabels, "agent:failed");
  }

  if (sourceLabels.includes(readyLabel)) {
    if (
      currentLifecycleLabel === undefined ||
      currentLifecycleLabel === "agent:blocked" ||
      currentLifecycleLabel === "agent:failed"
    ) {
      return replaceAgentLifecycleLabel(currentLabels, "agent:ready");
    }

    return undefined;
  }

  const sourceLifecycleLabels = agentLifecycleLabelsFrom(sourceLabels);
  if (sourceLifecycleLabels.length === 1 && currentLifecycleLabel === undefined) {
    return replaceAgentLifecycleLabel(currentLabels, sourceLifecycleLabels[0]);
  }

  return undefined;
};

const labelsEqual = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((label, index) => label === right[index]);

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

const importedIssueChanged = (issue: ImportedGitLabIssue, source: GitLabIssueInput): boolean =>
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

const scrubSandcastlePublicVocabulary = (message: string): string =>
  message.replaceAll(/sandcastle/gi, "Morpheus agent runner");

const containerImageMissingPublicMessage = (
  message: string,
  containerConfig: ContainerRuntimeConfig,
): string | undefined => {
  if (!/not found locally/i.test(message) || !/build-image/i.test(message)) {
    return undefined;
  }

  const profile = containerConfig.profile ?? ".morpheus/container/Dockerfile";
  return `Configured container image ${containerConfig.image} is not available. Build it with: docker build -f ${profile} -t ${containerConfig.image} .`;
};

const agentRunnerAuthPublicMessage = (message: string): string =>
  `Morpheus agent runner auth failed: ${scrubSandcastlePublicVocabulary(message)}`;

const agentRunnerPhasePublicMessage = (
  phase: SandcastlePhase,
  message: string,
  containerConfig: ContainerRuntimeConfig,
): string =>
  `Morpheus agent runner failed during ${phase}: ${
    containerImageMissingPublicMessage(message, containerConfig) ??
    scrubSandcastlePublicVocabulary(message)
  }`;

const containerRunnerPublicMessage = (detail: string): string =>
  `Morpheus container runner access check failed: Docker-compatible runtime unavailable: ${scrubSandcastlePublicVocabulary(detail)}. Start Docker Desktop, OrbStack, Colima, or remote Docker context.`;
type DockerFactory = typeof docker;

export type ContainerAgentConfig = {
  readonly provider: "codex";
  readonly model: string;
  readonly effort: "low" | "medium" | "high" | "xhigh";
  readonly idleTimeoutSeconds?: number;
};

export type ContainerMountConfig = {
  readonly hostPath: string;
  readonly containerPath: string;
  readonly readOnly?: boolean;
};

export type ContainerRuntimeConfig = {
  readonly image: string;
  readonly profile?: string;
  readonly mounts: readonly ContainerMountConfig[];
};

export type AgentSkillConfig = {
  readonly directory: string;
  readonly mappings: readonly {
    readonly name: string;
    readonly path: string;
  }[];
  readonly stageMappings: Record<SandcastlePhase, readonly string[]>;
};

export type SandcastleAgentRunnerOptions = {
  readonly cwd: string;
  readonly promptPaths?: Partial<Record<SandcastlePhase, string>>;
  readonly skills?: AgentSkillConfig;
  readonly logDirectory: string;
  readonly processRunner?: ProcessRunnerService;
  readonly agentConfig?: ContainerAgentConfig;
  readonly authEnvFile?: string;
  readonly authRequiredKeys?: readonly string[];
  readonly containerConfig?: ContainerRuntimeConfig;
  readonly run?: SandcastleRun;
  readonly dockerFactory?: DockerFactory;
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

const defaultStageMappingsForPrompt = {
  prepare: [...defaultAgentStageSkillMappings.prepare],
  implement: [...defaultAgentStageSkillMappings.implement],
  review: [...defaultAgentStageSkillMappings.review],
};

const defaultSkillConfig: AgentSkillConfig = {
  directory: ".morpheus/skills",
  mappings: [
    {
      name: "matt-pocock-caveman",
      path: ".morpheus/skills/matt-pocock-caveman/SKILL.md",
    },
    {
      name: "matt-pocock-to-prd",
      path: ".morpheus/skills/matt-pocock-to-prd/SKILL.md",
    },
    {
      name: "matt-pocock-grill-me",
      path: ".morpheus/skills/matt-pocock-grill-me/SKILL.md",
    },
    {
      name: "matt-pocock-to-issues",
      path: ".morpheus/skills/matt-pocock-to-issues/SKILL.md",
    },
    {
      name: "matt-pocock-grill-with-docs",
      path: ".morpheus/skills/matt-pocock-grill-with-docs/SKILL.md",
    },
    {
      name: "matt-pocock-tdd",
      path: ".morpheus/skills/matt-pocock-tdd/SKILL.md",
    },
    {
      name: "matt-pocock-diagnose",
      path: ".morpheus/skills/matt-pocock-diagnose/SKILL.md",
    },
  ],
  stageMappings: defaultStageMappingsForPrompt,
};

const stageSkillInstructionsForPrompt = (
  phase: SandcastlePhase,
  skills: AgentSkillConfig,
): string => {
  const skillPaths = new Map(skills.mappings.map((skill) => [skill.name, skill.path]));
  const stageSkills = skills.stageMappings[phase];
  if (stageSkills.length === 0) {
    throw new Error(`Stage skill mapping must include at least one copied skill: ${phase}`);
  }
  const references = stageSkills
    .map((name) => {
      const path = skillPaths.get(name);
      if (path === undefined) {
        throw new Error(`Stage skill mapping references unknown copied skill: ${phase}:${name}`);
      }
      if (path.length === 0) {
        throw new Error(
          `Stage skill mapping references copied skill without path: ${phase}:${name}`,
        );
      }
      return `- ${name}: ${path}`;
    })
    .join("\n");

  return [
    `Required ${phase} stage skills:`,
    "Read and use these copied repo-local skill files before acting:",
    references,
  ].join("\n");
};

const builtInPrompt = (input: SandcastlePhaseInput, skills: AgentSkillConfig): string => {
  const { phase, issue } = input;
  const base = [
    `You are a Morpheus ${phase} agent.`,
    `Issue: ${issue.id}`,
    `Title: ${issue.title}`,
    `Description: ${issue.description ?? "None"}`,
    defaultAgentSkillInstructions,
    stageSkillInstructionsForPrompt(phase, skills),
    phase === "implement"
      ? "Do not close Beads issues. Commit implementation changes on the implementation branch before returning implemented. Do not push. Do not run glab. Morpheus or the host operator publishes the branch/MR outside the sandbox."
      : "Do not commit. Do not close Beads issues.",
    `Return only JSON inside <${resultTag}>...</${resultTag}>.`,
  ];

  if (phase === "prepare") {
    return [
      ...base,
      "Use planning, grilling, and issue-slicing skills to clarify intent and split work if needed.",
      "AFK-ready contract gate: blockedBy must be `None`, hitlDecisions must be `None`, acceptance criteria must be behavioral and testable, verification plan must be runnable or explicitly explainable, and scope must be clear enough for implementation without human clarification.",
      "If AFK-ready gates are not met, return a blocked result instead of inventing requirements.",
      'AgentReadyContract fields: {"category":"task|bug|feature|chore","summary":"...","currentBehavior":"...","desiredBehavior":"...","keyInterfaces":["..."],"acceptanceCriteria":["..."],"outOfScope":["..."],"verificationPlan":["..."],"blockedBy":"None or ...","hitlDecisions":"None or ...","riskLevel":"low|medium|high"}. Use these exact camelCase keys.',
      'JSON shape: {"status":"prepared","contract":AgentReadyContract,"transcript":"...","artifact":{}} or blocked/failed variant.',
    ].join("\n");
  }

  if (phase === "implement") {
    return [
      ...base,
      `Implementation root (edit and verify here ONLY): ${input.workspace.worktreePath ?? input.workspace.workspacePath}`,
      `Host workspace (do not edit for implementation): ${input.workspace.workspacePath}`,
      `Branch: ${input.workspace.branch}`,
      `Target branch: ${input.workspace.targetBranch}`,
      `Remote: ${input.workspace.remote}`,
      `Merge request: ${input.mergeRequest.reference}`,
      `Merge request URL: ${input.mergeRequest.url ?? "None"}`,
      `Contract: ${JSON.stringify(input.contract)}`,
      "All code changes, verification commands, git diff checks, and commits must happen inside the Implementation root. Do not edit or verify the host workspace path.",
      "Before returning implemented, run git add for changed files and git commit on the Branch above. A successful implementation must leave at least one commit on that branch. Do not push from the sandbox.",
      "Before returning implemented, verify `git diff --stat TARGET...HEAD` is non-empty and that your implementation commits are on the Branch above.",
      "Use caveman for concise communication, TDD for behavior-first implementation where practical, and diagnose before changing unclear code.",
      'JSON shape: {"status":"implemented","implementationEvidence":[{"summary":"...","files":[]}],"verificationEvidence":[{"command":"...","status":"passed"}],"transcript":"...","artifact":{}} or failed variant.',
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
    "Stay read-only. Use concise review and diagnosis behavior.",
    "Verify contract acceptance criteria, AFK gates, verification plan, out-of-scope boundaries, and evidence claims.",
    'JSON shapes: passed {"status":"passed","findings":[],"transcript":"...","artifact":{}}; blocked {"status":"blocked","reason":"...","findings":[],"transcript":"...","artifact":{}}; failed {"status":"failed","failureKind":"verification_error","message":"...","findings":[],"transcript":"...","artifact":{}}.',
    "For failed review results, `failureKind` is required and must be one of: operator_access, runtime_error, agent_contract_error, verification_error, state_conflict, unknown.",
  ].join("\n");
};

const resolvePromptText = (
  input: SandcastlePhaseInput,
  promptPaths: Partial<Record<SandcastlePhase, string>> = {},
  skills: AgentSkillConfig = defaultSkillConfig,
  cwd: string,
): string => {
  const { phase } = input;
  const configuredPath = promptPaths[phase];
  if (configuredPath === undefined) {
    return builtInPrompt(input, skills);
  }

  const promptPath = resolve(cwd, configuredPath);
  if (!existsSync(promptPath)) {
    throw new Error(`Prompt override not found: ${promptPath}`);
  }

  return [
    builtInPrompt(input, skills),
    "Additional instructions:",
    readFileSync(promptPath, "utf8"),
  ].join("\n\n");
};

const firstJsonValueFrom = (value: string): string | undefined => {
  const objectStart = value.indexOf("{");
  const arrayStart = value.indexOf("[");
  const start =
    objectStart === -1
      ? arrayStart
      : arrayStart === -1
        ? objectStart
        : Math.min(objectStart, arrayStart);
  if (start === -1) {
    return undefined;
  }

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      stack.push("}");
      continue;
    }

    if (char === "[") {
      stack.push("]");
      continue;
    }

    if (char !== "}" && char !== "]") {
      continue;
    }

    const expected = stack.pop();
    if (expected !== char) {
      return undefined;
    }

    if (stack.length === 0) {
      return value.slice(start, index + 1);
    }
  }

  return undefined;
};

const extractTaggedJson = (stdout: string): unknown => {
  const match = stdout.match(new RegExp(`<${resultTag}>([\\s\\S]*?)</${resultTag}>`));
  if (match === null) {
    throw new Error(`Missing <${resultTag}> output`);
  }

  const payload = match[1].trim();

  try {
    return JSON.parse(payload);
  } catch (error) {
    const firstJsonValue = firstJsonValueFrom(payload);
    if (firstJsonValue !== undefined && firstJsonValue !== payload) {
      try {
        return JSON.parse(firstJsonValue);
      } catch {
        // Preserve the original whole-payload parse error below.
      }
    }

    throw error;
  }
};

const parseEnvFile = (contents: string): Record<string, string> =>
  Object.fromEntries(
    contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator === -1) {
          return undefined;
        }

        const key = line.slice(0, separator).trim();
        const rawValue = line.slice(separator + 1).trim();
        const value =
          (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
          (rawValue.startsWith("'") && rawValue.endsWith("'"))
            ? rawValue.slice(1, -1)
            : rawValue;
        return key.length === 0 || value.length === 0 ? undefined : [key, value];
      })
      .filter((entry): entry is [string, string] => entry !== undefined),
  );

const readAuthEnv = (
  cwd: string,
  requiredKeys: readonly string[],
  authEnvFile?: string,
): Record<string, string> => {
  if (authEnvFile === undefined) {
    return {};
  }

  const path = resolve(cwd, authEnvFile);
  if (!existsSync(path)) {
    throw new Error(`Agent auth env file not found: ${path}`);
  }

  const env = parseEnvFile(readFileSync(path, "utf8"));
  if (Object.keys(env).length === 0) {
    throw new Error(`Agent auth env file has no variables: ${path}`);
  }

  const missingKeys = requiredKeys.filter((key) => env[key] === undefined);
  if (missingKeys.length > 0) {
    throw new Error(
      `Agent auth env file missing required keys: ${missingKeys.join(", ")}: ${path}`,
    );
  }

  return env;
};

const defaultAuthRequiredKeys = (agentConfig: ContainerAgentConfig): readonly string[] =>
  agentConfig.provider === "codex" ? ["OPENAI_API_KEY"] : [];

const authRequiredKeysForOptions = (
  agentConfig: ContainerAgentConfig,
  options: Pick<SandcastleAgentRunnerOptions, "authRequiredKeys">,
): readonly string[] => options.authRequiredKeys ?? defaultAuthRequiredKeys(agentConfig);

const shellQuote = (value: string): string => `'${value.replaceAll("'", `'"'"'`)}'`;

const codexWithApiKeyLogin = (
  model: string,
  options: { readonly effort: ContainerAgentConfig["effort"] },
): AgentProvider => {
  const baseAgent = codex(model, options);

  return {
    ...baseAgent,
    buildPrintCommand: (input) => {
      const printCommand = baseAgent.buildPrintCommand(input);
      return {
        ...printCommand,
        command: `sh -lc ${shellQuote(`mkdir -p "$CODEX_HOME" && printf '%s\n' "$OPENAI_API_KEY" | codex login --with-api-key >/dev/null && ${printCommand.command}`)}`,
      };
    },
  };
};

const checkDockerCompatibleRuntime = (
  processRunner: ProcessRunnerService,
): Effect.Effect<void, AgentRunnerError> =>
  processRunner.run("docker", ["info"]).pipe(
    Effect.mapError((error) => {
      const detail = error.message;
      return new AgentRunnerError({
        operation: "sandcastle.docker",
        failureKind: "operator_access",
        message: `Docker-compatible runtime unavailable: ${detail}. Start Docker Desktop, OrbStack, Colima, or remote Docker context.`,
        publicMessage: containerRunnerPublicMessage(detail),
      });
    }),
    Effect.flatMap((result) => {
      if (result.exitCode === 0) {
        return Effect.void;
      }

      const detail = result.stderr || `docker info exited ${result.exitCode}`;
      return Effect.fail(
        new AgentRunnerError({
          operation: "sandcastle.docker",
          failureKind: "operator_access",
          message: `Docker-compatible runtime unavailable: ${detail}. Start Docker Desktop, OrbStack, Colima, or remote Docker context.`,
          publicMessage: containerRunnerPublicMessage(detail),
        }),
      );
    }),
  );

const commitIdFromUnknown = (commit: unknown): string | undefined => {
  if (typeof commit === "string") {
    return commit.length > 0 ? commit : undefined;
  }

  if (typeof commit !== "object" || commit === null) {
    return undefined;
  }

  const record = commit as Record<string, unknown>;
  for (const key of ["hash", "sha", "oid", "id", "commit"] as const) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
};

const normalizeCommitIds = (commits: readonly unknown[]): readonly string[] =>
  commits.flatMap((commit) => {
    const id = commitIdFromUnknown(commit);
    return id === undefined ? [] : [id];
  });

const branchCommitsFromGit = (cwd: string, targetBranch: string): readonly string[] => {
  try {
    const stdout = execFileSync(
      "git",
      ["-C", cwd, "rev-list", "--reverse", `${targetBranch}..HEAD`],
      { encoding: "utf8" },
    );
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
};

const runSandcastlePhase = (
  options: SandcastleAgentRunnerOptions,
  input: SandcastlePhaseInput,
): Effect.Effect<unknown, AgentRunnerError> =>
  Effect.tryPromise({
    try: async () => {
      const { phase, issue } = input;
      const cwd =
        phase === "implement" || phase === "review"
          ? (input.workspace.worktreePath ?? input.workspace.workspacePath)
          : options.cwd;
      mkdirSync(options.logDirectory, { recursive: true });
      const runner = options.run ?? sandcastleRun;
      const agentConfig = options.agentConfig ?? {
        provider: "codex" as const,
        model: "gpt-5.4-mini",
        effort: "xhigh" as const,
      };
      const authEnv = readAuthEnv(
        options.cwd,
        authRequiredKeysForOptions(agentConfig, options),
        options.authEnvFile,
      );
      if (agentConfig.provider === "codex" && authEnv.CODEX_HOME !== undefined) {
        throw new Error(
          "Codex agent auth env file must not set CODEX_HOME; use OPENAI_API_KEY only",
        );
      }
      const containerConfig = options.containerConfig ?? {
        image: "morpheus-agent:local",
        mounts: [],
      };
      const configuredMounts = containerConfig.mounts.map((mount) => ({
        hostPath: resolve(options.cwd, mount.hostPath),
        sandboxPath: mount.containerPath,
        readonly: mount.readOnly,
      }));
      const worktreeMount =
        (phase === "implement" || phase === "review") &&
        input.workspace.worktreePath !== undefined &&
        resolve(input.workspace.worktreePath) !== resolve(options.cwd)
          ? [
              {
                hostPath: resolve(input.workspace.worktreePath),
                sandboxPath: resolve(input.workspace.worktreePath),
                readonly: false,
              },
            ]
          : [];
      const result = await runner({
        agent:
          options.agent ?? codexWithApiKeyLogin(agentConfig.model, { effort: agentConfig.effort }),
        sandbox:
          options.sandbox ??
          (options.dockerFactory ?? docker)({
            imageName: containerConfig.image,
            containerUid: 0,
            containerGid: 0,
            ...(containerConfig.profile === undefined
              ? {}
              : { dockerfilePath: resolve(options.cwd, containerConfig.profile) }),
            mounts: [...configuredMounts, ...worktreeMount],
            env: {
              ...authEnv,
              HOME: "/tmp/morpheus-home",
              CODEX_HOME: "/tmp/morpheus-codex-home",
              XDG_CONFIG_HOME: "/tmp/morpheus-home/.config",
            },
          }),
        cwd,
        prompt: resolvePromptText(input, options.promptPaths, options.skills, options.cwd),
        logging: {
          type: "file",
          path: join(options.logDirectory, `${issue.id}-${phase}.log`),
        },
        name: `morpheus-${phase}-${issue.id}`,
        maxIterations: 1,
        idleTimeoutSeconds: agentConfig.idleTimeoutSeconds ?? 1800,
      });
      const output = extractTaggedJson(result.stdout);
      const reportedCommits = normalizeCommitIds(result.commits);
      const commits =
        phase === "implement" && reportedCommits.length === 0
          ? branchCommitsFromGit(cwd, input.workspace.targetBranch)
          : reportedCommits;

      return {
        ...(typeof output === "object" && output !== null ? output : {}),
        transcript: result.stdout,
        artifact: {
          output,
          logFilePath: result.logFilePath,
          branch: result.branch,
          commits,
          preservedWorktreePath: result.preservedWorktreePath,
        },
      };
    },
    catch: (error) => {
      const message = errorMessage(error);
      const isAuthError = message.startsWith("Agent auth env file");
      return new AgentRunnerError({
        operation: `sandcastle.${input.phase}`,
        failureKind: isAuthError ? "operator_access" : "runtime_error",
        message,
        publicMessage: isAuthError
          ? agentRunnerAuthPublicMessage(message)
          : agentRunnerPhasePublicMessage(
              input.phase,
              message,
              options.containerConfig ?? {
                image: "morpheus-agent:local",
                mounts: [],
              },
            ),
      });
    },
  });

export const createSandcastleAgentRunner = (
  options: SandcastleAgentRunnerOptions,
): AgentRunnerService => ({
  checkAccess: () =>
    Effect.gen(function* () {
      yield* Effect.try({
        try: () => {
          const agentConfig = options.agentConfig ?? {
            provider: "codex" as const,
            model: "gpt-5.4-mini",
            effort: "xhigh" as const,
          };
          readAuthEnv(
            options.cwd,
            authRequiredKeysForOptions(agentConfig, options),
            options.authEnvFile,
          );
        },
        catch: (error) =>
          new AgentRunnerError({
            operation: "sandcastle.auth",
            failureKind: "operator_access",
            message: errorMessage(error),
            publicMessage: agentRunnerAuthPublicMessage(errorMessage(error)),
          }),
      });

      if (options.processRunner !== undefined) {
        yield* checkDockerCompatibleRuntime(options.processRunner);
      }
    }),
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
): Layer.Layer<AgentRunner, never, ProcessRunner> =>
  Layer.effect(
    AgentRunner,
    Effect.map(ProcessRunner, (processRunner) =>
      createSandcastleAgentRunner({ ...options, processRunner }),
    ),
  );

const checkCommand = (
  processRunner: ProcessRunnerService,
  name: OperatorHealthCheck["name"],
  command: string,
  args: readonly string[],
  okDetail: string,
  failureDetail?: (detail: string) => string,
  failureStatus: Exclude<OperatorHealthCheck["status"], "ok"> = "fail",
): Effect.Effect<OperatorHealthCheck, never> =>
  processRunner.run(command, args).pipe(
    Effect.match({
      onFailure: (error) => {
        const detail = failureDetail?.(error.message) ?? error.message;
        return {
          name,
          status: failureStatus,
          detail,
        };
      },
      onSuccess: (result) =>
        result.exitCode === 0
          ? {
              name,
              status: "ok" as const,
              detail: okDetail,
            }
          : (() => {
              const rawDetail = result.stderr || `${command} exited ${result.exitCode}`;
              return {
                name,
                status: failureStatus,
                detail: failureDetail?.(rawDetail) ?? rawDetail,
              };
            })(),
    }),
  );

const dockerOperatorAction = (detail: string): string =>
  `${detail}. Start a Docker-compatible runtime such as Docker Desktop, OrbStack, Colima, or a remote Docker context, then rerun morpheus doctor.`;

const dockerCompatibleRuntimeOkDetail =
  "Docker-compatible runtime reachable via docker info (Docker Desktop, OrbStack, Colima, or remote Docker context)";

const checkAgentAuth = (options: OperatorHealthOptions): OperatorHealthCheck => {
  if (options.authEnvFile === undefined || options.cwd === undefined) {
    return {
      name: "config",
      status: "ok",
      detail: "config loaded",
    };
  }

  try {
    readAuthEnv(options.cwd, options.authRequiredKeys ?? ["OPENAI_API_KEY"], options.authEnvFile);
    return {
      name: "config",
      status: "ok",
      detail: `agent auth env file contains required keys: ${options.authRequiredKeys?.join(", ") ?? "OPENAI_API_KEY"}`,
    };
  } catch (error) {
    return {
      name: "config",
      status: "fail",
      detail: errorMessage(error),
    };
  }
};

const checkToolchainProbe = (
  processRunner: ProcessRunnerService,
  probe: ToolchainProbeConfig,
  options: Pick<OperatorHealthOptions, "containerImage" | "cwd">,
): Effect.Effect<OperatorHealthCheck, never> =>
  processRunner
    .run(
      probe.scope === "container" && options.containerImage !== undefined
        ? "docker"
        : probe.command,
      probe.scope === "container" && options.containerImage !== undefined
        ? [
            "run",
            "--rm",
            "-v",
            `${options.cwd ?? process.cwd()}:/workspace`,
            "-w",
            "/workspace",
            "--entrypoint",
            "",
            options.containerImage,
            probe.command,
            ...probe.args,
          ]
        : probe.args,
    )
    .pipe(
      Effect.match({
        onFailure: (error) => ({
          name: "toolchain" as const,
          status: "warn" as const,
          detail: `${probe.name} missing: ${error.message}. ${probe.action}`,
        }),
        onSuccess: (result) => {
          if (result.exitCode === 0) {
            return {
              name: "toolchain" as const,
              status: "ok" as const,
              detail: `${probe.name} available`,
            };
          }

          return {
            name: "toolchain" as const,
            status: "warn" as const,
            detail: `${probe.name} missing: ${result.stderr || `${probe.command} exited ${result.exitCode}`}. ${probe.action}`,
          };
        },
      }),
    );

const checkContainerImage = (
  processRunner: ProcessRunnerService,
  options: Pick<OperatorHealthOptions, "containerImage" | "containerProfile">,
): Effect.Effect<OperatorHealthCheck | undefined, never> => {
  if (options.containerImage === undefined) {
    return Effect.succeed(undefined);
  }

  return processRunner.run("docker", ["image", "inspect", options.containerImage]).pipe(
    Effect.match({
      onFailure: (error) => ({
        name: "containers" as const,
        status: "fail" as const,
        detail: containerImageMissingDetail(options, error.message),
      }),
      onSuccess: (result) =>
        result.exitCode === 0
          ? undefined
          : {
              name: "containers" as const,
              status: "fail" as const,
              detail: containerImageMissingDetail(
                options,
                result.stderr || `docker image inspect exited ${result.exitCode}`,
              ),
            },
    }),
  );
};

const containerImageMissingDetail = (
  options: Pick<OperatorHealthOptions, "containerImage" | "containerProfile">,
  detail: string,
): string => {
  const image = options.containerImage ?? "configured container image";
  const profile = options.containerProfile ?? ".morpheus/container/Dockerfile";
  return `Configured container image ${image} is not available: ${detail}. Build it with: docker build -f ${profile} -t ${image} .`;
};

export const createOperatorHealth = ({
  processRunner,
  cwd,
  gitlabProject,
  authEnvFile,
  authRequiredKeys,
  toolchainProbes = [],
  containerImage,
  containerProfile,
}: OperatorHealthOptions): OperatorHealthService => ({
  check: () =>
    Effect.gen(function* () {
      const baseChecks = yield* Effect.all([
        checkCommand(
          processRunner,
          "beads",
          "bd",
          ["list", "--limit", "1", "--json"],
          "bd readable",
        ),
        checkCommand(
          processRunner,
          "gitlab",
          "glab",
          gitlabProject === undefined ? ["auth", "status"] : ["repo", "view", gitlabProject],
          gitlabProject === undefined
            ? "glab authenticated"
            : `GitLab project accessible: ${gitlabProject}`,
        ),
        checkCommand(
          processRunner,
          "docker",
          "docker",
          ["info"],
          dockerCompatibleRuntimeOkDetail,
          dockerOperatorAction,
        ),
        checkCommand(
          processRunner,
          "workspace",
          "git",
          ["rev-parse", "--show-toplevel"],
          "workspace readable",
        ),
        checkCommand(
          processRunner,
          "labels",
          "bd",
          ["list", "--label-pattern", "agent:*", "--limit", "1", "--json"],
          "agent labels readable",
        ),
        checkCommand(
          processRunner,
          "daemon",
          "git",
          ["status", "--short"],
          "daemon assumptions readable",
        ),
        checkCommand(
          processRunner,
          "containers",
          "docker",
          ["ps", "--format", "{{.ID}}"],
          "containers readable",
          dockerOperatorAction,
        ),
        checkCommand(
          processRunner,
          "worktrees",
          "git",
          ["worktree", "list", "--porcelain"],
          "worktrees readable",
        ),
        Effect.succeed(checkAgentAuth({ processRunner, cwd, authEnvFile, authRequiredKeys })),
      ]);
      const containerImageCheck = yield* checkContainerImage(processRunner, {
        containerImage,
        containerProfile,
      });
      const runnableToolchainProbes =
        containerImageCheck?.status === "fail"
          ? toolchainProbes.filter((probe) => probe.scope !== "container")
          : toolchainProbes;
      const toolchainChecks = yield* Effect.all(
        runnableToolchainProbes.map((probe) =>
          checkToolchainProbe(processRunner, probe, { containerImage, cwd }),
        ),
      );

      return containerImageCheck === undefined
        ? [...baseChecks, ...toolchainChecks]
        : [...baseChecks, containerImageCheck, ...toolchainChecks];
    }),
});

export const operatorHealthLayer = (
  options: Omit<OperatorHealthOptions, "processRunner"> = {},
): Layer.Layer<OperatorHealth, never, ProcessRunner> =>
  Layer.effect(
    OperatorHealth,
    Effect.map(ProcessRunner, (processRunner) =>
      createOperatorHealth({ processRunner, ...options }),
    ),
  );

const patchSetupGitignore = (target: string): void => {
  const gitignorePath = join(target, ".gitignore");
  const gitignore = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf8") : "";
  const lines = gitignore.split(/\r?\n/).filter((line) => line.length > 0);
  const missingEntries = gitignoreEntries.filter((entry) => !lines.includes(entry));

  if (missingEntries.length === 0) {
    return;
  }

  const prefix = gitignore.length > 0 && !gitignore.endsWith("\n") ? "\n" : "";
  writeFileSync(gitignorePath, `${gitignore}${prefix}${missingEntries.join("\n")}\n`);
};

export const detectMorpheusSetupInput = (
  options: {
    readonly targetPath?: string;
    readonly currentWorkingDirectory?: string;
    readonly doctor?: NonNullable<SetupPlanningInput["detected"]>["doctor"];
  } = {},
): SetupPlanningInput => {
  const currentWorkingDirectory = options.currentWorkingDirectory ?? process.cwd();
  const target = resolve(currentWorkingDirectory, options.targetPath ?? ".");
  const targetExists = existsSync(target);
  const targetDirectory = targetExists && statSync(target).isDirectory();
  const isGitWorktree =
    targetDirectory &&
    setupRunText(target, "git", ["rev-parse", "--is-inside-work-tree"]) === "true";
  const configResult = loadMorpheusConfig({ configPath: join(target, "morpheus.config.json") });
  const config = configResult.status === "loaded" ? configResult.config : undefined;
  const authEnvFile = config?.agentRunner.auth.envFile ?? ".morpheus/secrets/agent.env";

  return {
    targetPath: target,
    currentWorkingDirectory,
    detected: {
      targetPath: {
        exists: targetExists,
        isDirectory: targetDirectory,
        isReadable: targetDirectory,
        isGitWorktree,
      },
      gitlabProject: isGitWorktree ? setupGitlabProject(target) : undefined,
      defaultBranch: isGitWorktree ? setupDefaultBranch(target) : undefined,
      capabilities: targetDirectory ? detectTargetCapabilities(target) : [],
      dockerAvailable: targetDirectory && setupRunText(target, "docker", ["info"]) !== undefined,
      verificationCommands: targetDirectory ? setupVerificationCommands(target) : [],
      doctor: options.doctor,
    },
    existing: {
      config,
      configError: configResult.status === "error" ? configResult.error : undefined,
      files: targetDirectory ? setupExistingFiles(target, config) : [],
      authEnvKeys: targetDirectory ? setupAuthEnvKeys(target, authEnvFile) : [],
    },
  };
};

export const applyMorpheusSetupPlan = (plan: SetupPlan): void => {
  if (plan.configMutation.action === "blocked") {
    throw new Error("Setup plan is blocked by invalid input.");
  }

  if (!plan.configMutation.apply) {
    return;
  }

  const target = plan.target.resolvedPath;
  const config = plan.configMutation.nextConfig;
  mkdirSync(target, { recursive: true });

  for (const mutation of plan.fileMutations) {
    if (!mutation.apply || mutation.action === "skip" || mutation.action === "refuse") {
      continue;
    }

    if (mutation.path === "morpheus.config.json") {
      mkdirSync(dirname(join(target, mutation.path)), { recursive: true });
      writeFileSync(join(target, mutation.path), `${JSON.stringify(config, null, 2)}\n`);
      continue;
    }

    if (mutation.path === ".gitignore") {
      patchSetupGitignore(target);
      continue;
    }

    if (mutation.path === config.agentRunner.auth.envFile) {
      const fullPath = isAbsolute(mutation.path) ? mutation.path : join(target, mutation.path);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, setupSecretFileTemplate(config.agentRunner.auth.requiredKeys), {
        flag: "wx",
      });
      continue;
    }

    const contents = setupGeneratedFileContents(target, mutation.path, config);
    if (contents !== undefined) {
      const fullPath = join(target, mutation.path);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, contents);
    }
  }

  const validation = loadMorpheusConfig({ configPath: join(target, "morpheus.config.json") });
  if (validation.status === "error") {
    throw new Error(`${validation.error.kind}: ${validation.error.path}`);
  }
};

const createNodeSetupEnvironment = ({
  processRunner,
}: NodeSetupEnvironmentOptions): SetupEnvironmentService => ({
  detect: (options) =>
    Effect.try({
      try: () => detectMorpheusSetupInput(options),
      catch: (error) =>
        new SetupEnvironmentError({
          operation: "setup.detect",
          message: errorMessage(error),
        }),
    }),
  apply: (plan) =>
    Effect.try({
      try: () => applyMorpheusSetupPlan(plan),
      catch: (error) =>
        new SetupEnvironmentError({
          operation: "setup.apply",
          message: errorMessage(error),
        }),
    }),
  buildContainer: (plan) =>
    Effect.gen(function* () {
      if (plan.configMutation.action === "blocked") {
        return yield* new SetupEnvironmentError({
          operation: "setup.containerBuild",
          message: "Setup plan is blocked by invalid input.",
        });
      }

      const config = plan.configMutation.nextConfig;
      const args = [
        "build",
        "-f",
        config.agentRunner.container.profile,
        "-t",
        config.agentRunner.container.image,
        ".",
      ];
      const result = yield* processRunner.run("docker", args).pipe(
        Effect.mapError(
          (error) =>
            new SetupEnvironmentError({
              operation: "setup.containerBuild",
              message: error.message,
            }),
        ),
      );

      if (result.exitCode !== 0) {
        return yield* new SetupEnvironmentError({
          operation: "setup.containerBuild",
          message: result.stderr.length > 0 ? result.stderr : `docker exited ${result.exitCode}`,
        });
      }

      return `Built container image ${config.agentRunner.container.image}`;
    }),
});

export const nodeSetupEnvironmentLayer = (): Layer.Layer<SetupEnvironment, never, ProcessRunner> =>
  Layer.effect(
    SetupEnvironment,
    Effect.map(ProcessRunner, (processRunner) => createNodeSetupEnvironment({ processRunner })),
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
          ...(isRecord(metadata.morpheus) ? metadata.morpheus : {}),
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
  upsertImportedGitLabIssue: ({
    source,
    syncedAt,
    readyLabel = "agent:ready",
    stopLabel = defaultGitLabStopLabel,
  }) =>
    Effect.gen(function* () {
      const listArgs = ["list", "--all", "--limit", "0", "--json"] as const;
      const listResult = yield* runBdEffect(processRunner, listArgs);
      const matching = yield* sourceIdentityMatchedGitLabIssuesFromJson(
        listResult.stdout,
        listArgs,
        source,
      );
      const existing = matching[0];

      if (
        existing !== undefined &&
        (matching.length > 1 || existing.matchKind === "legacy_prose")
      ) {
        yield* Effect.forEach(
          matching,
          (issue) => {
            const duplicateFailurePlan = planAgentStateTransition(
              issue.labels,
              "DuplicateImportDetected",
            );

            if (duplicateFailurePlan.status !== "planned") {
              return Effect.void;
            }

            return runBdEffect(processRunner, [
              "update",
              issue.id,
              ...setLabelArgs(duplicateFailurePlan.finalLabels),
            ]).pipe(Effect.asVoid);
          },
          { discard: true },
        );

        return {
          status: "skipped",
          issueId: existing.id,
          reason: "duplicate_detected",
          ...(matching.length > 1
            ? { duplicateIssueIds: matching.slice(1).map((issue) => issue.id) }
            : {}),
        };
      }

      if (existing === undefined) {
        const metadata = metadataWithGitLabImport({}, source, syncedAt);
        const labels = nextLabelsFromGitLabLifecycle([], source.labels, readyLabel, stopLabel) ?? [
          "agent:ready",
        ];
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
          addedReadyLabel: labels.includes("agent:ready"),
        };
      }

      const showArgs = ["show", existing.id, "--json"] as const;
      const showResult = yield* runBdEffect(processRunner, showArgs);
      const currentIssueJson = yield* firstIssueFromJson(showResult.stdout, showArgs);
      const currentMetadata = yield* readMetadata(existing.id, currentIssueJson);
      const currentLabels = labelsFromIssue(currentIssueJson.labels);
      const nextLabelsFromGitLab = nextLabelsFromGitLabLifecycle(
        currentLabels,
        source.labels,
        readyLabel,
        stopLabel,
      );
      const nextMetadata = metadataWithGitLabImport(currentMetadata, source, syncedAt);
      const contentChanged = importedIssueChanged(existing, source);
      const nextLabels = nextLabelsFromGitLab ?? currentLabels;
      const labelsChanged =
        nextLabelsFromGitLab !== undefined && !labelsEqual(currentLabels, nextLabels);

      if (!contentChanged && !labelsChanged) {
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
        ...(labelsChanged ? setLabelArgs(nextLabels) : []),
      ]);

      return {
        status: "updated",
        issueId: existing.id,
        addedReadyLabel:
          labelsChanged &&
          nextLabels.includes("agent:ready") &&
          !currentLabels.includes("agent:ready"),
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
  targetBranch: configuredTargetBranch,
}: GitWorkspaceRuntimeOptions): WorkspaceRuntimeService => ({
  prepareImplementationWorkspace: ({ issueId, runId }) =>
    Effect.gen(function* () {
      const root = (yield* runGitEffect(processRunner, [
        "rev-parse",
        "--show-toplevel",
      ])).stdout.trim();
      const currentBranch =
        (yield* runGitEffect(processRunner, ["branch", "--show-current"])).stdout.trim() || "main";
      const targetBranch = configuredTargetBranch ?? currentBranch;

      if (configuredTargetBranch !== undefined && currentBranch !== configuredTargetBranch) {
        return yield* new WorkspaceRuntimeError({
          operation: "prepareImplementationWorkspace",
          message: `Configured target branch ${configuredTargetBranch} does not match current checkout branch ${currentBranch}. Checkout the configured target branch before running Morpheus.`,
        });
      }

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
  finalizeImplementationWorkspace: ({ workspace }) =>
    Effect.gen(function* () {
      const implementationRoot = workspace.worktreePath ?? workspace.workspacePath;
      const commits = (yield* runGitEffect(processRunner, [
        "-C",
        implementationRoot,
        "rev-list",
        "--reverse",
        `${workspace.targetBranch}..HEAD`,
      ])).stdout
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (commits.length === 0) {
        return { commits };
      }

      yield* runGitEffect(processRunner, [
        "-C",
        implementationRoot,
        "push",
        workspace.remote,
        `HEAD:refs/heads/${workspace.branch}`,
      ]);

      return { commits };
    }),
  prepareReviewWorkspace: ({ implementationRun }) =>
    Effect.succeed({
      workspacePath: implementationRun.workspacePath ?? implementationRun.worktreePath ?? ".",
      worktreePath: implementationRun.worktreePath,
      branch: implementationRun.branch,
      permissions: "read-only",
    }),
});

export const gitWorkspaceRuntimeLayer = (
  options: { readonly targetBranch?: string } = {},
): Layer.Layer<WorkspaceRuntime, never, ProcessRunner> =>
  Layer.effect(
    WorkspaceRuntime,
    Effect.gen(function* () {
      const processRunner = yield* ProcessRunner;
      return createGitWorkspaceRuntime({ processRunner, targetBranch: options.targetBranch });
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
      const result = yield* runGlabIssueSourceEffect(processRunner, "listReadyGitLabIssues", args);

      return yield* gitLabIssuesFromJson(project, result.stdout, args);
    }),
  listLifecycleIssues: ({ project, labels }) =>
    Effect.gen(function* () {
      const byIid = new Map<number, GitLabIssueInput>();

      for (const label of labels) {
        const args = [
          "issue",
          "list",
          "--repo",
          project,
          "--label",
          label,
          "--output",
          "json",
          "--per-page",
          "100",
        ] as const;
        const result = yield* runGlabIssueSourceEffect(
          processRunner,
          "listLifecycleGitLabIssues",
          args,
        );
        const issues = yield* gitLabIssuesFromJson(project, result.stdout, args);

        for (const issue of issues) {
          byIid.set(issue.iid, issue);
        }
      }

      return [...byIid.values()];
    }),
  updateIssueLabels: ({ project, iid, addLabels: labelsToAdd, removeLabels }) =>
    Effect.gen(function* () {
      const args = [
        "issue",
        "update",
        String(iid),
        "--repo",
        project,
        ...(labelsToAdd.length === 0 ? [] : ["--label", labelsToAdd.join(",")]),
        ...(removeLabels.length === 0 ? [] : ["--unlabel", removeLabels.join(",")]),
      ] as const;

      yield* runGlabIssueSourceEffect(processRunner, "updateGitLabIssueLabels", args);
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

const mergeRequestReferenceFromJson = (value: unknown): MergeRequestReference | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const reference = optionalString(value.reference);
  const iid = optionalNumber(value.iid);
  const url = optionalString(value.web_url) ?? optionalString(value.url);

  if (reference !== undefined) {
    return { reference, url };
  }

  if (iid !== undefined) {
    return { reference: `!${iid}`, url };
  }

  return url === undefined ? undefined : { reference: url, url };
};

const parseOpenMergeRequestList = (
  stdout: string,
): MergeRequestClientError | MergeRequestReference | undefined => {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      return new MergeRequestClientError({
        operation: "parseOpenMergeRequestList",
        failureKind: "runtime_error",
        message: "glab MR list output was not a JSON array",
      });
    }

    return parsed.map(mergeRequestReferenceFromJson).find((reference) => reference !== undefined);
  } catch (error) {
    return new MergeRequestClientError({
      operation: "parseOpenMergeRequestList",
      failureKind: "runtime_error",
      message: errorMessage(error),
    });
  }
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
  findOpenMergeRequestForSourceIssue: ({ sourceIssueIid }) =>
    Effect.gen(function* () {
      const result = yield* runGlabEffect(processRunner, "findOpenMergeRequestForSourceIssue", [
        "mr",
        "list",
        "--search",
        `#${sourceIssueIid}`,
        "--output",
        "json",
        "--per-page",
        "100",
      ]);
      const reference = parseOpenMergeRequestList(result.stdout);
      if (reference instanceof MergeRequestClientError) {
        return yield* Effect.fail(reference);
      }

      return reference;
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
