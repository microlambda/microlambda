import { logger } from "./logger"
import { aws } from '@microlambda/aws';
import { verifyStateKeysSchema } from '@microlambda/remote-state';
import { IRootConfig } from '@microlambda/config';

export const verifyState = async (config: IRootConfig): Promise<void> => {
  const printError = () => {
    logger.error('State verification failed. Please double-check config.state');
    logger.error('Have you initialized the state using yarn mila init ?');
  }
  try {
    const [ checksumsBucketExists, stateTableValid ] = await Promise.all([
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
}
