import { loadConfig } from '../config/load-config';
import chalk from 'chalk';
import ora from 'ora';
import { execSync } from "child_process";
import { getLernaGraph } from '../utils/get-lerna-graph';
import { getProjectRoot } from '../utils/get-project-root';
import { Logger } from '../utils/logger';

export const checkService = async (cmd: string) => {
  const logger = new Logger();
  const config = loadConfig();
  const projectRoot = getProjectRoot(logger);
  let lernaVersion: string;
  try {
    lernaVersion = execSync('npx lerna -v').toString();
    logger.log('lerna').info('Using lerna', lernaVersion);
  } catch (e) {
    logger.log('lerna').warn(chalk.yellow('Warning: Cannot determine lerna version.'));
  }
  const parsingGraph = ora('Parsing lerna dependency graph 🐉').start();
  const graph = await getLernaGraph(projectRoot, null, config, logger, null);
  parsingGraph.succeed();

  if (!graph.getServices().some(s => s.getName() === cmd)) {
    console.error(chalk.red('Unknown service', cmd));
    process.exit(1);
  }
  console.info( `${chalk.green('✔')} Valid service`, cmd);
  process.exit(0);
};

