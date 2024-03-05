import { logger } from '../../utils/logger';
import { State, verifyState } from '@microlambda/remote-state';
import { printAccountInfos } from '../../utils/account';

export const describeEnv = async (name: string, account?: string): Promise<void> => {
  logger.lf();
  logger.info('🔎 Describing environment', name);
  logger.lf();
  const config = await printAccountInfos(account);
  await verifyState(config, logger);
  const state = new State(config.state.table, config.defaultRegion);
  const env = await state.findEnv(name);
  if (!env) {
    logger.error(`Environment not found: ${name}`);
    process.exit(1);
  }
  const services = await state.listServices(name);
  if (!services.length) {
    logger.warn('No service deployed on', name);
    logger.warn('Run yarn mila deploy -e dev to perform a first deployment');
    process.exit(0);
  }
  services.forEach((s) => {
    logger.info(s.name);
    logger.info(s.checksums_buckets);
    logger.info(s.checksums_key);
    logger.info(s.region);
    logger.info(s.sha1);
  });
};
