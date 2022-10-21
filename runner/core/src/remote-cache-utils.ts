import { execSync } from 'child_process';
import { MilaError, MilaErrorCode } from '@microlambda/errors';

export const currentSha1 = (rootFolder?: string): string => {
  try {
    return execSync('git rev-parse HEAD', { cwd: rootFolder }).toString().trim();
  } catch (e) {
    throw new MilaError(MilaErrorCode.BAD_REVISION, 'Could not determine current revision for remote caching', e);
  }
}

export const checkWorkingDirectoryClean = (rootFolder?: string): void => {
  const status = execSync('git status --porcelain', { cwd: rootFolder }).toString();
  if (!!status) {
    throw new MilaError(MilaErrorCode.WORKING_DIRECTORY_NOT_CLEAN, 'Working directory is not clean, please commit or stash changes before proceeding. You can only use remote caching on a clean git state');
  }
}
