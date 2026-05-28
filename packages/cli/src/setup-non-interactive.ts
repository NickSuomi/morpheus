import { readFileSync } from "node:fs";
import type { SetupPlanningInput } from "@morpheus/runtime";

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

const requiredFlag = (value: string | undefined, flag: string): string => {
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`Missing required non-interactive setup option: ${flag}`);
  }

  return value;
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

export const buildNonInteractiveSetupAnswers = (input: NonInteractiveSetupInput): SetupAnswers => {
  if (input.authSecret !== undefined) {
    throw new Error("Non-interactive setup does not accept secret values.");
  }

  const writeChanges = input.dryRun === true ? false : input.yes === true;

  return {
    gitlabProject: requiredFlag(input.gitlabProject, "--gitlab-project"),
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
    ...(input.build === true ? { buildContainer: true } : { buildContainer: false }),
    ...(input.noBuild === true ? { buildContainer: false } : {}),
    writeChanges,
    runDoctor: writeChanges,
    runSync: false,
  };
};
