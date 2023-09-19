import { logger } from '../../utils/logger';
import { State } from '@microlambda/remote-state';
import { printAccountInfos } from './list';
import { regions } from '@microlambda/config';
import { prompt } from 'inquirer';
import { verifyState } from '../../utils/verify-state';
import { existsSync, promises as fs } from 'fs';
import { resolveProjectRoot } from '@microlambda/utils';
import { join } from 'path';
import { init } from '../../utils/init';

export const createEnv = async (name: string): Promise<void> => {
  logger.info('Creating environment');
  logger.lf();
  const projectRoot = resolveProjectRoot();
  const { project } = await init(projectRoot);
  logger.lf();
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
  logger.lf();
  logger.success('Environment successfully initialized.');
  const dotenv = [join(projectRoot, 'envs', `.env.${name}`)];
  for (const service of project.services.values()) {
    dotenv.push(join(service.root, `envs`, `.env.${name}`));
  }
  const createDotEnv = async (path: string): Promise<void> => {
    if (!existsSync(path)) {
      fs.open(path)
        .then(() => {
          logger.debug('Created', path);
        })
        .catch((err) => {
          logger.warn('Error creating environment file @', path);
          logger.warn(err);
        });
    }
  };

  await Promise.all(dotenv.map((path) => createDotEnv(path)));
  logger.success(`Perform your first deploy using "yarn mila deploy -e ${name}" 🚀`);
};
