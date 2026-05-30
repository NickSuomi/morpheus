import { describe, expect, it } from "vitest";
import {
  renderDraftReviewArtifact,
  renderReviewArtifact,
  type AgentReadyContract,
} from "../src/index.js";

const contract: AgentReadyContract = {
  category: "task",
  summary: "Create Draft MR before implementation.",
  currentBehavior: "Implementation has not started.",
  desiredBehavior: "Morpheus creates a Draft MR before implementer execution.",
  keyInterfaces: ["WorkspaceRuntime", "MergeRequestClient", "RunLedger"],
  acceptanceCriteria: ["Draft MR exists before agent:running."],
  outOfScope: ["Implementer execution"],
  verificationPlan: ["pnpm check"],
  blockedBy: "None",
  hitlDecisions: "None",
  riskLevel: "medium",
};

const expectFullContract = (output: string): void => {
  expect(output).toContain("Category: task");
  expect(output).toContain("## Summary");
  expect(output).toContain("Create Draft MR before implementation.");
  expect(output).toContain("## Current Behavior");
  expect(output).toContain("Implementation has not started.");
  expect(output).toContain("## Desired Behavior");
  expect(output).toContain("Morpheus creates a Draft MR before implementer execution.");
  expect(output).toContain("## Key Interfaces");
  expect(output).toContain("- WorkspaceRuntime");
  expect(output).toContain("- MergeRequestClient");
  expect(output).toContain("- RunLedger");
  expect(output).toContain("## Acceptance Criteria");
  expect(output).toContain("- Draft MR exists before agent:running.");
  expect(output).toContain("## Out Of Scope");
  expect(output).toContain("- Implementer execution");
  expect(output).toContain("## Verification Plan");
  expect(output).toContain("- pnpm check");
  expect(output).toContain("## Blockers");
  expect(output).toContain("Blocked by: None");
  expect(output).toContain("## HITL Decisions");
  expect(output).toContain("HITL decisions: None");
  expect(output).toContain("## Risk");
  expect(output).toContain("Risk level: medium");
};

describe("ReviewArtifact", () => {
  it("renders every contract field in a pending Draft MR description", () => {
    const output = renderDraftReviewArtifact({
      issueId: "morph-7ky",
      contract,
    });

    expect(output).toContain("# Morpheus Draft Implementation MR");
    expect(output).toContain("Issue: morph-7ky");
    expectFullContract(output);
    expect(output).toContain("Review verdict: pending");
    expect(output).not.toContain("Source issue:");
    expect(output).not.toContain("raw transcript");
  });

  it("renders a GitLab source issue reference when source IID is known", () => {
    const output = renderDraftReviewArtifact({
      issueId: "morph-7ky",
      sourceIssue: {
        iid: 1234,
      },
      contract,
    });

    expect(output).toContain("Source issue: #1234");
  });

  it("renders every contract field plus curated review context without raw transcript section", () => {
    const output = renderReviewArtifact({
      issueId: "morph-kq2",
      contract,
      implementationEvidence: ["Implemented ReviewArtifact renderer."],
      verificationEvidence: ["pnpm --filter @morpheus/core test -- review-artifact.test.ts"],
      reviewVerdict: "blocked",
      reviewFindings: [
        {
          severity: "warning",
          summary: "Follow-up review still pending.",
        },
      ],
      humanChecklist: ["Confirm GitLab MR description matches artifact."],
    });

    expectFullContract(output);
    expect(output).toContain("## Implementation Evidence");
    expect(output).toContain("- Implemented ReviewArtifact renderer.");
    expect(output).toContain("## Verification Evidence");
    expect(output).toContain("- pnpm --filter @morpheus/core test -- review-artifact.test.ts");
    expect(output).toContain("Risk level: medium");
    expect(output).toContain("Review verdict: blocked");
    expect(output).toContain("- [warning] Follow-up review still pending.");
    expect(output).toContain("- Confirm GitLab MR description matches artifact.");
    expect(output).not.toContain("Raw Transcript");
    expect(output).not.toContain("Transcript");
  });
});
