import { logger } from '../../utils/logger';
import { State } from '@microlambda/remote-state';
import { printAccountInfos } from './list';
import { verifyState } from '../../utils/verify-state';

export const describeEnv = async (name: string): Promise<void> => {
  logger.info('Creating environment');
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
