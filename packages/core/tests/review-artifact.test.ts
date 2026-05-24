import { describe, expect, it } from "vitest"
import {
  renderDraftReviewArtifact,
  renderReviewArtifact,
  type AgentReadyContract
} from "../src/index.js"

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
  riskLevel: "medium"
}

describe("ReviewArtifact", () => {
  it("renders a pending Draft MR description from the contract", () => {
    const output = renderDraftReviewArtifact({
      issueId: "morph-7ky",
      contract
    })

    expect(output).toContain("# Morpheus Draft Implementation MR")
    expect(output).toContain("Issue: morph-7ky")
    expect(output).toContain("Create Draft MR before implementation.")
    expect(output).toContain("- Draft MR exists before agent:running.")
    expect(output).toContain("- pnpm check")
    expect(output).toContain("Review verdict: pending")
    expect(output).not.toContain("Source issue:")
  })

  it("renders a GitLab source issue reference when source IID is known", () => {
    const output = renderDraftReviewArtifact({
      issueId: "morph-7ky",
      sourceIssue: {
        iid: 1234
      },
      contract
    })

    expect(output).toContain("Source issue: #1234")
  })

  it("renders full curated MR context without raw transcript content", () => {
    const output = renderReviewArtifact({
      issueId: "morph-kq2",
      contract,
      implementationEvidence: ["Implemented ReviewArtifact renderer."],
      verificationEvidence: ["pnpm --filter @morpheus/core test -- review-artifact.test.ts"],
      reviewVerdict: "blocked",
      reviewFindings: [
        {
          severity: "warning",
          summary: "Follow-up review still pending."
        }
      ],
      humanChecklist: ["Confirm GitLab MR description matches artifact."]
    })

    expect(output).toContain("## Implementation Evidence")
    expect(output).toContain("- Implemented ReviewArtifact renderer.")
    expect(output).toContain("## Verification Evidence")
    expect(output).toContain("- pnpm --filter @morpheus/core test -- review-artifact.test.ts")
    expect(output).toContain("Risk level: medium")
    expect(output).toContain("Review verdict: blocked")
    expect(output).toContain("- [warning] Follow-up review still pending.")
    expect(output).toContain("- Confirm GitLab MR description matches artifact.")
    expect(output).not.toContain("raw transcript")
  })
})
