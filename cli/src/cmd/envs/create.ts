import { logger } from '../../utils/logger';
import chalk from 'chalk';
import { Environments } from '@microlambda/remote-state';
import { printAccountInfos } from './list';
import { regions } from '@microlambda/config';
import { prompt } from 'inquirer';

export const createEnv = async (name: string) => {
  logger.info('Creating environment');
  logger.lf();
  const config = await printAccountInfos();
  const envsModel = new Environments(config);
  if (await envsModel.alreadyExists(name)) {
    logger.error(`An environment named ${name} already exists`);
    process.exit(1);
  }

  const anwsers = await prompt([{
    type: 'text',
    name: 'regions',
    message: 'Choose regions where the environment should be deployed (coma-seperated list)',
    default: config.defaultRegion,
    validate: (input: string) => {
      const allValid = input.split(',').every((value) => regions.includes(value));
      if (!allValid) {
        logger.error('Some regions are not valid. Accepted regions are', regions.join(', '));
      }
      return true;
    }
  }]);
  const envs = await envsModel.createNew(name, anwsers.regions.split(','));
  logger.success('Environment successfully initialized. Perform your first deploy using yarn mila deploy');
}
