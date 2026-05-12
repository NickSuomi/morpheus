import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import * as Schema from "@effect/schema/Schema"
import type {
  AgentStateTransitionPlan,
  DerivedIssueState,
  Lane
} from "@morpheus/core"

export interface RuntimeInfo {
  readonly name: "MorpheusRuntime"
}

export const runtimeInfo: RuntimeInfo = {
  name: "MorpheusRuntime"
}

export type ProcessResult = {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
}

export interface ProcessRunner {
  readonly run: (
    command: string,
    args: readonly string[]
  ) => Promise<ProcessResult>
}

export type TrackedIssue = {
  readonly id: string
  readonly title: string
  readonly labels: readonly string[]
  readonly priority?: number
  readonly createdAt?: string
  readonly updatedAt?: string
  readonly derivedState: DerivedIssueState
  readonly lane: Lane
}

export type IssueTrackerApplyResult =
  | {
      readonly status: "applied"
      readonly issueId: string
      readonly addLabels: readonly string[]
      readonly removeLabels: readonly string[]
    }
  | {
      readonly status: "rejected"
      readonly issueId: string
      readonly reason: Exclude<AgentStateTransitionPlan["status"], "planned">
      readonly plan: Exclude<
        AgentStateTransitionPlan,
        { readonly status: "planned" }
      >
    }

export interface IssueTracker {
  readonly listRunnableIssues: () => Promise<readonly TrackedIssue[]>
  readonly getIssue: (issueId: string) => Promise<TrackedIssue>
  readonly applyAgentState: (
    issueId: string,
    transitionPlan: AgentStateTransitionPlan
  ) => Promise<IssueTrackerApplyResult>
}

export const MorpheusConfigSchema = Schema.Struct({
  targetRepo: Schema.String,
  issueTracker: Schema.Struct({
    kind: Schema.Literal("beads")
  }),
  mergeRequests: Schema.Struct({
    kind: Schema.Literal("gitlab-glab")
  }),
  agentRunner: Schema.Struct({
    kind: Schema.Literal("sandcastle")
  }),
  ledger: Schema.Struct({
    path: Schema.String
  }),
  lanes: Schema.Struct({
    preparation: Schema.Struct({
      concurrency: Schema.Number
    }),
    implementation: Schema.Struct({
      concurrency: Schema.Number
    }),
    review: Schema.Struct({
      concurrency: Schema.Number
    })
  }),
  verification: Schema.Struct({
    commands: Schema.Array(Schema.String)
  }),
  retention: Schema.Struct({
    completedIntermediate: Schema.Struct({
      keepDays: Schema.Number,
      keepLast: Schema.Number
    }),
    failed: Schema.Literal("manual"),
    reviewCandidate: Schema.Literal("until-mr-closed-or-manual"),
    active: Schema.Literal("never")
  }),
  prompts: Schema.optional(
    Schema.Struct({
      prepare: Schema.String,
      implement: Schema.String,
      review: Schema.String
    })
  )
})

export type MorpheusConfig = Schema.Schema.Type<typeof MorpheusConfigSchema>

export type ConfigLoadOptions = {
  readonly configPath?: string
  readonly targetRepo?: string
}

export type ConfigLoadError =
  | {
      readonly kind: "missing_config"
      readonly path: string
    }
  | {
      readonly kind: "malformed_json"
      readonly path: string
      readonly message: string
    }
  | {
      readonly kind: "schema_validation"
      readonly path: string
      readonly message: string
    }

export type ConfigLoadResult =
  | {
      readonly status: "loaded"
      readonly path: string
      readonly config: MorpheusConfig
    }
  | {
      readonly status: "error"
      readonly error: ConfigLoadError
    }

const configPathFromOptions = (options: ConfigLoadOptions): string => {
  if (options.configPath !== undefined) {
    return resolve(options.configPath)
  }

  return resolve(options.targetRepo ?? process.cwd(), "morpheus.config.json")
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const loadMorpheusConfig = (
  options: ConfigLoadOptions = {}
): ConfigLoadResult => {
  const path = configPathFromOptions(options)

  if (!existsSync(path)) {
    return {
      status: "error",
      error: {
        kind: "missing_config",
        path
      }
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"))
  } catch (error) {
    return {
      status: "error",
      error: {
        kind: "malformed_json",
        path,
        message: errorMessage(error)
      }
    }
  }

  try {
    return {
      status: "loaded",
      path,
      config: Schema.decodeUnknownSync(MorpheusConfigSchema)(parsed)
    }
  } catch (error) {
    return {
      status: "error",
      error: {
        kind: "schema_validation",
        path,
        message: errorMessage(error)
      }
    }
  }
}
