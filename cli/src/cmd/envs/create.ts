import { logger } from '../../utils/logger';
import { State } from '@microlambda/remote-state';
import { printAccountInfos } from './list';
import { regions } from '@microlambda/config';
import { prompt } from 'inquirer';
import { verifyState } from '../../utils/verify-state';
import { promises as fs } from 'fs';
import { resolveProjectRoot } from '@microlambda/utils';
import { join } from 'path';
import { init } from '../../utils/init';

export const createEnv = async (name: string): Promise<void> => {
  logger.info('Creating environment');
  logger.lf();
  const projectRoot = resolveProjectRoot();
  const { project } = await init(projectRoot);

  const config = await printAccountInfos();
  await verifyState(config);
  const state = new State(config);
  if (await state.environmentExists(name)) {
    logger.error(`An environment named ${name} already exists`);
    process.exit(1);
  }
  const answers = await prompt([
    {
      type: 'text',
      name: 'regions',
      message: 'Choose regions where the environment should be deployed (coma-seperated list)',
      default: config.defaultRegion,
      validate: (input: string): boolean => {
        const allValid = input.split(',').every((value) => regions.includes(value));
        if (!allValid) {
          logger.error('Some regions are not valid. Accepted regions are', regions.join(', '));
          process.exit(1);
        }
        return true;
      },
    },
  ]);
  await state.createEnvironment(name, answers.regions.split(','));
  logger.success('Environment successfully initialized.');
  const dotenv = [join(projectRoot, `.env.${name}`)];
  for (const service of project.services.values()) {
    dotenv.push(join(service.root, `.env.${name}`));
  }
  await Promise.all(
    dotenv.map((path) =>
      fs
        .open(path)
        .then(() => {
          logger.debug('Created', path);
        })
        .catch((err) => {
          logger.warn('Error creating environment file @', path);
          logger.warn(err);
        }),
    ),
  );
  logger.info();
  logger.info('Perform your first deploy using yarn mila deploy');
};
