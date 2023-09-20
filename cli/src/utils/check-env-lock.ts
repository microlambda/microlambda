import { IEnvironment, LockManager } from '@microlambda/remote-state';
import { logger } from './logger';
import { IDeployCmd } from './deploy/cmd-options';
import { IRootConfig } from '@microlambda/config';
import { Project } from '@microlambda/core';

export const checkIfEnvIsLock = async (
  cmd: IDeployCmd,
  env: IEnvironment,
  project: Project,
  config: IRootConfig,
): Promise<LockManager | undefined> => {
  let lock: LockManager | undefined;
  if (!cmd.skipLock) {
    lock = new LockManager(config, env.name, cmd.s?.split(',') || [...project.services.keys()]);
    if (await lock.isLocked()) {
      logger.lf();
      logger.info('🔒 Environment is locked. Waiting for the lock to be released');
      await lock.waitLockToBeReleased();
    }
    await lock.lock();
  }
  return lock;
};
