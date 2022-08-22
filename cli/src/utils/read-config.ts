import { ConfigReader, IRootConfig } from '@microlambda/config';
import ora from 'ora';
import { logger } from './logger';

export const readConfig = (): IRootConfig => {
  let config: IRootConfig;
  const readingConfig = ora();
  try {
    readingConfig.start('Loading configuration');
    const configReader = new ConfigReader();
    config = configReader.rootConfig;
    readingConfig.succeed('Configuration loaded');
    logger.lf();
  } catch (e) {
    readingConfig.fail((e as Error).message || 'Error reading config file');
    throw e;
  }
  return config;
}
