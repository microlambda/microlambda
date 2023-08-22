import { isNodeEvent, isProcessError } from '@microlambda/runner-core';
import { logger } from '../logger';
import chalk from 'chalk';
import { MilaSpinnies } from '../spinnies';

export const printError = (error: unknown, spinners: MilaSpinnies, workspace?: string): void => {
  if (isNodeEvent(error)) {
    spinners.fail(error.target.workspace.name, `Error compiling ${error.target.workspace.name}`);
    printError(error.error, spinners, error.target.workspace.name);
  } else if (isProcessError(error) && error.all && spinners.stdio !== 'inherit') {
    if (workspace) {
      logger.error(`${chalk.bold.red(`Command ${error.command} failed for workspace ${workspace} :`)}\n`);
    } else {
      logger.error(`${chalk.bold.red(`Command ${error.command} failed :`)}\n`);
    }
    logger.error(error.all);
  } else {
    logger.error(error);
  }
};
