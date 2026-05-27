import { describe, expect, it } from "vitest";
import { formatConfigSummaryText } from "../src/config-summary.js";

describe("config summary", () => {
  it("shows public container agent config without adapter vocabulary", () => {
    const output = formatConfigSummaryText({
      path: "/repo/morpheus.config.json",
      config: {
        targetRepo: ".",
        issueTracker: { kind: "beads" },
        gitlab: {
          project: "group/project",
          readyLabel: "agent:ready",
          targetBranch: "main",
        },
        daemon: { pollIntervalSeconds: 30 },
        mergeRequests: { kind: "gitlab-glab" },
        agentRunner: {
          kind: "container",
          agent: {
            provider: "codex",
            model: "gpt-5.4-mini",
            effort: "xhigh",
            idleTimeoutSeconds: 1800,
          },
          auth: {
            envFile: ".morpheus/secrets/agent.env",
            requiredKeys: ["OPENAI_API_KEY"],
          },
          container: {
            image: "morpheus-agent:local",
            profile: ".morpheus/container/Dockerfile",
            mounts: [
              {
                hostPath: ".",
                containerPath: "/workspace",
              },
            ],
            setupHooks: ["pnpm install"],
          },
          skills: {
            directory: ".morpheus/skills",
            mappings: [
              {
                name: "caveman",
                path: ".morpheus/skills/caveman/SKILL.md",
              },
              {
                name: "planner",
                path: ".morpheus/skills/planner/SKILL.md",
              },
              {
                name: "tdd",
                path: ".morpheus/skills/tdd/SKILL.md",
              },
              {
                name: "diagnose",
                path: ".morpheus/skills/diagnose/SKILL.md",
              },
            ],
            stageMappings: {
              prepare: ["planner"],
              implement: ["caveman", "tdd"],
              review: ["caveman", "diagnose"],
            },
          },
        },
        ledger: { path: ".morpheus/ledger.sqlite" },
        lanes: {
          preparation: { concurrency: 1 },
          implementation: { concurrency: 1 },
          review: { concurrency: 1 },
        },
        verification: { commands: [] },
        retention: {
          completedIntermediate: {
            keepDays: 14,
            keepLast: 100,
          },
          failed: "manual",
          reviewCandidate: "until-mr-closed-or-manual",
          active: "never",
        },
      },
    });

    expect(output).toContain("agentRunner: container");
    expect(output).toContain(
      "agent: provider=codex model=gpt-5.4-mini effort=xhigh idleTimeoutSeconds=1800",
    );
    expect(output).toContain(
      "auth: envFile=.morpheus/secrets/agent.env requiredKeys=OPENAI_API_KEY",
    );
    expect(output).toContain(
      "container: image=morpheus-agent:local profile=.morpheus/container/Dockerfile mounts=1 setupHooks=1",
    );
    expect(output).toContain(
      "skills: directory=.morpheus/skills mappings=4 names=caveman,planner,tdd,diagnose",
    );
    expect(output).toContain(
      "stageSkills: prepare=planner implement=caveman,tdd review=caveman,diagnose",
    );
    expect(output).not.toContain("Sandcastle");
    expect(output).not.toContain("sandcastle");
  });
});
