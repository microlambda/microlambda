/* eslint-disable no-console */
import chalk from 'chalk';
import { ConfigReader } from '@microlambda/core';
import { EventsLog } from "@microlambda/logger";

export const checkStage = (cmd: string): void => {
  const config = new ConfigReader(new EventsLog()).readConfig();
  if (!config.stages?.length) {
    console.warn(chalk.yellow('Info: Allowed stages not given in config, considering every stage valid.'));
    process.exit(0);
  }
  if (config.stages && !config.stages.includes(cmd)) {
    console.info(`\n${chalk.red('✖')} Unknown stage`, cmd);
    process.exit(1);
  }
  console.info(`\n${chalk.green('✔')} Valid stage`, cmd);
  process.exit(0);
};
