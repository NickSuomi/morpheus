export const MORPHEUS_PRODUCT_NAME = "Morpheus"

export const agentStates = [
  "agent:ready",
  "agent:preparing",
  "agent:prepared",
  "agent:running",
  "agent:reviewing",
  "agent:review-candidate",
  "agent:blocked",
  "agent:failed"
] as const

export type AgentState = (typeof agentStates)[number]

export const agentEvents = [
  "StartPreparation",
  "PreparationReady",
  "PreparationBlocked",
  "PreparationFailed",
  "StartImplementation",
  "ImplementationReadyForReview",
  "ImplementationBlocked",
  "ImplementationFailed",
  "StartReview",
  "ReviewPassed",
  "ReviewBlocked",
  "ReviewFailed",
  "HumanRequeued",
  "HumanRetryFailed"
] as const

export type AgentEvent = (typeof agentEvents)[number]

export const failureKinds = [
  "operator_access",
  "runtime_error",
  "agent_contract_error",
  "verification_error",
  "state_conflict",
  "unknown"
] as const

export type FailureKind = (typeof failureKinds)[number]

export const runnableLanes = ["preparation", "implementation", "review"] as const

export type RunnableLane = (typeof runnableLanes)[number]

export type Lane = RunnableLane | "none"

export type AgentReadyContract = {
  readonly category: string
  readonly summary: string
  readonly currentBehavior: string
  readonly desiredBehavior: string
  readonly keyInterfaces: readonly string[]
  readonly acceptanceCriteria: readonly string[]
  readonly outOfScope: readonly string[]
  readonly verificationPlan: readonly string[]
  readonly blockedBy: string
  readonly hitlDecisions: string
  readonly riskLevel: "low" | "medium" | "high"
}

export type DraftReviewArtifactInput = {
  readonly issueId: string
  readonly contract: AgentReadyContract
}

export const renderDraftReviewArtifact = ({
  issueId,
  contract
}: DraftReviewArtifactInput): string =>
  [
    "# Morpheus Draft Implementation MR",
    "",
    `Issue: ${issueId}`,
    "",
    "## Agent-Ready Contract",
    "",
    `Category: ${contract.category}`,
    "",
    contract.summary,
    "",
    "## Acceptance Criteria",
    "",
    ...contract.acceptanceCriteria.map((criterion) => `- ${criterion}`),
    "",
    "## Verification Plan",
    "",
    ...contract.verificationPlan.map((command) => `- ${command}`),
    "",
    "## Status",
    "",
    "Draft MR created before implementer agent execution."
  ].join("\n")

export type DerivedIssueState =
  | {
      readonly status: "active"
      readonly state: AgentState
    }
  | {
      readonly status: "missing"
    }
  | {
      readonly status: "conflict"
      readonly failureKind: "state_conflict"
      readonly activeStates: readonly AgentState[]
    }

export type AgentStateTransitionPlan =
  | {
      readonly status: "planned"
      readonly event: AgentEvent
      readonly from: AgentState
      readonly to: AgentState
      readonly addLabels: readonly AgentState[]
      readonly removeLabels: readonly AgentState[]
      readonly finalLabels: readonly string[]
    }
  | {
      readonly status: "missing_state"
      readonly event: AgentEvent
    }
  | {
      readonly status: "conflict"
      readonly failureKind: "state_conflict"
      readonly activeStates: readonly AgentState[]
    }
  | {
      readonly status: "invalid_transition"
      readonly from: AgentState
      readonly event: AgentEvent
    }

const agentStateSet = new Set<string>(agentStates)

const transitionTargets: Readonly<Record<AgentState, Partial<Record<AgentEvent, AgentState>>>> = {
  "agent:ready": {
    StartPreparation: "agent:preparing"
  },
  "agent:preparing": {
    PreparationReady: "agent:prepared",
    PreparationBlocked: "agent:blocked",
    PreparationFailed: "agent:failed"
  },
  "agent:prepared": {
    StartImplementation: "agent:running",
    ImplementationFailed: "agent:failed"
  },
  "agent:running": {
    ImplementationReadyForReview: "agent:reviewing",
    ImplementationBlocked: "agent:blocked",
    ImplementationFailed: "agent:failed"
  },
  "agent:reviewing": {
    ReviewPassed: "agent:review-candidate",
    ReviewBlocked: "agent:blocked",
    ReviewFailed: "agent:failed"
  },
  "agent:review-candidate": {},
  "agent:blocked": {
    HumanRequeued: "agent:ready",
    HumanRetryFailed: "agent:ready"
  },
  "agent:failed": {
    HumanRequeued: "agent:ready",
    HumanRetryFailed: "agent:ready"
  }
}

const isAgentState = (label: string): label is AgentState =>
  agentStateSet.has(label)

export const deriveIssueState = (labels: readonly string[]): DerivedIssueState => {
  const activeStates = labels.filter(isAgentState)

  if (activeStates.length === 0) {
    return { status: "missing" }
  }

  if (activeStates.length > 1) {
    return {
      status: "conflict",
      failureKind: "state_conflict",
      activeStates
    }
  }

  return {
    status: "active",
    state: activeStates[0]
  }
}

export const deriveLane = (state: AgentState): Lane => {
  switch (state) {
    case "agent:ready":
      return "preparation"
    case "agent:prepared":
      return "implementation"
    case "agent:running":
      return "review"
    default:
      return "none"
  }
}

export const planAgentStateTransition = (
  labels: readonly string[],
  event: AgentEvent
): AgentStateTransitionPlan => {
  const state = deriveIssueState(labels)

  if (state.status === "missing") {
    return {
      status: "missing_state",
      event
    }
  }

  if (state.status === "conflict") {
    return state
  }

  const to = transitionTargets[state.state][event]

  if (to === undefined) {
    return {
      status: "invalid_transition",
      from: state.state,
      event
    }
  }

  return {
    status: "planned",
    event,
    from: state.state,
    to,
    addLabels: [to],
    removeLabels: [state.state],
    finalLabels: [...labels.filter((label) => label !== state.state), to]
  }
}
