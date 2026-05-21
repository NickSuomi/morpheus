import type { MorpheusConfig } from "@morpheus/runtime";

export const formatConfigSummaryText = (input: {
  readonly path: string;
  readonly config: MorpheusConfig;
}): string => {
  const { config } = input;

  return [
    "Morpheus config",
    `path: ${input.path}`,
    `targetRepo: ${config.targetRepo}`,
    `ledger: ${config.ledger.path}`,
    `issueTracker: ${config.issueTracker.kind}`,
    `gitlab: project=${config.gitlab.project} readyLabel=${config.gitlab.readyLabel} targetBranch=${config.gitlab.targetBranch}`,
    `daemon: pollIntervalSeconds=${config.daemon.pollIntervalSeconds}`,
    `mergeRequests: ${config.mergeRequests.kind}`,
    `agentRunner: ${config.agentRunner.kind}`,
    `agent: provider=${config.agentRunner.agent.provider} model=${config.agentRunner.agent.model} effort=${config.agentRunner.agent.effort}`,
    `auth: envFile=${config.agentRunner.auth.envFile} requiredKeys=${config.agentRunner.auth.requiredKeys.join(",")}`,
    `container: image=${config.agentRunner.container.image} profile=${config.agentRunner.container.profile} mounts=${config.agentRunner.container.mounts.length} setupHooks=${config.agentRunner.container.setupHooks.length}`,
    `skills: directory=${config.agentRunner.skills.directory} mappings=${config.agentRunner.skills.mappings.length} names=${config.agentRunner.skills.mappings.map((skill) => skill.name).join(",")}`,
    `lanes: preparation=${config.lanes.preparation.concurrency} implementation=${config.lanes.implementation.concurrency} review=${config.lanes.review.concurrency}`,
  ].join("\n");
};
