import { loadConfig } from '../config/load-config';
import chalk from 'chalk';

export const checkStage = (cmd: string) => {
  const config = loadConfig();
  if (!config.stages) {
    console.warn(chalk.yellow('Info: Allowed stages not given in config, considering every stage valid.'))
  }
  if (config.stages && !config.stages.includes(cmd)) {
    console.error(chalk.red('Unknown stage', cmd));
    process.exit(1);
  }
  console.info( `${chalk.green('✔')} Valid stage`, cmd);
  process.exit(0);
};
