export type ObserverProjection = {
  readonly schemaVersion: 1;
  readonly authority: "morpheus";
  readonly projectionKind: "execution-observer";
  readonly targetId: string;
  readonly issueId: string;
  readonly runId: string;
  readonly generation: number;
  readonly lane: "preparation" | "implementation" | "review";
  readonly status: "running" | "succeeded" | "failed";
  readonly morpheusState:
    | "agent:ready"
    | "agent:preparing"
    | "agent:prepared"
    | "agent:running"
    | "agent:reviewing"
    | "agent:review-candidate"
    | "agent:blocked"
    | "agent:failed";
  readonly eventSequence: number;
  readonly startedAt: string;
  readonly endedAt?: string;
  readonly failureKind?:
    | "operator_access"
    | "runtime_error"
    | "agent_contract_error"
    | "verification_error"
    | "state_conflict"
    | "unknown";
  readonly requiredHumanAction: "inspect-morpheus-run" | "review-in-gitlab" | null;
};

export type ObserverTerminalResult =
  | {
      readonly kind: "succeeded";
      readonly projection: ObserverProjection;
    }
  | {
      readonly kind: "failed";
      readonly failureKind: NonNullable<ObserverProjection["failureKind"]>;
      readonly projection: ObserverProjection;
    };

export type ObserverInput = {
  readonly waitpointId: string;
  readonly projection: ObserverProjection;
};

const lanes = new Set(["preparation", "implementation", "review"]);
const statuses = new Set(["running", "succeeded", "failed"]);
const states = new Set([
  "agent:ready",
  "agent:preparing",
  "agent:prepared",
  "agent:running",
  "agent:reviewing",
  "agent:review-candidate",
  "agent:blocked",
  "agent:failed",
]);
const failureKinds = new Set([
  "operator_access",
  "runtime_error",
  "agent_contract_error",
  "verification_error",
  "state_conflict",
  "unknown",
]);
const humanActions = new Set(["inspect-morpheus-run", "review-in-gitlab"]);
const projectionKeys = new Set([
  "schemaVersion",
  "authority",
  "projectionKind",
  "targetId",
  "issueId",
  "runId",
  "generation",
  "lane",
  "status",
  "morpheusState",
  "eventSequence",
  "startedAt",
  "endedAt",
  "failureKind",
  "requiredHumanAction",
]);
const opaqueId = (kind: "target" | "issue" | "run", value: unknown): boolean =>
  typeof value === "string" && new RegExp(`^${kind}_[0-9a-f]{32}$`).test(value);
const isoTimestamp = (value: unknown): boolean =>
  typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value));
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseObserverProjection = (value: unknown): ObserverProjection => {
  if (
    !isRecord(value) ||
    !Object.keys(value).every((key) => projectionKeys.has(key)) ||
    value.schemaVersion !== 1 ||
    value.authority !== "morpheus" ||
    value.projectionKind !== "execution-observer" ||
    !opaqueId("target", value.targetId) ||
    !opaqueId("issue", value.issueId) ||
    !opaqueId("run", value.runId) ||
    !Number.isSafeInteger(value.generation) ||
    (value.generation as number) < 1 ||
    typeof value.lane !== "string" ||
    !lanes.has(value.lane) ||
    typeof value.status !== "string" ||
    !statuses.has(value.status) ||
    typeof value.morpheusState !== "string" ||
    !states.has(value.morpheusState) ||
    !Number.isSafeInteger(value.eventSequence) ||
    (value.eventSequence as number) < 0 ||
    !isoTimestamp(value.startedAt) ||
    (value.endedAt !== undefined && !isoTimestamp(value.endedAt)) ||
    (value.failureKind !== undefined &&
      (typeof value.failureKind !== "string" || !failureKinds.has(value.failureKind))) ||
    (value.requiredHumanAction !== null &&
      (typeof value.requiredHumanAction !== "string" ||
        !humanActions.has(value.requiredHumanAction)))
  ) {
    throw new Error("Trigger.dev received an invalid execution projection.");
  }

  const projection = value as ObserverProjection;
  if (
    (projection.status === "running" &&
      (projection.endedAt !== undefined || projection.failureKind !== undefined)) ||
    (projection.status === "succeeded" &&
      (projection.endedAt === undefined || projection.failureKind !== undefined)) ||
    (projection.status === "failed" &&
      (projection.endedAt === undefined || projection.failureKind === undefined))
  ) {
    throw new Error("Trigger.dev received an invalid execution projection.");
  }
  return projection;
};

export const parseObserverInput = (value: unknown): ObserverInput => {
  if (
    !isRecord(value) ||
    !Object.keys(value).every((key) => key === "waitpointId" || key === "projection") ||
    typeof value.waitpointId !== "string" ||
    !/^[A-Za-z0-9_-]{1,160}$/.test(value.waitpointId)
  ) {
    throw new Error("Trigger.dev received an invalid observer input.");
  }
  return {
    waitpointId: value.waitpointId,
    projection: parseObserverProjection(value.projection),
  };
};

export const observerResult = (value: unknown): ObserverTerminalResult => {
  const projection = parseObserverProjection(value);
  if (projection.status === "running") {
    throw new Error("Observer waitpoint did not return a terminal projection.");
  }

  return projection.status === "succeeded"
    ? { kind: "succeeded", projection }
    : {
        kind: "failed",
        failureKind: projection.failureKind ?? "unknown",
        projection,
      };
};
