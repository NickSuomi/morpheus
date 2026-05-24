import { describe, expect, it } from "vitest";
import {
  decodeAgentReadyContract,
  validateAfkReadyContract,
  type AgentReadyContract,
} from "../src/index.js";

const validContract: AgentReadyContract = {
  category: "task",
  summary: "Persist contracts in Beads metadata.",
  currentBehavior: "Morpheus reads issue prose only.",
  desiredBehavior: "Morpheus stores typed contract metadata.",
  keyInterfaces: ["IssueTracker.readContract", "IssueTracker.writeContract"],
  acceptanceCriteria: ["Valid contracts round-trip through Beads metadata."],
  outOfScope: ["GitLab MR rendering"],
  verificationPlan: ["pnpm check"],
  blockedBy: "None",
  hitlDecisions: "None",
  riskLevel: "medium",
};

describe("AgentReadyContract", () => {
  it("decodes a valid contract", () => {
    expect(decodeAgentReadyContract(validContract)).toEqual({
      status: "valid",
      contract: validContract,
    });
  });

  it("rejects missing required fields", () => {
    const { summary: _summary, ...contract } = validContract;

    expect(decodeAgentReadyContract(contract)).toMatchObject({
      status: "invalid",
    });
  });

  it("rejects invalid risk levels", () => {
    expect(
      decodeAgentReadyContract({
        ...validContract,
        riskLevel: "severe",
      }),
    ).toMatchObject({
      status: "invalid",
    });
  });

  it("requires no blockers or HITL decisions for AFK-ready contracts", () => {
    expect(validateAfkReadyContract(validContract)).toEqual({
      status: "valid",
      contract: validContract,
    });

    expect(
      validateAfkReadyContract({
        ...validContract,
        blockedBy: "Needs product decision",
      }),
    ).toEqual({
      status: "invalid",
      message: "blockedBy must be None: Needs product decision",
    });

    expect(
      validateAfkReadyContract({
        ...validContract,
        hitlDecisions: "Pick target API",
      }),
    ).toEqual({
      status: "invalid",
      message: "hitlDecisions must be None: Pick target API",
    });
  });
});
