import chalk from 'chalk';
import { ConfigReader } from '../config/read-config';
import { Logger } from '../utils/logger';

export const checkStage = (cmd: string) => {
  const config = new ConfigReader(new Logger()).readConfig();
  if (!config.stages) {
    console.warn(chalk.yellow('Info: Allowed stages not given in config, considering every stage valid.'))
  }
  if (config.stages && !config.stages.includes(cmd)) {
    console.info( `\n${chalk.red('✖')} Unknown stage`, cmd);
    process.exit(1);
  }
  console.info( `\n${chalk.green('✔')} Valid stage`, cmd);
  process.exit(0);
};
