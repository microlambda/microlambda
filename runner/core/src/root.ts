import { join, parse } from 'path';
import { existsSync } from 'fs';
import { CentipodError, CentipodErrorCode } from './error';

export const resolveProjectRoot = (): string => {
  const root = parse(process.cwd()).root;
  const recursivelyFind = (path: string): string => {
    if (path === root) {
      throw new CentipodError(CentipodErrorCode.NOT_IN_VALID_YARN_PROJECT, 'Not in a valid yarn project');
    }
    if (existsSync(join(path, 'yarn.lock'))) {
      return path;
    } else {
      return recursivelyFind(join(path, '..'));
    }
  };
  return recursivelyFind(process.cwd());
};
