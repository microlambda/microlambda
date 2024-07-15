import { logger } from '../../utils/logger';
import chalk from 'chalk';
import { State } from '@microlambda/remote-state';
import { verifyState } from '@microlambda/remote-state';
import { printAccountInfos } from '../../utils/account';

export const listEnvs = async (account?: string): Promise<void> => {
  logger.lf();
  logger.info('🔎 Listing deployed environments');
  logger.lf();
  const config = await printAccountInfos(account);
  await verifyState(config, logger);
  const state = new State(config.state.table, config.defaultRegion);
  const envs = await state.listEnvironments();
  if (!envs.length) {
    logger.info('No deployed environments found.');
    logger.lf();
    logger.info(`Run ${chalk.bold.cyan('yarn mila envs create <name>')} to initialize a new environment`);
  } else {
    for (const e of envs) {
      logger.info(`${chalk.white.bold(e.name)} (${chalk.grey(e.regions.join(', '))})`);
    }
  }
};
