import { logger } from './logger';
import { aws } from '@microlambda/aws';
import { verifyStateKeysSchema } from '@microlambda/remote-state';
import { IRootConfig } from '@microlambda/config';

export const verifyState = async (config: IRootConfig): Promise<void> => {
  const printError = (): void => {
    logger.error('State verification failed. Please double-check config.state');
    logger.error(
      'Either you are not connected to the right AWS account or you did not run yarn mila init on a fresh project?',
    );
  };
  try {
    const [checksumsBucketExists, stateTableValid] = await Promise.all([
      await aws.s3.bucketExists(config.defaultRegion, config.state.checksums),
      await verifyStateKeysSchema(config),
    ]);
    if (!checksumsBucketExists || !stateTableValid) {
      printError();
      process.exit(1);
    }
  } catch (e) {
    printError();
    logger.error(e);
    process.exit(1);
  }
};
