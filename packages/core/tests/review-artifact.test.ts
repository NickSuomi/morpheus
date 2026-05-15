import { describe, expect, it } from "vitest"
import { renderDraftReviewArtifact, type AgentReadyContract } from "../src/index.js"

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
    expect(output).toContain("Draft MR created before implementer agent execution.")
  })
})
