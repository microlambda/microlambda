import { ConfigReader, IRootConfig } from '@microlambda/config';
import ora from 'ora';
import { EventsLog } from '@microlambda/logger';

export const readConfig = (projectRoot: string, eventsLog?: EventsLog): IRootConfig => {
  let config: IRootConfig;
  const readingConfig = ora('Loading configuration ⚙️');
  try {
    readingConfig.start();
    const configReader = new ConfigReader(projectRoot, eventsLog);
    config = configReader.rootConfig;
    readingConfig.succeed('Configuration loaded ⚙️');
  } catch (e) {
    readingConfig.fail((e as Error).message || 'Error reading config file');
    throw e;
  }
  return config;
};
