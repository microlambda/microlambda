import { IEnvironment, LockManager } from '@microlambda/remote-state';
import { getStateConfig, IStateConfig } from '@microlambda/config';
import { Project } from './graph/project';
import ora from 'ora';
import { resolveProjectRoot } from '@microlambda/utils';
import { init } from './init';
import { IBaseLogger } from '@microlambda/types';
import * as process from 'process';

export const checkIfEnvIsLock = async (
  cmd: { skipLock: boolean; s?: string },
  env: IEnvironment,
  project: Project,
  config: IStateConfig,
  logger?: IBaseLogger,
): Promise<(msg?: string) => Promise<void>> => {
  let lock: LockManager | undefined;
  if (!cmd.skipLock) {
    lock = new LockManager(
      config.state.table,
      config.defaultRegion,
      env.name,
      cmd.s?.split(',') || [...project.services.keys()],
    );
    if (await lock.isLocked()) {
      logger?.info('🔒 Environment is locked. Waiting for the lock to be released');
      await lock.waitLockToBeReleased();
    }
    await lock.lock();
  }
  return async (msg?: string): Promise<void> => {
    if (lock) {
      try {
        if (logger) process.stdout.write('\n');
        const lockRelease = ora(msg || '🔒 Releasing lock...');
        await lock?.releaseLock();
        lockRelease.succeed('🔒 Lock released !');
      } catch (e) {
        logger?.error('Error releasing lock, you probably would have to do it yourself !', e);
        throw e;
      }
    }
  };
};

export const releaseLock = async (
  options: {
    env: string;
    account?: string;
    services?: string;
  },
  logger?: IBaseLogger,
): Promise<void> => {
  const projectRoot = resolveProjectRoot();
  const { config, project } = await init(projectRoot);
  const stateConfig = getStateConfig(config, options.account);
  const lock = new LockManager(
    stateConfig.state.table,
    stateConfig.defaultRegion,
    options.env,
    options.services?.split(',') || [...project.services.keys()],
  );
  const lockRelease = logger ? ora('🔒 Releasing lock...') : undefined;
  if (logger) process.stdout.write('\n');
  try {
    if (await lock.isLocked()) {
      await lock.releaseLock();
      lockRelease?.succeed('🔒 Lock released !');
    } else {
      lockRelease?.succeed('🔒 Lock already released');
    }
    process.exit(0);
  } catch (e) {
    logger?.error('Error releasing lock, you probably would have to do it yourself !', e);
    process.exit(1);
  }
};

export const releaseLockOnProcessExit = (release: (msg?: string) => Promise<void>, logger?: IBaseLogger): void => {
  process.on('SIGINT', async () => {
    try {
      await release('🔒 SIGINT received, releasing lock...');
      process.exit(0);
    } catch (e) {
      logger?.error('Error releasing lock, you probably would have to do it yourself !');
      process.exit(2);
    }
  });
};
