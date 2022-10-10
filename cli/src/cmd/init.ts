import { aws } from '@microlambda/aws';
import { logger } from '../utils/logger';
import chalk from 'chalk';
import ora from 'ora';
import { prompt } from 'inquirer';
import { verifyStateKeysSchema, createStateTable } from '@microlambda/remote-state';
import { readConfig } from '../utils/read-config';
import { resolveProjectRoot } from '@microlambda/utils';

export const init = async (cmd: { prompt: boolean }): Promise<void> => {
  logger.lf();
  logger.info('✨ Initializing remote state');
  logger.lf();
  const config = readConfig(resolveProjectRoot());
  try {
    const user = await aws.iam.getCurrentUser(config.defaultRegion);
    logger.info('The remote state will be initialized in AWS account', chalk.cyan.bold(user.projectId));
    logger.info('Actions will be be performed as IAM user', chalk.cyan.bold(user.username), chalk.gray(`(${user.arn})`));
  } catch (e) {
    logger.error('Cannot determine current IAM user:', (e as Error).message);
    logger.error('Make sure you are logged in AWS')
    process.exit(1);
  }

  if (cmd.prompt) {
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
  }

  logger.lf();
  const creatingChecksumsBucket = ora();
  creatingChecksumsBucket.start('Creating checksums S3 bucket');
  try {
    if (await aws.s3.bucketExists(config.defaultRegion, config.state.checksums)) {
      creatingChecksumsBucket.succeed('Checksums S3 bucket already exists');
    } else {
      await aws.s3.createBucket(config.defaultRegion, config.state.checksums);
      creatingChecksumsBucket.succeed('Checksums S3 bucket created !');
    }
  } catch (e) {
    creatingChecksumsBucket.fail('Error creating checksums S3 bucket');
    logger.lf();
    logger.error(e);
    process.exit(1);
  }

  const creatingStateTable = ora();
  creatingStateTable.start('Creating remote state table');
  const onError = (e: unknown): void => {
    creatingStateTable.fail('Error creating remote state');
    logger.lf();
    logger.error(e);
    process.exit(1);
  }
  const onSuccess = (): void => {
    logger.lf();
    logger.success('Remote state successfully initialized !')
    process.exit(0);
  };
  try {
    if (await verifyStateKeysSchema(config)) {
      creatingStateTable.succeed('Remote state already exists');
      onSuccess();
    } else {
      onError(`A table named ${config.state.table} already exists. Please choose another name in mila.json or remove the existing table.`)
    }
  } catch (e) {
    if ((e as Error).message?.toLowerCase().includes('not found')) {
      try {
        await createStateTable(config);
        creatingStateTable.succeed('Remote state created !');
        onSuccess();
      } catch (err) {
        onError(err);
      }
    }
    onError(e);
  }
};
