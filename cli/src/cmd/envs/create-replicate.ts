import { logger } from '../../utils/logger';
import { printAccountInfos } from './list';
import { verifyState } from '../../utils/verify-state';
import { regions } from '@microlambda/config';
import { LockManager, State } from '@microlambda/remote-state';

export const createReplicate = async (env: string, region: string) => {
  logger.info('Creating regional replicate for', env);
  logger.lf();
  const config = await printAccountInfos();
  await verifyState(config);
  if (!regions.includes(region)) {
    logger.error('Invalid region', region);
    logger.error('Valid regions are', regions.join(', '));
    process.exit(1);
  }
  const state = new State(config);
  const lock = new LockManager(config);
  const environment = await state.findEnv(env);
  if (!environment) {
    logger.error('Environment not found', env);
    process.exit(1);
  }
  if (environment.regions.includes(region)) {
    logger.warn('Environment is already replicated in region', region);
    process.exit(2);
  }
  if (await lock.isLocked(env)) {
    logger.error('Environment is locked, a deploy is probably in progress... aborting.');
    process.exit(1);
  }
  await lock.lock(env);
  await state.createReplicate(env, region);
  await lock.releaseLock(env);
  logger.success('Replicate order created. On next deploy, environment resources will be replicated in', region);
  logger.success(`Run yarn mila deploy -e ${env} to create new resources on AWS Cloud`);
  process.exit(0);
}
