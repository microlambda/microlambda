/* eslint-disable no-console */
import chalk from 'chalk';
import { Logger, RecompilationScheduler } from '@microlambda/core';
import { init } from './start';

export const checkService = async (cmd: string): Promise<void> => {
  const logger = new Logger();
  const { graph } = await init(logger, new RecompilationScheduler(logger));
  if (!graph.getServices().some((s) => s.getName() === cmd)) {
    console.info(`\n${chalk.red('✖')} Unknown service`, cmd);
    process.exit(1);
  }
  console.info(`\n${chalk.green('✔')} Valid service`, cmd);
  process.exit(0);
};
