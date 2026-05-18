import { describe, expect, it } from "vitest";
import { Effect, Either, Layer } from "effect";
import {
  listRunsForCli,
  RunLedger,
  RunLedgerLogsNotFoundError,
  RunLedgerNotFoundError,
  showRunForCli,
  showRunLogsForCli,
  pruneRunsForCli,
  type RunLedgerService,
  type RunSummary,
} from "../src/index.js";

const run: RunSummary = {
  id: "run_01KRGGDQ6JQN2GMD6KJQ5SFXR6",
  issueId: "morph-7o3",
  lane: "preparation",
  status: "failed",
  summary: "Record fake preparation run in RunLedger",
  startedAt: "2026-05-13T11:09:18.418Z",
  endedAt: "2026-05-13T11:09:19.418Z",
  failureKind: "agent_contract_error",
  transcriptPath: "/tmp/.morpheus/runs/run_01KRGGDQ6JQN2GMD6KJQ5SFXR6/transcript.txt",
};

const fakeLedger = (overrides: Partial<RunLedgerService> = {}): Layer.Layer<RunLedger> =>
  Layer.succeed(RunLedger, {
    createPreparationRun: () => Effect.succeed(run),
    createImplementationRun: () => Effect.succeed({ ...run, lane: "implementation" }),
    createReviewRun: () => Effect.succeed({ ...run, lane: "review" }),
    recordImplementationWorkspace: () => Effect.succeed(run),
    recordMergeRequest: () => Effect.succeed(run),
    finishRun: () => Effect.succeed(run),
    writeRunArtifacts: () => Effect.succeed(run),
    getRunLogs: () =>
      Effect.succeed({
        runId: run.id,
        transcriptPath: run.transcriptPath ?? "",
        transcript: "fake preparation transcript",
      }),
    getRunArtifact: () =>
      Effect.succeed({
        runId: run.id,
        artifactPath: run.artifactPath ?? "",
        artifact: "{}",
      }),
    listRuns: () => Effect.succeed([run]),
    getRun: () => Effect.succeed(run),
    getRunEvents: () =>
      Effect.succeed([
        {
          sequence: 1,
          runId: run.id,
          type: "PreparationStarted",
          occurredAt: "2026-05-13T11:09:18.418Z",
        },
        {
          sequence: 2,
          runId: run.id,
          type: "RunArtifactsWritten",
          occurredAt: "2026-05-13T11:09:18.818Z",
          message: "Transcript and artifact written.",
        },
        {
          sequence: 3,
          runId: run.id,
          type: "PreparationFailed",
          occurredAt: "2026-05-13T11:09:19.418Z",
          message: "Fake preparation could not produce a valid contract.",
        },
      ]),
    pruneRuns: (input) =>
      Effect.succeed({
        applied: input.apply,
        eligibleRuns: [
          {
            runId: run.id,
            issueId: run.issueId,
            lane: run.lane,
            status: run.status,
            artifactPaths: [run.transcriptPath ?? ""].filter(Boolean),
            artifactBytes: 27,
            reason: input.reason,
          },
        ],
        totalArtifactBytes: 27,
      }),
    ...overrides,
  });

const runWithLedger = <A, E>(
  program: Effect.Effect<A, E, RunLedger>,
  overrides: Partial<RunLedgerService> = {},
) => Effect.runPromise(program.pipe(Effect.provide(fakeLedger(overrides))));

const runEitherWithLedger = <A, E>(
  program: Effect.Effect<A, E, RunLedger>,
  overrides: Partial<RunLedgerService> = {},
) => Effect.runPromise(Effect.either(program).pipe(Effect.provide(fakeLedger(overrides))));

describe("RunLedger CLI rendering", () => {
  it("renders an empty run list", async () => {
    await expect(
      runWithLedger(listRunsForCli, {
        listRuns: () => Effect.succeed([]),
      }),
    ).resolves.toBe("No Morpheus runs");
  });

  it("renders run summaries", async () => {
    await expect(runWithLedger(listRunsForCli)).resolves.toContain(
      `${run.id} morph-7o3 preparation failed Record fake preparation run in RunLedger`,
    );
  });

  it("renders one run with events and failure kind", async () => {
    const output = await runWithLedger(showRunForCli(run.id));

    expect(output).toContain(`Run ${run.id}`);
    expect(output).toContain("failureKind: agent_contract_error");
    expect(output).toContain("1. PreparationStarted");
    expect(output).toContain("2. RunArtifactsWritten - Transcript and artifact written.");
    expect(output).toContain(
      "3. PreparationFailed - Fake preparation could not produce a valid contract.",
    );
  });

  it("renders run logs", async () => {
    await expect(runWithLedger(showRunLogsForCli(run.id))).resolves.toBe(
      "fake preparation transcript",
    );
  });

  it("renders prune dry-run output", async () => {
    await expect(
      runWithLedger(
        pruneRunsForCli({
          apply: false,
          policy: {
            completedIntermediate: { keepDays: 14, keepLast: 100 },
            failed: "manual",
            reviewCandidate: "until-mr-closed-or-manual",
            active: "never",
          },
          prunedBy: "operator",
          reason: "operator dry-run",
        }),
      ),
    ).resolves.toContain(`${run.id} morph-7o3 preparation failed artifacts=1 bytes=27`);
    await expect(
      runWithLedger(
        pruneRunsForCli({
          apply: false,
          policy: {
            completedIntermediate: { keepDays: 14, keepLast: 100 },
            failed: "manual",
            reviewCandidate: "until-mr-closed-or-manual",
            active: "never",
          },
          prunedBy: "operator",
          reason: "operator dry-run",
        }),
      ),
    ).resolves.toContain(`artifact: ${run.transcriptPath}`);
  });

  it("throws typed messages for missing run data", async () => {
    const missingRun = await runEitherWithLedger(showRunForCli(run.id), {
      getRun: () => Effect.succeed(undefined),
    });

    expect(Either.isLeft(missingRun)).toBe(true);
    if (Either.isLeft(missingRun)) {
      expect(missingRun.left).toMatchObject(new RunLedgerNotFoundError({ runId: run.id }));
    }

    const missingLogs = await runEitherWithLedger(showRunLogsForCli(run.id), {
      getRunLogs: () => Effect.fail(new RunLedgerLogsNotFoundError({ runId: run.id })),
    });

    expect(Either.isLeft(missingLogs)).toBe(true);
    if (Either.isLeft(missingLogs)) {
      expect(missingLogs.left).toMatchObject(new RunLedgerLogsNotFoundError({ runId: run.id }));
    }
  });
});
