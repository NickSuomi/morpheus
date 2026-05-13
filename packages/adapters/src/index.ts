import { deriveIssueState, deriveLane } from "@morpheus/core"
import type { AgentStateTransitionPlan } from "@morpheus/core"
import { decodeAgentReadyContract } from "@morpheus/runtime"
import type {
  AgentReadyContract,
  IssueTracker,
  ProcessResult,
  ProcessRunner,
  TrackedIssue
} from "@morpheus/runtime"
export { createSqliteRunLedger } from "./sqlite-ledger/index.js"
export type { SqliteRunLedgerOptions } from "./sqlite-ledger/index.js"

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
  readonly metadata?: unknown
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

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
): BeadsIssueJson => {
  const [issue] = parseJsonArray(stdout, "bd", args)

  if (issue === undefined) {
    throw new BeadsJsonParseError("bd", args, "Expected one issue")
  }

  return issue as BeadsIssueJson
}

type MetadataReadResult =
  | {
      readonly status: "valid"
      readonly metadata: Record<string, unknown>
    }
  | {
      readonly status: "malformed_metadata"
      readonly message: string
    }

const readMetadata = (issue: BeadsIssueJson): MetadataReadResult => {
  if (issue.metadata === undefined) {
    return {
      status: "valid",
      metadata: {}
    }
  }

  if (isRecord(issue.metadata)) {
    return {
      status: "valid",
      metadata: issue.metadata
    }
  }

  return {
    status: "malformed_metadata",
    message: "Expected issue metadata to be an object"
  }
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
  async getIssue(issueId: string) {
    const args = ["show", issueId, "--json"] as const
    const result = await runBd(processRunner, args)
    return issueFromJson(firstIssueFromJson(result.stdout, args))
  },
  async applyAgentState(
    issueId: string,
    transitionPlan: AgentStateTransitionPlan
  ) {
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
  },
  async writeContract(issueId: string, contract: AgentReadyContract) {
    const showArgs = ["show", issueId, "--json"] as const
    const result = await runBd(processRunner, showArgs)
    const issue = firstIssueFromJson(result.stdout, showArgs)
    const metadataResult = readMetadata(issue)

    if (metadataResult.status === "malformed_metadata") {
      return {
        status: "malformed_metadata",
        issueId,
        message: metadataResult.message
      }
    }

    const decoded = decodeAgentReadyContract(contract)

    if (decoded.status === "invalid") {
      return {
        status: "schema_validation",
        issueId,
        message: decoded.message
      }
    }

    const nextMetadata = {
      ...metadataResult.metadata,
      morpheus: {
        contractVersion: 1,
        agentReadyContract: decoded.contract
      }
    }

    await runBd(processRunner, [
      "update",
      issueId,
      "--metadata",
      JSON.stringify(nextMetadata)
    ])

    return {
      status: "written",
      issueId
    }
  },
  async readContract(issueId: string) {
    const args = ["show", issueId, "--json"] as const
    const result = await runBd(processRunner, args)
    const issue = firstIssueFromJson(result.stdout, args)
    const metadataResult = readMetadata(issue)

    if (metadataResult.status === "malformed_metadata") {
      return {
        status: "malformed_metadata",
        issueId,
        message: metadataResult.message
      }
    }

    const metadata = metadataResult.metadata
    const morpheus = metadata.morpheus

    if (morpheus === undefined) {
      return {
        status: "missing",
        issueId
      }
    }

    if (!isRecord(morpheus)) {
      return {
        status: "malformed_metadata",
        issueId,
        message: "Expected morpheus metadata to be an object"
      }
    }

    if (morpheus.agentReadyContract === undefined) {
      return {
        status: "missing",
        issueId
      }
    }

    if (morpheus.contractVersion !== 1) {
      return {
        status: "malformed_metadata",
        issueId,
        message: "Expected morpheus.contractVersion to be 1"
      }
    }

    const decoded = decodeAgentReadyContract(morpheus.agentReadyContract)

    if (decoded.status === "invalid") {
      return {
        status: "schema_validation",
        issueId,
        message: decoded.message
      }
    }

    return {
      status: "present",
      issueId,
      contract: decoded.contract
    }
  }
})
