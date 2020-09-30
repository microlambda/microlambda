import { join, parse } from 'path';
import { existsSync } from 'fs';
import { Logger } from './logger';
import chalk from 'chalk';

export const getProjectRoot = (logger: Logger, path?: string): string => {
  try {
    if (!path) {
      path = process.cwd();
    }
    logger.log('project-root').debug('Resolving project root');
    const fileSystemRoot = parse(path).root;
    logger.log('project-root').debug('File system root', fileSystemRoot);
    const checkDepth = (): string => {
      if (path === fileSystemRoot) {
        throw Error('Filesystem root reached');
      }
      logger.log('project-root').debug('Check path', join(path, 'lerna.json'));
      const hasLerna = (): boolean => existsSync(join(path, 'lerna.json'));
      logger.log('project-root').debug('Exists', hasLerna());
      if (hasLerna()) {
        return path;
      }
      process.chdir('..');
      return checkDepth();
    };
    const current = path;
    const projectRoot = checkDepth();
    process.chdir(current);
    return projectRoot;
  } catch (e) {
    logger.log('project-root').error('Cannot find project root. Make sure it is a valid lerna project.');
    console.error(chalk.red('Error: It seems you are not running this command in a valid microlambda project.'));
    console.error(chalk.red('Please check your current directory and try again'));
    process.exit(1);
  }
};
