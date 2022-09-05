import { isNodeEvent, isProcessError } from '@microlambda/runner-core';
import chalk from 'chalk';
import { logger } from './logger';

export const printError = (error: unknown): void => {
  if (isNodeEvent(error)) {
    logger.lf();
    printError(error.error);
  } else if (isProcessError(error) && !!error.all) {
    logger.lf();
    logger.info(chalk.cyan('>'), error.command);
    logger.lf();
    logger.info(error.all);
  } else {
    logger.error(error);
  }
};
