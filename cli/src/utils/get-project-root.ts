/* eslint-disable no-console */
import { join, parse } from 'path';
import { existsSync } from 'fs';
import { Logger } from './logger';
import chalk from 'chalk';
import { MilaError, MilaErrorCode } from './errors';

export const findProjectRoot = (): string => {
  const root = parse(process.cwd()).root;
  const recursivelyFind = (path: string): string => {
    if (path === root) {
      throw new MilaError(MilaErrorCode.NOT_IN_A_VALID_LERNA_PROJECT);
    }
    if (existsSync(join(path, 'lerna.json'))) {
      return path;
    } else {
      return recursivelyFind(join(path, '..'));
    }
  };
  return recursivelyFind(process.cwd());
};

export const getProjectRoot = (logger: Logger): string => {
  try {
    return findProjectRoot();
  } catch (e) {
    logger.log('project-root').error('Cannot find project root. Make sure it is a valid lerna project.');
    logger.log('project-root').error(e);
    if (e instanceof MilaError) {
      console.error(chalk.red(e.message));
    } else {
      console.error(chalk.red('Cannot find project root'));
      console.error(chalk.red(e));
    }
    process.exit(1);
  }
};
