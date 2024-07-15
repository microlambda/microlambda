import { join, parse } from 'path';
import { existsSync } from 'fs';
import { MilaError, MilaErrorCode } from '@microlambda/errors';

const findNearest = (fileName: string): string | null => {
  const fileSystemRoot = parse(process.cwd()).root;
  const recursivelyFind = (path: string): string | null => {
    if (path === fileSystemRoot) {
      return null;
    }
    if (existsSync(join(path, fileName))) {
      return path;
    } else {
      return recursivelyFind(join(path, '..'));
    }
  };
  return recursivelyFind(process.cwd());
};

export const resolveProjectRoot = (): string => {
  const manifest = findNearest('package.json');
  if (!manifest) {
    throw new MilaError(
      MilaErrorCode.NOT_IN_VALID_MILA_PROJECT,
      'You are not running mila from a valid NPM project or workspace: package.json not found',
    );
  }
  const pnpmWorkspace = findNearest('pnpm-workspace.yaml');
  if (pnpmWorkspace) {
    return pnpmWorkspace;
  }
  const yarnWorkspace = findNearest('yarn.lock');
  if (yarnWorkspace) {
    return yarnWorkspace;
  }
  throw new MilaError(
    MilaErrorCode.NOT_IN_VALID_MILA_PROJECT,
    'Cannot determine project root, make sure you are in a valid microlambda repository and that a pnpm/yarn install has been performed.',
  );
};
