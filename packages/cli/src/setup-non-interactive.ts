import { readFileSync } from "node:fs";
import type { SetupPlan, SetupPlanningInput } from "@morpheus/runtime";

type SetupAnswers = NonNullable<SetupPlanningInput["answers"]>;

export type NonInteractiveSetupInput = {
  readonly target?: string;
  readonly yes?: boolean;
  readonly dryRun?: boolean;
  readonly noBuild?: boolean;
  readonly build?: boolean;
  readonly noSync?: boolean;
  readonly once?: boolean;
  readonly gitlabProject?: string;
  readonly targetBranch?: string;
  readonly gitlabReadyLabel?: string;
  readonly authEnvFile?: string;
  readonly requiredAuthKey?: readonly string[];
  readonly containerImage?: string;
  readonly containerProfile?: string;
  readonly verificationCommand?: readonly string[];
  readonly pollIntervalSeconds?: number;
  readonly authSecret?: string;
  readonly requiredAuthKeys?: readonly string[];
  readonly verificationCommands?: readonly string[];
};

const normalizeList = (
  repeated: readonly string[] | undefined,
  fromConfig: readonly string[] | undefined,
): readonly string[] | undefined => {
  const values = repeated ?? fromConfig;
  if (values === undefined) {
    return undefined;
  }

  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
};

export const readSetupConfigInput = (path: string): NonInteractiveSetupInput => {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as NonInteractiveSetupInput;

  return parsed;
};

export const setupPlanWantsContainerBuild = (plan: Pick<SetupPlan, "prompts">): boolean =>
  plan.prompts.some((prompt) => prompt.id === "containerBuild" && prompt.value === true);

export const buildNonInteractiveSetupAnswers = (input: NonInteractiveSetupInput): SetupAnswers => {
  const writeChanges = input.dryRun === true ? false : input.yes === true;

  return {
    ...(input.gitlabProject === undefined ? {} : { gitlabProject: input.gitlabProject }),
    ...(input.targetBranch === undefined ? {} : { targetBranch: input.targetBranch }),
    ...(input.gitlabReadyLabel === undefined ? {} : { readyLabel: input.gitlabReadyLabel }),
    ...(input.authEnvFile === undefined ? {} : { authEnvFile: input.authEnvFile }),
    ...(normalizeList(input.requiredAuthKey, input.requiredAuthKeys) === undefined
      ? {}
      : { requiredAuthKeys: normalizeList(input.requiredAuthKey, input.requiredAuthKeys) }),
    ...(input.containerImage === undefined ? {} : { containerImage: input.containerImage }),
    ...(input.containerProfile === undefined ? {} : { containerProfile: input.containerProfile }),
    ...(normalizeList(input.verificationCommand, input.verificationCommands) === undefined
      ? {}
      : {
          verificationCommands: normalizeList(
            input.verificationCommand,
            input.verificationCommands,
          ),
        }),
    ...(input.pollIntervalSeconds === undefined
      ? {}
      : { pollIntervalSeconds: input.pollIntervalSeconds }),
    ...(input.build === true ? { buildContainer: true } : {}),
    ...(input.noBuild === true ? { buildContainer: false } : {}),
    writeChanges,
    runDoctor: writeChanges,
    runSync: false,
  };
};
