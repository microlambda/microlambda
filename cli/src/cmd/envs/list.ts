import { logger } from '../../utils/logger';
import chalk from 'chalk';
import { State } from '@microlambda/remote-state';
import { aws } from '@microlambda/aws';
import { resolveProjectRoot } from '@microlambda/utils';
import { ConfigReader, IRootConfig } from '@microlambda/config';
import { verifyState } from '@microlambda/core';

export const printAccountInfos = async (): Promise<IRootConfig> => {
  logger.lf();
  logger.info(chalk.underline(chalk.bold('▼ Account informations')));
  logger.lf();
  const projectRoot = resolveProjectRoot();
  const config = new ConfigReader(projectRoot).rootConfig;
  const region = config.defaultRegion;
  const currentUser = await aws.iam.getCurrentUser(region);
  logger.info('AWS Account', chalk.white.bold(currentUser.projectId));
  logger.info('Cache location', chalk.white.bold(`s3://${config.state.checksums}`));
  logger.info('IAM user', chalk.white.bold(currentUser.arn));
  logger.lf();
  return config;
};

export const listEnvs = async (): Promise<void> => {
  logger.lf();
  logger.info('🔎 Listing deployed environments');
  logger.lf();
  const config = await printAccountInfos();
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
