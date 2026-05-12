import { deriveIssueState, deriveLane } from "@morpheus/core"
import type { AgentStateTransitionPlan } from "@morpheus/core"
import type {
  IssueTracker,
  ProcessResult,
  ProcessRunner,
  TrackedIssue
} from "@morpheus/runtime"

export interface AdapterInfo {
  readonly name: "MorpheusAdapters"
}

export const adapterInfo: AdapterInfo = {
  name: "MorpheusAdapters"
}

type BeadsIssueTrackerOptions = {
  readonly processRunner: ProcessRunner
}

type BeadsIssueJson = {
  readonly id?: unknown
  readonly title?: unknown
  readonly labels?: unknown
  readonly priority?: unknown
  readonly created_at?: unknown
  readonly updated_at?: unknown
}

export class BeadsCommandError extends Error {
  readonly name = "BeadsCommandError"

  constructor(
    readonly command: string,
    readonly args: readonly string[],
    readonly exitCode: number,
    readonly stderr: string
  ) {
    super(`${command} ${args.join(" ")} failed with exit code ${exitCode}`)
  }
}

export class BeadsJsonParseError extends Error {
  readonly name = "BeadsJsonParseError"

  constructor(
    readonly command: string,
    readonly args: readonly string[],
    readonly message: string
  ) {
    super(`Could not parse JSON from ${command} ${args.join(" ")}: ${message}`)
  }
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const runBd = async (
  processRunner: ProcessRunner,
  args: readonly string[]
): Promise<ProcessResult> => {
  const result = await processRunner.run("bd", args)

  if (result.exitCode !== 0) {
    throw new BeadsCommandError("bd", args, result.exitCode, result.stderr)
  }

  return result
}

const parseJsonArray = (
  stdout: string,
  command: string,
  args: readonly string[]
): readonly unknown[] => {
  let parsed: unknown

  try {
    parsed = JSON.parse(stdout)
  } catch (error) {
    throw new BeadsJsonParseError(command, args, errorMessage(error))
  }

  if (!Array.isArray(parsed)) {
    throw new BeadsJsonParseError(command, args, "Expected JSON array")
  }

  return parsed
}

const optionalNumber = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined

const optionalString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined

const requiredString = (value: unknown, field: string): string => {
  if (typeof value !== "string") {
    throw new Error(`Expected issue ${field} to be a string`)
  }

  return value
}

const labelsFromIssue = (value: unknown): readonly string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((label): label is string => typeof label === "string")
}

const issueFromJson = (issue: BeadsIssueJson): TrackedIssue => {
  const labels = labelsFromIssue(issue.labels)
  const derivedState = deriveIssueState(labels)
  const lane =
    derivedState.status === "active" ? deriveLane(derivedState.state) : "none"

  return {
    id: requiredString(issue.id, "id"),
    title: requiredString(issue.title, "title"),
    labels,
    priority: optionalNumber(issue.priority),
    createdAt: optionalString(issue.created_at),
    updatedAt: optionalString(issue.updated_at),
    derivedState,
    lane
  }
}

const firstIssueFromJson = (
  stdout: string,
  args: readonly string[]
): TrackedIssue => {
  const [issue] = parseJsonArray(stdout, "bd", args)

  if (issue === undefined) {
    throw new BeadsJsonParseError("bd", args, "Expected one issue")
  }

  return issueFromJson(issue as BeadsIssueJson)
}

const rejectPlan = (
  issueId: string,
  plan: Exclude<AgentStateTransitionPlan, { readonly status: "planned" }>
) => ({
  status: "rejected" as const,
  issueId,
  reason: plan.status,
  plan
})

export const createBeadsIssueTracker = ({
  processRunner
}: BeadsIssueTrackerOptions): IssueTracker => ({
  async listRunnableIssues() {
    const args = ["ready", "--json"] as const
    const result = await runBd(processRunner, args)
    return parseJsonArray(result.stdout, "bd", args).map((issue) =>
      issueFromJson(issue as BeadsIssueJson)
    )
  },
  async getIssue(issueId) {
    const args = ["show", issueId, "--json"] as const
    const result = await runBd(processRunner, args)
    return firstIssueFromJson(result.stdout, args)
  },
  async applyAgentState(issueId, transitionPlan) {
    if (transitionPlan.status !== "planned") {
      return rejectPlan(issueId, transitionPlan)
    }

    for (const label of transitionPlan.removeLabels) {
      await runBd(processRunner, [
        "update",
        issueId,
        "--remove-label",
        label
      ])
    }

    for (const label of transitionPlan.addLabels) {
      await runBd(processRunner, ["update", issueId, "--add-label", label])
    }

    return {
      status: "applied",
      issueId,
      addLabels: transitionPlan.addLabels,
      removeLabels: transitionPlan.removeLabels
    }
  }
})
