import { isDaemon, isNodeSucceededEvent, RunCommandEvent, RunCommandEventEnum } from '@microlambda/runner-core';
import { logger } from '../logger';
import chalk from 'chalk';
import { printError } from '../print-process-error';

export type DeployEvent = RunCommandEvent & { region: string };

export const printReport = async (
  actions: Set<DeployEvent | RunCommandEvent>,
  failures: Set<DeployEvent | RunCommandEvent>,
  total: number,
  action: 'deploy' | 'remove' | 'package' | 'test',
  verbose = false,
): Promise<void> => {
  if (failures.size) {
    logger.error(chalk.underline(chalk.bold('\n▼ Error summary\n')));
  }
  const getActionVerbBase = (action: 'deploy' | 'remove' | 'package' | 'test'): string => {
    switch (action) {
      case 'remove':
        return 'remov';
      case 'package':
        return 'packag';
      default:
        return action;
    }
  };
  const actionVerbBase = getActionVerbBase(action);
  let i = 0;
  for (const evt of failures) {
    i++;
    const region = (evt as DeployEvent).region;
    if (region && evt.type !== RunCommandEventEnum.TARGETS_RESOLVED) {
      logger.error(
        chalk.bold(
          chalk.red(
            `#${i} - Failed to ${action} ${
              (evt as { workspace?: { name: string } }).workspace?.name
            } in ${region} region\n`,
          ),
        ),
      );
    } else {
      logger.error(
        chalk.bold(
          chalk.red(`#${i} - Failed to ${action} ${(evt as { workspace?: { name: string } }).workspace?.name}\n`),
        ),
      );
    }

    if ((evt as { error: unknown }).error) {
      logger.error(chalk.bold(`#${i} - Error details:`));
      printError((evt as { error: unknown }).error);
      logger.lf();
    }
  }
  logger.info(chalk.underline(chalk.bold('▼ Execution summary\n')));
  if (verbose) {
    let i = 0;
    i++;
    for (const action of actions) {
      if (
        (action as DeployEvent).region &&
        action.type !== RunCommandEventEnum.TARGETS_RESOLVED &&
        action.type !== RunCommandEventEnum.SOURCES_CHANGED
      ) {
        logger.info(
          chalk.bold(
            `#${i} - Successfully ${actionVerbBase}ed ${action.workspace.name} in ${
              (action as DeployEvent).region
            } region\n`,
          ),
        );
      } else if (
        action.type !== RunCommandEventEnum.TARGETS_RESOLVED &&
        action.type !== RunCommandEventEnum.SOURCES_CHANGED
      ) {
        logger.info(chalk.bold(`#${i} - Successfully ${actionVerbBase}ed ${action.workspace.name}\n`));
      }
      if (isNodeSucceededEvent(action)) {
        action.result.commands.forEach((result) => {
          if (!isDaemon(result)) {
            logger.info(chalk.grey('> ' + result.command));
            logger.info(result.all);
          }
        });
      }
    }
  }
  logger.info(`Successfully ${actionVerbBase}ed ${total - failures.size}/${total} stacks`);
  logger.info(`Error occurred when ${actionVerbBase}ing ${failures.size} stacks\n`);
  if (failures.size) {
    logger.error(chalk.red('Process exited with errors'));
  } else {
    logger.error(chalk.green('Process exited without errors'));
  }
};
