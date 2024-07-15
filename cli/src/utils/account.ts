import { ConfigReader, getStateConfig, IStateConfig, verifyAccount } from '@microlambda/config';
import { logger } from './logger';
import chalk from 'chalk';
import { resolveProjectRoot } from '@microlambda/utils';
import { aws } from '@microlambda/aws';

export const printAccountInfos = async (account?: string): Promise<IStateConfig> => {
  logger.lf();
  logger.info(chalk.underline(chalk.bold('▼ Account informations')));
  logger.lf();
  const projectRoot = resolveProjectRoot();
  const rootConfig = new ConfigReader(projectRoot).rootConfig;
  const config = getStateConfig(rootConfig, account);
  const currentUser = await aws.iam.getCurrentUser();
  logger.info('AWS Account', chalk.white.bold(currentUser.projectId));
  logger.info('Cache location', chalk.white.bold(`s3://${config.state.checksums}`));
  logger.info('IAM user', chalk.white.bold(currentUser.arn));
  logger.lf();
  verifyAccount(currentUser, config);
  return config;
};
