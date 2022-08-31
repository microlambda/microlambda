import { logger } from '../../utils/logger';
import { State } from '@microlambda/remote-state';
import { printAccountInfos } from './list';
import { regions } from '@microlambda/config';
import { prompt } from 'inquirer';
import { verifyState } from '../../utils/verify-state';

export const createEnv = async (name: string) => {
  logger.info('Creating environment');
  logger.lf();
  const config = await printAccountInfos();
  await verifyState(config);
  const state = new State(config);
  if (await state.environmentExists(name)) {
    logger.error(`An environment named ${name} already exists`);
    process.exit(1);
  }
  const answers = await prompt([{
    type: 'text',
    name: 'regions',
    message: 'Choose regions where the environment should be deployed (coma-seperated list)',
    default: config.defaultRegion,
    validate: (input: string) => {
      const allValid = input.split(',').every((value) => regions.includes(value));
      if (!allValid) {
        logger.error('Some regions are not valid. Accepted regions are', regions.join(', '));
        process.exit(1);
      }
      return true;
    }
  }]);
  await state.createEnvironment(name, answers.regions.split(','));
  logger.success('Environment successfully initialized. Perform your first deploy using yarn mila deploy');
}
