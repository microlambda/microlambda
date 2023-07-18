import { join, parse } from 'path';
import { existsSync } from 'fs';
import { MilaError, MilaErrorCode } from '@microlambda/errors';

export const resolveProjectRoot = (): string => {
  const root = parse(process.cwd()).root;
  const recursivelyFind = (path: string): string => {
    if (path === root) {
      throw new MilaError(
        MilaErrorCode.NOT_IN_VALID_YARN_PROJECT,
        'Cannot determine project root, make sure an yarn install has been performed.',
      );
    }
    if (existsSync(join(path, 'yarn.lock'))) {
      return path;
    } else {
      return recursivelyFind(join(path, '..'));
    }
  };
  return recursivelyFind(process.cwd());
};
