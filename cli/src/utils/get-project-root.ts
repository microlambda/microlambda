import { join, parse } from 'path';
import { existsSync } from "fs";
import { log } from './logger';

export const getProjectRoot = (path?: string): string => {
  try {
    console.log(path);
    if (!path) {
      path = process.cwd();
    }
    const fileSystemRoot = parse(path).root;
    console.log(fileSystemRoot);

    const checkDepth = (): string => {
      if (path === fileSystemRoot) {
        throw Error('Filesystem root reached');
      }

      console.log('Check path', join(path, 'lerna.json'));
      const hasLerna = () => existsSync(join(path, 'lerna.json'));
      log('Exists', hasLerna());
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
    console.error('Cannot find project root. Make sure it is a valid lerna project.');
    process.exit(1);
  }
};
