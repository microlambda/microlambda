import chalk from 'chalk';
import { resolveProjectRoot } from '@microlambda/utils';
import { logger } from '../utils/logger';
import { init } from '@microlambda/core';

export const checkService = async (cmd: string): Promise<void> => {
  const { project } = await init(resolveProjectRoot(), logger);
  if (!project.services.has(cmd)) {
    logger.info(`\n${chalk.red('✖')} Unknown service`, cmd);
    process.exit(1);
  }
  logger.info(`\n${chalk.green('✔')} Valid service`, cmd);
  process.exit(0);
};
