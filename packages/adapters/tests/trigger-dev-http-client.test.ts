import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createTriggerDevHttpClient, type TriggerDevProjection } from "../src/index.js";

const projection: TriggerDevProjection = {
  schemaVersion: 1,
  authority: "morpheus",
  projectionKind: "execution-observer",
  targetId: "target_opaque",
  issueId: "issue_opaque",
  runId: "run_opaque",
  generation: 1,
  lane: "preparation",
  status: "running",
  morpheusState: "agent:preparing",
  eventSequence: 1,
  startedAt: "2026-07-25T00:00:00.000Z",
  requiredHumanAction: null,
};

describe("createTriggerDevHttpClient", () => {
  it("uses the documented management endpoints and request envelopes", async () => {
    const requests: Array<{ readonly url: string; readonly init?: RequestInit }> = [];
    const responses = [
      { id: "waitpoint_1", isCached: false, url: "https://callback.invalid" },
      { id: "trigger_run_1" },
      { success: true },
      { success: true },
      { id: "trigger_run_1", status: "FROZEN" },
    ];
    const client = createTriggerDevHttpClient({
      secretKey: "trigger-test-secret",
      fetch: async (url, init) => {
        requests.push({ url: String(url), init });
        return Response.json(responses.shift(), { status: 200 });
      },
    });

    await Effect.runPromise(
      client.createWaitpoint({
        idempotencyKey: "waitpoint-key",
        idempotencyKeyTTL: "30d",
        timeout: "4w",
        tags: ["morpheus:projection"],
      }),
    );
    await Effect.runPromise(
      client.triggerObserver({
        taskIdentifier: "morpheus-execution-observer-v1",
        idempotencyKey: "run-key",
        idempotencyKeyTTL: "30d",
        tags: ["morpheus:projection"],
        payload: { waitpointId: "waitpoint_1", projection },
      }),
    );
    await Effect.runPromise(client.updateRunMetadata("trigger_run_1", projection));
    await Effect.runPromise(client.completeWaitpoint("waitpoint_1", { projection }));
    await Effect.runPromise(client.retrieveRun("trigger_run_1"));

    expect(requests.map(({ url, init }) => [init?.method, url])).toEqual([
      ["POST", "https://api.trigger.dev/api/v1/waitpoints/tokens"],
      ["POST", "https://api.trigger.dev/api/v1/tasks/morpheus-execution-observer-v1/trigger"],
      ["PUT", "https://api.trigger.dev/api/v1/runs/trigger_run_1/metadata"],
      ["POST", "https://api.trigger.dev/api/v1/waitpoints/tokens/waitpoint_1/complete"],
      ["GET", "https://api.trigger.dev/api/v3/runs/trigger_run_1"],
    ]);
    expect(
      requests.map(({ init }) =>
        init?.body === undefined ? undefined : JSON.parse(String(init.body)),
      ),
    ).toEqual([
      {
        idempotencyKey: "waitpoint-key",
        idempotencyKeyTTL: "30d",
        timeout: "4w",
        tags: ["morpheus:projection"],
      },
      {
        payload: { waitpointId: "waitpoint_1", projection },
        options: {
          idempotencyKey: "run-key",
          idempotencyKeyTTL: "30d",
          tags: ["morpheus:projection"],
          metadata: projection,
        },
      },
      { metadata: projection },
      { data: { projection } },
      undefined,
    ]);
    expect(
      requests.every(
        ({ init }) =>
          new Headers(init?.headers).get("Authorization") === "Bearer trigger-test-secret",
      ),
    ).toBe(true);
  });

  it("redacts response bodies and credentials from failures", async () => {
    const client = createTriggerDevHttpClient({
      secretKey: "trigger-private-secret",
      fetch: async () =>
        Response.json(
          {
            error: "private-group/private-project#113 trigger-private-secret",
          },
          { status: 503 },
        ),
    });

    const result = await Effect.runPromise(
      Effect.either(
        client.createWaitpoint({
          idempotencyKey: "waitpoint-key",
          idempotencyKeyTTL: "30d",
          timeout: "4w",
          tags: [],
        }),
      ),
    );

    expect(result._tag).toBe("Left");
    expect(JSON.stringify(result)).toContain("HTTP 503");
    expect(JSON.stringify(result)).not.toContain("private-group");
    expect(JSON.stringify(result)).not.toContain("trigger-private-secret");
  });

  it("aborts a blackholed request after the configured timeout", async () => {
    const client = createTriggerDevHttpClient({
      secretKey: "trigger-private-secret",
      requestTimeoutMs: 10,
      fetch: async (_url, init) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
            once: true,
          });
        }),
    });

    const result = await Effect.runPromise(
      Effect.either(
        client.createWaitpoint({
          idempotencyKey: "waitpoint-key",
          idempotencyKeyTTL: "30d",
          timeout: "4w",
          tags: [],
        }),
      ),
    );

    expect(result._tag).toBe("Left");
    expect(JSON.stringify(result)).toContain("request failed");
    expect(JSON.stringify(result)).not.toContain("trigger-private-secret");
  });

  it("treats a missing retrieved wrapper as a recoverable result", async () => {
    const client = createTriggerDevHttpClient({
      secretKey: "trigger-private-secret",
      fetch: async () => Response.json({ error: "not found" }, { status: 404 }),
    });

    await expect(Effect.runPromise(client.retrieveRun("run_missing"))).resolves.toEqual({
      found: false,
    });
  });
});
