import { loadEnv, resolveProjectRoot } from '@microlambda/utils';
import { MilaError } from '@microlambda/errors';
import { logger } from './logger';
import chalk from 'chalk';

export const commandWrapper = async (fn: () => Promise<void> | void, keepOpen = false): Promise<void> => {
  try {
    const projectRoot = resolveProjectRoot();
    loadEnv(projectRoot);
    await fn();
    if (!keepOpen) {
      process.exit(0);
    }
  } catch (e) {
    if (e instanceof MilaError) {
      logger.lf();
      logger.error(chalk.bgRed.white(`[${e.code}]`), e.message);
      logger.error(e.stack);
      if (e.originalError) {
        logger.error('Details :', e.originalError);
      }
    } else {
      logger.lf();
      logger.error('Uncaught error :', e);
    }
    process.exit(1);
  }
};
