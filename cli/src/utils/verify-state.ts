import { logger } from './logger';
import { aws } from '@microlambda/aws';
import { verifyStateKeysSchema } from '@microlambda/remote-state';
import { IRootConfig } from '@microlambda/config';

export const verifyState = async (config: IRootConfig): Promise<void> => {
  const verifyTable = async (): Promise<void> => {
    try {
      const isValid = await verifyStateKeysSchema(config);
      if (!isValid) {
        logger.error('State verification failed. Please double-check config.state');
        logger.error(
          `Table ${config.state.table}  exists in the AWS account you are logged in, but the keys and/or indexes are incorrect.`,
        );
        process.exit(1);
      }
    } catch (e) {
      if ((e as Error).message?.toLowerCase().includes('not found')) {
        logger.error('State verification failed. Please double-check config.state');
        logger.error(`Table ${config.state.table} does not exists in the AWS account you are logged in.`);
        logger.error('Did you initialize remote state using "yarn mila init"');
        process.exit(1);
      }
      throw e;
    }
  };

  const verifyBucket = async (): Promise<void> => {
    if (!(await aws.s3.bucketExists(config.defaultRegion, config.state.checksums))) {
      logger.error('State verification failed. Please double-check config.state');
      logger.error(`Bucket ${config.state.checksums} does not exists in the AWS account you are logged in.`);
      logger.error('Did you initialize remote state using "yarn mila init"');
      process.exit(1);
    }
  };

  try {
    await Promise.all([verifyBucket(), verifyTable()]);
  } catch (e) {
    logger.error('State verification failed. Unexpected error:');
    logger.error(e);
    process.exit(1);
  }
};
