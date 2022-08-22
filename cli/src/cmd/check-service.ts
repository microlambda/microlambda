import chalk from 'chalk';
import { EventsLog } from '@microlambda/logger';
import { init } from './start';

export const checkService = async (cmd: string): Promise<void> => {
  const logger = new EventsLog();
  const { project } = await init(logger);
  if (!project.services.has(cmd)) {
    console.info(`\n${chalk.red('✖')} Unknown service`, cmd);
    process.exit(1);
  }
  console.info(`\n${chalk.green('✔')} Valid service`, cmd);
  process.exit(0);
};
