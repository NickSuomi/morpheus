import { logger, task, wait } from "@trigger.dev/sdk";
import { observerResult, type ObserverProjection } from "../model.js";

export type MorpheusExecutionObserverInput = {
  readonly waitpointId: string;
  readonly projection: ObserverProjection;
};

export const morpheusExecutionObserver = task({
  id: "morpheus-execution-observer-v1",
  retry: { maxAttempts: 1 },
  run: async (payload: MorpheusExecutionObserverInput) => {
    logger.info("Waiting for authoritative Morpheus terminal state");
    const result = await wait.forToken<{
      readonly projection: ObserverProjection;
    }>(payload.waitpointId);

    if (!result.ok) {
      throw new Error("Morpheus execution projection waitpoint timed out.");
    }

    const terminal = observerResult(result.output.projection);
    if (terminal.kind === "failed") {
      throw new Error(`Morpheus execution failed: ${terminal.failureKind}.`);
    }

    logger.info("Authoritative Morpheus execution completed");
    return {
      authority: "morpheus" as const,
      projectionKind: "execution-observer" as const,
      runId: terminal.projection.runId,
      issueId: terminal.projection.issueId,
      lane: terminal.projection.lane,
      morpheusState: terminal.projection.morpheusState,
      eventSequence: terminal.projection.eventSequence,
      requiredHumanAction: terminal.projection.requiredHumanAction,
    };
  },
});
