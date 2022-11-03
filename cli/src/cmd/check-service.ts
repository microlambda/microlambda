import chalk from 'chalk';
import { EventsLog } from '@microlambda/logger';
import { resolveProjectRoot } from '@microlambda/utils';
import { init } from '../utils/init';
import { logger } from '../utils/logger';

export const checkService = async (cmd: string): Promise<void> => {
  const { project } = await init(resolveProjectRoot(), new EventsLog());
  if (!project.services.has(cmd)) {
    logger.info(`\n${chalk.red('✖')} Unknown service`, cmd);
    process.exit(1);
  }
  logger.info(`\n${chalk.green('✔')} Valid service`, cmd);
  process.exit(0);
};
