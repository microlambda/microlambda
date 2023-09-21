import { IEnvironment, LockManager } from '@microlambda/remote-state';
import { logger } from './logger';
import { IDeployCmd } from './deploy/cmd-options';
import { IRootConfig } from '@microlambda/config';
import { Project } from '@microlambda/core';
import ora from 'ora';
import { resolveProjectRoot } from '@microlambda/utils';
import { init } from './init';

export const checkIfEnvIsLock = async (
  cmd: IDeployCmd,
  env: IEnvironment,
  project: Project,
  config: IRootConfig,
): Promise<(msg?: string) => Promise<void>> => {
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
  return async (msg?: string): Promise<void> => {
    if (lock) {
      try {
        logger.lf();
        const lockRelease = ora(msg || '🔒 Releasing lock...');
        await lock?.releaseLock();
        lockRelease.succeed('🔒 Lock released !');
      } catch (e) {
        logger.error('Error releasing lock, you probably would have to do it yourself !', e);
        throw e;
      }
    }
  };
};

export const releaseLock = async (env: string, services?: string): Promise<void> => {
  const projectRoot = resolveProjectRoot();
  const { config, project } = await init(projectRoot);
  const lock = new LockManager(config, env, services?.split(',') || [...project.services.keys()]);
  const lockRelease = ora('🔒 Releasing lock...');
  logger.lf();
  try {
    if (await lock.isLocked()) {
      await lock.releaseLock();
      lockRelease.succeed('🔒 Lock released !');
    } else {
      lockRelease.succeed('🔒 Lock already released');
    }
    process.exit(0);
  } catch (e) {
    logger.error('Error releasing lock, you probably would have to do it yourself !', e);
    process.exit(1);
  }
};
