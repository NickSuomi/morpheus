import { ExecutionObserverError } from "@morpheus/runtime";
import { Effect } from "effect";
import { triggerDevRunStatuses } from "./trigger-dev-execution-observer.js";
import type {
  TriggerDevObserverClient,
  TriggerDevProjection,
  TriggerDevRunLookup,
  TriggerDevRunStatus,
} from "./trigger-dev-execution-observer.js";

export type TriggerDevHttpClientOptions = {
  readonly secretKey: string;
  readonly baseUrl?: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly requestTimeoutMs?: number;
};

type JsonRecord = Readonly<Record<string, unknown>>;

const clientError = (operation: string, message: string): ExecutionObserverError =>
  new ExecutionObserverError({ operation, message });

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const responseId = (
  operation: string,
  value: unknown,
): Effect.Effect<{ readonly id: string }, ExecutionObserverError> =>
  isRecord(value) && typeof value.id === "string"
    ? Effect.succeed({ id: value.id })
    : Effect.fail(clientError(operation, "Trigger.dev returned an invalid response."));

const runStatuses = new Set<TriggerDevRunStatus>(triggerDevRunStatuses);
const notFound = Symbol("trigger-dev-run-not-found");

export const createTriggerDevHttpClient = (
  options: TriggerDevHttpClientOptions,
): TriggerDevObserverClient => {
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  const baseUrl = (options.baseUrl ?? "https://api.trigger.dev").replace(/\/+$/, "");
  const requestTimeoutMs = options.requestTimeoutMs ?? 10_000;

  const request = (
    operation: string,
    path: string,
    init: RequestInit,
    allowNotFound = false,
  ): Effect.Effect<unknown | typeof notFound, ExecutionObserverError> =>
    Effect.tryPromise({
      try: () =>
        fetchImplementation(`${baseUrl}${path}`, {
          ...init,
          signal:
            init.signal === undefined || init.signal === null
              ? AbortSignal.timeout(requestTimeoutMs)
              : AbortSignal.any([init.signal, AbortSignal.timeout(requestTimeoutMs)]),
          headers: {
            Authorization: `Bearer ${options.secretKey}`,
            ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
            ...init.headers,
          },
        }),
      catch: () => clientError(operation, "Trigger.dev request failed."),
    }).pipe(
      Effect.flatMap((response) =>
        allowNotFound && response.status === 404
          ? Effect.succeed(notFound)
          : response.ok
            ? Effect.tryPromise({
                try: () => response.json() as Promise<unknown>,
                catch: () => clientError(operation, "Trigger.dev returned an invalid response."),
              })
            : Effect.fail(
                clientError(operation, `Trigger.dev request failed with HTTP ${response.status}.`),
              ),
      ),
    );

  return {
    createWaitpoint: (input) =>
      request("createWaitpoint", "/api/v1/waitpoints/tokens", {
        method: "POST",
        body: JSON.stringify(input),
      }).pipe(Effect.flatMap((value) => responseId("createWaitpoint", value))),
    triggerObserver: (input) =>
      request(
        "triggerObserver",
        `/api/v1/tasks/${encodeURIComponent(input.taskIdentifier)}/trigger`,
        {
          method: "POST",
          body: JSON.stringify({
            payload: input.payload,
            options: {
              idempotencyKey: input.idempotencyKey,
              idempotencyKeyTTL: input.idempotencyKeyTTL,
              tags: input.tags,
              metadata: input.payload.projection,
            },
          }),
        },
      ).pipe(Effect.flatMap((value) => responseId("triggerObserver", value))),
    updateRunMetadata: (runId, metadata) =>
      request("updateRunMetadata", `/api/v1/runs/${encodeURIComponent(runId)}/metadata`, {
        method: "PUT",
        body: JSON.stringify({ metadata }),
      }).pipe(Effect.asVoid),
    completeWaitpoint: (waitpointId, data) =>
      request(
        "completeWaitpoint",
        `/api/v1/waitpoints/tokens/${encodeURIComponent(waitpointId)}/complete`,
        {
          method: "POST",
          body: JSON.stringify({ data }),
        },
      ).pipe(Effect.asVoid),
    retrieveRun: (runId) =>
      request(
        "retrieveRun",
        `/api/v3/runs/${encodeURIComponent(runId)}`,
        { method: "GET" },
        true,
      ).pipe(
        Effect.flatMap(
          (value): Effect.Effect<TriggerDevRunLookup, ExecutionObserverError> =>
            value === notFound
              ? Effect.succeed({ found: false } as const)
              : isRecord(value) &&
                  typeof value.status === "string" &&
                  runStatuses.has(value.status as TriggerDevRunStatus)
                ? Effect.succeed({
                    found: true,
                    status: value.status as TriggerDevRunStatus,
                  } as const)
                : Effect.fail(
                    clientError("retrieveRun", "Trigger.dev returned an invalid response."),
                  ),
        ),
      ),
  };
};

export type { TriggerDevProjection };
