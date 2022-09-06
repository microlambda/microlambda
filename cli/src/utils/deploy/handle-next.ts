import { DeployEvent } from '@microlambda/core';
import Spinnies from 'spinnies';
import { RunCommandEventEnum } from '@microlambda/runner-core';
import chalk from 'chalk';
import { logger } from '../logger';

export const handleNext = (
  evt: DeployEvent,
  spinnies: Spinnies,
  failures: Set<DeployEvent>,
  actions: Set<DeployEvent>,
  verbose: boolean,
  action: 'deploy' | 'remove',
): void => {
  const key = (service: string, evt: DeployEvent): string => `${service}|${evt.region}`;
  const actionVerbBase = action === 'deploy' ? 'deploy' : 'remov';
  const isTty = process.stdout.isTTY;
  const capitalize = (input: string): string => input.slice(0, 1).toUpperCase() + input.slice(1);
  switch (evt.type) {
    case RunCommandEventEnum.NODE_STARTED:
      if (isTty) {
        spinnies.add(key(evt.workspace.name, evt), {
          text: `${capitalize(actionVerbBase)}ing ${evt.workspace.name} ${chalk.magenta(`[${evt.region}]`)}`,
        });
      } else {
        logger.info(`${chalk.bold(evt.workspace.name)} ${actionVerbBase}ing ${chalk.magenta(`[${evt.region}]`)}`);
      }
      break;
    case RunCommandEventEnum.NODE_PROCESSED:
      if (isTty) {
        if (spinnies.pick(key(evt.workspace.name, evt))) {
          spinnies.succeed(key(evt.workspace.name, evt), {
            text: `${capitalize(actionVerbBase)}ed ${evt.workspace.name} ${chalk.magenta(`[${evt.region}]`)}`,
          });
        }
      } else {
        logger.info(
          `${chalk.bold(evt.workspace.name)} - Successfully ${actionVerbBase}ed ${chalk.magenta(`[${evt.region}]`)}`,
        );
      }
      actions.add(evt);
      break;
    case RunCommandEventEnum.NODE_ERRORED:
      failures.add(evt);
      if (isTty) {
        if (spinnies.pick(key(evt.workspace.name, evt))) {
          spinnies.fail(key(evt.workspace.name, evt), {
            text: `Error ${actionVerbBase}ing ${evt.workspace.name} ! ${chalk.magenta(`[${evt.region}]`)}`,
          });
        }
      } else {
        logger.info(
          `${chalk.bold(evt.workspace.name)} - ${capitalize(action)} failed ${chalk.magenta(`[${evt.region}]`)}`,
        );
      }
  }
};
