import { aws } from '@microlambda/aws';
import { logger } from '../utils/logger';
import chalk from 'chalk';
import ora from 'ora';
import { prompt } from 'inquirer';
import { verifyStateKeysSchema, createStateTable } from '@microlambda/remote-state';
import { resolveProjectRoot } from '@microlambda/utils';
import { readConfig } from '@microlambda/core';
import { getStateConfig } from '@microlambda/config';
import { ICurrentUserIAM } from '@microlambda/aws/lib/iam/get-current-user';

export const init = async (cmd: { prompt: boolean; account?: string }): Promise<void> => {
  logger.lf();
  logger.info('✨ Initializing remote state');
  logger.lf();
  const config = readConfig(resolveProjectRoot(), false);
  const getUser = async (): Promise<ICurrentUserIAM> => {
    try {
      const user = await aws.iam.getCurrentUser();
      logger.info('The remote state will be initialized in AWS account', chalk.cyan.bold(user.projectId));
      logger.info(
        'Actions will be be performed as IAM user',
        chalk.cyan.bold(user.username),
        chalk.gray(`(${user.arn})`),
      );
      return user;
    } catch (e) {
      logger.error('Cannot determine current IAM user:', (e as Error).message);
      logger.error('Make sure you are logged in AWS');
      process.exit(1);
    }
  };
  const user = await getUser();
  if (cmd.prompt) {
    const confirm = await prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Do you want to proceed',
        default: false,
      },
    ]);

    if (!confirm.proceed) {
      logger.lf();
      logger.hint('Aborted by user');
      process.exit(0);
    }
  }

  logger.lf();
  const state = getStateConfig(config, user.projectId);
  const creatingChecksumsBucket = ora();
  creatingChecksumsBucket.start('Creating checksums S3 bucket');
  try {
    if (await aws.s3.bucketExists(state.defaultRegion, state.state.checksums)) {
      creatingChecksumsBucket.succeed('Checksums S3 bucket already exists');
    } else {
      await aws.s3.createBucket(state.defaultRegion, state.state.checksums);
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
  };
  const onSuccess = (): void => {
    logger.lf();
    logger.success('Remote state successfully initialized !');
    process.exit(0);
  };
  try {
    if (await verifyStateKeysSchema(state.state.table, state.defaultRegion)) {
      creatingStateTable.succeed('Remote state already exists');
      onSuccess();
    } else {
      onError(
        `A table named ${state.state.table} already exists. Please choose another name in mila.json or remove the existing table.`,
      );
    }
  } catch (e) {
    if ((e as Error).message?.toLowerCase().includes('not found')) {
      try {
        await createStateTable(state.state.table, state.defaultRegion);
        creatingStateTable.succeed('Remote state created !');
        onSuccess();
      } catch (err) {
        onError(err);
      }
    }
    onError(e);
  }
};
