import { RunCommandEventEnum } from '@microlambda/runner-core';
import chalk from 'chalk';
import { MilaSpinnies } from '../spinnies';
import {DeployEvent} from "./print-report";

export const handleNext = (
  evt: DeployEvent,
  spinnies: MilaSpinnies,
  failures: Set<DeployEvent>,
  actions: Set<DeployEvent>,
  verbose: boolean | undefined,
  action: 'deploy' | 'remove',
): void => {
  const key = (service: string, evt: DeployEvent): string => `${service}|${evt.region}`;
  const actionVerbBase = action === 'deploy' ? 'deploy' : 'remov';
  const capitalize = (input: string): string => input.slice(0, 1).toUpperCase() + input.slice(1);
  switch (evt.type) {
    case RunCommandEventEnum.NODE_STARTED:
      spinnies.add(
        key(evt.target.workspace.name, evt),
        `${capitalize(actionVerbBase)}ing ${evt.target.workspace.name} ${chalk.magenta(`[${evt.region}]`)}`,
      );
      break;
    case RunCommandEventEnum.NODE_PROCESSED:
      spinnies.succeed(
        key(evt.target.workspace.name, evt),
        `${capitalize(actionVerbBase)}ed ${evt.target.workspace.name} ${chalk.magenta(`[${evt.region}]`)}`,
      );
      actions.add(evt);
      break;
    case RunCommandEventEnum.NODE_ERRORED:
      failures.add(evt);
      spinnies.fail(
        key(evt.target.workspace.name, evt),
        `Error ${actionVerbBase}ing ${evt.target.workspace.name} ! ${chalk.magenta(`[${evt.region}]`)}`,
      );
      break;
  }
};
