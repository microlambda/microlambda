import Spinnies from 'spinnies';
import { isNodeEvent, isProcessError } from '@microlambda/runner-core';
import { logger } from '../logger';
import chalk from 'chalk';

export const printError = (error: unknown, spinners?: Spinnies, workspace?: string): void => {
  if (isNodeEvent(error)) {
    spinners?.fail(error.workspace.name, {text: `Error compiling ${error.workspace.name}`});
    printError(error.error, spinners, error.workspace.name);
  } else if (isProcessError(error) && error.all) {
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
