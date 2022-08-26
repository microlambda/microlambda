import { logger } from '../../utils/logger';
import chalk from 'chalk';
import { Environments } from '@microlambda/remote-state';
import { aws } from '@microlambda/aws';
import { resolveProjectRoot } from '@microlambda/utils';
import { ConfigReader } from '@microlambda/config';

export const printAccountInfos = async () => {
  const projectRoot = resolveProjectRoot();
  const config = new ConfigReader(projectRoot).rootConfig;
  const region = config.defaultRegion;
  const currentUser = await aws.iam.getCurrentUser(region);
  logger.info('AWS Account', chalk.white.bold(currentUser.projectId));
  logger.info('Cache location', chalk.white.bold(`s3://${config.state.checksums}`));
  logger.info('IAM user', chalk.white.bold(currentUser.arn));
  logger.lf();
  return config;
}

export const listEnvs = async () => {
  logger.info('Listing deployed environments');
  logger.lf();
  const config = await printAccountInfos();
  const envsModel = new Environments(config);
  const envs = await envsModel.list();
  if (!envs.length) {
    logger.info('No deployed environments found. Run yarn mila envs create <name> to initialize a new environment');
  } else {
    envs.map((e) => `${chalk.white.bold(e.name)} (${chalk.grey(e.regions.join(', '))})`).forEach(logger.info);
  }
}
