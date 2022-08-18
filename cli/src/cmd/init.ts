import { aws } from '@microlambda/aws';
import { logger } from '../utils/logger';
import chalk from 'chalk';
import ora from 'ora';
import { prompt } from 'inquirer';
import { ConfigReader, IConfig } from '@microlambda/config';

const readConfig = (): IConfig => {
  let config: IConfig;
  const readingConfig = ora();
  try {
    readingConfig.start('Loading configuration');
    const configReader = new ConfigReader();
    config = configReader.config;
    readingConfig.succeed('Configuration loaded');
    logger.lf();
  } catch (e) {
    readingConfig.fail((e as Error).message || 'Error reading config file');
    logger.lf();
    logger.error(e);
    process.exit(1);
  }
  return config;
}

export const init = async () => {
  logger.lf();
  logger.info('✨ Initializing remote state');
  logger.lf();
  const config = readConfig();
  try {
    const user = await aws.iam.getCurrentUser(config.defaultRegion);
    logger.info('The remote state will be initialized in AWS account', chalk.cyan.bold(user.projectId));
    logger.info('Actions will be be performed as IAM user', chalk.cyan.bold(user.username), chalk.gray(`(${user.arn})`));
  } catch (e) {
    logger.error('Cannot determine current IAM user:', (e as Error).message);
    logger.error('Make sure you are logged in AWS')
    process.exit(1);
  }

  const confirm = await prompt([{
    type: 'confirm',
    name: 'proceed',
    message: 'Do you want to proceed',
    default: false,
  }]);

  if (!confirm.proceed) {
    logger.lf();
    logger.hint('Aborted by user');
    process.exit(0);
  }

  logger.lf();
  let creatingChecksumsBucket = ora();
  creatingChecksumsBucket.start('Creating checksums S3 bucket');
  try {
    if (await aws.s3.bucketExists(config.defaultRegion, config.state.checksums)) {
      creatingChecksumsBucket.succeed('Checksums S3 bucket already exists');
    } else {
      await aws.s3.createBucket(config.defaultRegion, config.state.checksums)
    }
  } catch (e) {
    creatingChecksumsBucket.fail('Error creating checksums S3 bucket');
    logger.lf();
    logger.error(e);
    process.exit(1);
  }
};


/*
env=dev
last_deployment=sha1|not_deployed (datetime)
locked: true | false
 */
