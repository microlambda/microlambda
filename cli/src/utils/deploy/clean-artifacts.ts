import { logger } from '../logger';
import { MilaSpinnies } from '../spinnies';
import { join } from 'path';
import { pathExists, remove } from 'fs-extra';
import chalk from 'chalk';
import { IDeployOptions } from './options';

export const cleanArtifacts = async (options: IDeployOptions): Promise<void> => {
  if (options.force) {
    logger.info('\n▼ Clean artifacts directories\n');
    // Cleaning artifact location
    const cleaningSpinnies = new MilaSpinnies(options.verbose);
    let hasCleanErrored = false;
    if (!options.workspaces?.length) {
      return;
    }
    await Promise.all(
      options.workspaces.map(async (service) => {
        const artefactLocation = join(service.root, '.package');
        const doesExist = await pathExists(artefactLocation);
        if (doesExist) {
          cleaningSpinnies.add(service.name, `Cleaning artifact directory ${chalk.grey(artefactLocation)}`);
          try {
            await remove(artefactLocation);
            cleaningSpinnies.succeed(service.name, 'Artifacts removed');
          } catch (e) {
            cleaningSpinnies.fail(service.name, 'Failed to remove artifacts');
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
};
