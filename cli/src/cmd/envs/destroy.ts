import { logger } from '../../utils/logger';
import { printAccountInfos } from './list';
import { verifyState } from '../../utils/verify-state';
import { State } from '@microlambda/remote-state/lib/models/state';
import { LockManager } from '@microlambda/remote-state';
import { getDependenciesGraph } from '../../utils/parse-deps-graph';
import { resolveProjectRoot } from '@microlambda/utils';

export const destroyEnv = async (name : string) => {
  logger.info('Preparing to destroy environment');
  logger.lf();
  const config = await printAccountInfos();
  await verifyState(config);
  const state = new State(config);
  const env = await state.findEnv(name);
  if (!env) {
    logger.error(`Environment not found: ${name}`);
    process.exit(1);
  }
  const services = await state.listServices(name);
  if (services.length) {
    logger.error('There is still services up and running uin environment', name);
    logger.info('Run yarn mila destroy -e dev to destroy this services before removing env');
    process.exit(1);
  }
  const allServices = (await getDependenciesGraph(resolveProjectRoot())).services.keys();
  const lock = new LockManager(config, name, [...allServices]);
  if (await lock.isLocked()) {
    logger.error('Environment is locked, a deploy is probably in progress... aborting.');
    process.exit(1);
  }
  await lock.lock();
  await state.removeEnv(name);
  await lock.releaseLock();
  logger.success('Successfully destroyed');
}
