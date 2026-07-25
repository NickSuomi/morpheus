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

export const observerResult = (projection: ObserverProjection): ObserverTerminalResult => {
  if (
    projection.schemaVersion !== 1 ||
    projection.authority !== "morpheus" ||
    projection.projectionKind !== "execution-observer" ||
    projection.status === "running"
  ) {
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
