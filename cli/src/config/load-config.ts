import { IConfig } from './config';
import fallback from './default.json';
import rc from 'rc';
import chalk from 'chalk';

export const loadConfig: () => IConfig = () => {
  try {
    return rc('microlambda', fallback) as IConfig;
  } catch (e) {
    // TODO: Link to doc
    console.error(chalk.red('Error reading microlambda config.'));
    console.error(chalk.grey(e));
    process.exit(1);
  }
};
