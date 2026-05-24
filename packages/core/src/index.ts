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
  readonly sourceIssue?: SourceIssueReference
  readonly contract: AgentReadyContract
}

export type SourceIssueReference = {
  readonly iid: number
}

export type ReviewFinding = {
  readonly severity: "info" | "warning" | "error"
  readonly summary: string
}

export type ReviewArtifactInput = {
  readonly issueId: string
  readonly sourceIssue?: SourceIssueReference
  readonly contract: AgentReadyContract
  readonly implementationEvidence: readonly string[]
  readonly verificationEvidence: readonly string[]
  readonly reviewVerdict?: "pending" | "passed" | "blocked" | "failed"
  readonly reviewFindings: readonly ReviewFinding[]
  readonly humanChecklist: readonly string[]
}

const bulletList = (items: readonly string[], fallback: string): readonly string[] =>
  items.length === 0 ? [`- ${fallback}`] : items.map((item) => `- ${item}`)

const findingList = (findings: readonly ReviewFinding[]): readonly string[] =>
  findings.length === 0
    ? ["- No review findings recorded yet."]
    : findings.map((finding) => `- [${finding.severity}] ${finding.summary}`)

export const renderReviewArtifact = ({
  issueId,
  sourceIssue,
  contract,
  implementationEvidence,
  verificationEvidence,
  reviewVerdict = "pending",
  reviewFindings,
  humanChecklist
}: ReviewArtifactInput): string =>
  [
    "# Morpheus Draft Implementation MR",
    "",
    `Issue: ${issueId}`,
    ...(sourceIssue === undefined ? [] : ["", `Source issue: #${sourceIssue.iid}`]),
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
    "## Implementation Evidence",
    "",
    ...bulletList(implementationEvidence, "Pending implementation evidence."),
    "",
    "## Verification Evidence",
    "",
    ...bulletList(verificationEvidence, "Pending verification evidence."),
    "",
    "## Risk",
    "",
    `Risk level: ${contract.riskLevel}`,
    "",
    "## Review Findings",
    "",
    ...findingList(reviewFindings),
    "",
    "## Human Checklist",
    "",
    ...bulletList(humanChecklist, "Review implementation evidence before marking ready."),
    "",
    "## Status",
    "",
    `Review verdict: ${reviewVerdict}`
  ].join("\n")

export const renderDraftReviewArtifact = ({
  issueId,
  sourceIssue,
  contract
}: DraftReviewArtifactInput): string =>
  renderReviewArtifact({
    issueId,
    sourceIssue,
    contract,
    implementationEvidence: [],
    verificationEvidence: [],
    reviewVerdict: "pending",
    reviewFindings: [],
    humanChecklist: []
  })

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

export type LaneSchedulerIssue = {
  readonly id: string
  readonly labels: readonly string[]
  readonly priority?: number
  readonly createdAt?: string
  readonly updatedAt?: string
}

export type LaneCapacityConfig = Partial<Record<RunnableLane, number>>

export type ScheduledLaneIssue = LaneSchedulerIssue & {
  readonly lane: RunnableLane
  readonly state: AgentState
}

export type ExcludedLaneIssue =
  | {
      readonly issue: LaneSchedulerIssue
      readonly reason: "state_conflict"
      readonly activeStates: readonly AgentState[]
    }
  | {
      readonly issue: LaneSchedulerIssue
      readonly reason: "missing_state" | "idle_state"
      readonly state?: AgentState
    }

export type LaneSchedule = {
  readonly capacities: Record<RunnableLane, number>
  readonly queues: Record<RunnableLane, readonly ScheduledLaneIssue[]>
  readonly selected: Record<RunnableLane, readonly ScheduledLaneIssue[]>
  readonly excluded: readonly ExcludedLaneIssue[]
}

const defaultLaneCapacities: Record<RunnableLane, number> = {
  preparation: 1,
  implementation: 1,
  review: 1
}

const normalizeCapacity = (capacity: number | undefined, fallback: number): number => {
  if (capacity === undefined) {
    return fallback
  }

  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new RangeError("Lane capacity must be a positive integer")
  }

  return capacity
}

const normalizeLaneCapacities = (
  config: LaneCapacityConfig = {}
): Record<RunnableLane, number> => ({
  preparation: normalizeCapacity(
    config.preparation,
    defaultLaneCapacities.preparation
  ),
  implementation: normalizeCapacity(
    config.implementation,
    defaultLaneCapacities.implementation
  ),
  review: normalizeCapacity(config.review, defaultLaneCapacities.review)
})

const emptyLaneBuckets = <T>(): Record<RunnableLane, T[]> => ({
  preparation: [],
  implementation: [],
  review: []
})

const issueDate = (issue: LaneSchedulerIssue): string =>
  issue.createdAt ?? issue.updatedAt ?? ""

const compareLaneIssues = (
  left: LaneSchedulerIssue,
  right: LaneSchedulerIssue
): number =>
  (left.priority ?? Number.MAX_SAFE_INTEGER) -
    (right.priority ?? Number.MAX_SAFE_INTEGER) ||
  issueDate(left).localeCompare(issueDate(right)) ||
  left.id.localeCompare(right.id)

export const scheduleLanes = (
  issues: readonly LaneSchedulerIssue[],
  capacityConfig: LaneCapacityConfig = {}
): LaneSchedule => {
  const capacities = normalizeLaneCapacities(capacityConfig)
  const queues = emptyLaneBuckets<ScheduledLaneIssue>()
  const excluded: ExcludedLaneIssue[] = []

  for (const issue of issues) {
    const state = deriveIssueState(issue.labels)

    if (state.status === "conflict") {
      excluded.push({
        issue,
        reason: "state_conflict",
        activeStates: state.activeStates
      })
      continue
    }

    if (state.status === "missing") {
      excluded.push({
        issue,
        reason: "missing_state"
      })
      continue
    }

    const lane = deriveLane(state.state)
    if (lane === "none") {
      excluded.push({
        issue,
        reason: "idle_state",
        state: state.state
      })
      continue
    }

    queues[lane].push({
      ...issue,
      lane,
      state: state.state
    })
  }

  for (const lane of runnableLanes) {
    queues[lane].sort(compareLaneIssues)
  }

  return {
    capacities,
    queues,
    selected: {
      preparation: queues.preparation.slice(0, capacities.preparation),
      implementation: queues.implementation.slice(0, capacities.implementation),
      review: queues.review.slice(0, capacities.review)
    },
    excluded
  }
}
