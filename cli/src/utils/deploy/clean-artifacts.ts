import { logger } from '../logger';
import Spinnies from 'spinnies';
import { spinniesOptions } from '../spinnies';
import { join } from 'path';
import { pathExists, remove } from 'fs-extra';
import chalk from 'chalk';
import { IDeployOptions } from '@microlambda/core';

export const cleanArtifacts = async (options: IDeployOptions) => {
  if(options.force) {
    logger.info('\n▼ Clean artifacts directories\n');
    // Cleaning artifact location
    const cleaningSpinnies = new Spinnies(spinniesOptions);
    let hasCleanErrored = false;
    if (!options.targets?.length) {
      return;
    }
    await Promise.all(
      options.targets.map(async (service) => {
        const artefactLocation = join(service.root, '.package');
        const doesExist = await pathExists(artefactLocation);
        if (doesExist) {
          cleaningSpinnies.add(service.name, {
            text: `Cleaning artifact directory ${chalk.grey(artefactLocation)}`,
          });
          try {
            await remove(artefactLocation);
            if (cleaningSpinnies.pick(service.name)) {
              cleaningSpinnies.succeed(service.name);
            }
          } catch (e) {
            if (cleaningSpinnies.pick(service.name)) {
              cleaningSpinnies.fail(service.name);
            }
            hasCleanErrored = true;
          }
        }
      }),
    );
    if (hasCleanErrored) {
      logger.error(chalk.red('Error cleaning previous artifacts'));
      process.exit(1);
    }
  }
}
