import { join, parse } from 'path';
import { existsSync } from 'fs';
import { log } from './logger';

export const getProjectRoot = (path?: string): string => {
  try {
    if (!path) {
      path = process.cwd();
    }
    log('project-root').debug('Resolving project root');
    const fileSystemRoot = parse(path).root;
    log('project-root').debug('File system root', fileSystemRoot);
    const checkDepth = (): string => {
      if (path === fileSystemRoot) {
        throw Error('Filesystem root reached');
      }
      log('project-root').debug('Check path', join(path, 'lerna.json'));
      const hasLerna = (): boolean => existsSync(join(path, 'lerna.json'));
      log('project-root').debug('Exists', hasLerna());
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
    log('project-root').error('Cannot find project root. Make sure it is a valid lerna project.');
    process.exit(1);
  }
};
