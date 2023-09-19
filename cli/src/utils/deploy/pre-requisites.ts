import { logger } from '../logger';
import chalk from 'chalk';
import { checkWorkingDirectoryClean, Workspace } from '@microlambda/runner-core';
import { resolveProjectRoot } from '@microlambda/utils';
import { EventsLog } from '@microlambda/logger';
import { init } from '../init';
import { IEnvironment, State } from '@microlambda/remote-state';
import { verifyState } from '../verify-state';
import { IDeployCmd } from './cmd-options';
import { Project } from '@microlambda/core';
import { IRootConfig } from '@microlambda/config';
import { services } from '@microlambda/client/src/store/graph';

export const beforeDeploy = async (
  cmd: IDeployCmd,
  eventsLog: EventsLog,
): Promise<{
  state: State;
  project: Project;
  env: IEnvironment;
  config: IRootConfig;
  services: Array<Workspace> | undefined;
}> => {
  const log = eventsLog.scope('before-deploy');
  if (!cmd.e) {
    logger.error(chalk.red('You must specify a target environment using the -e option'));
    process.exit(1);
  }
  // Check working dir clean
  checkWorkingDirectoryClean();

  // Check branch mapping
  // if not good branch and not --skip-branch-check throw
  const projectRoot = resolveProjectRoot();
  log.debug('Project root resolved', projectRoot);
  // Validate env
  const { config, project } = await init(projectRoot, eventsLog, cmd.install);

  log.debug('Initializing and verifying state');
  const state = new State(config);
  await verifyState(config);
  log.debug('State OK');

  log.debug('Verifying target environment');
  const env = await state.findEnv(cmd.e);
  if (!env) {
    log.error('Target environment not found');
    logger.error(
      chalk.red(
        'Target environment not found in remote state. You must initialize environments using yarn mila envs create <name>',
      ),
    );
    process.exit(1);
  }
  log.debug('Target environment valid', env);

  // Validate targets
  log.debug('Verifying target services', cmd.s?.split(','));
  let services: Array<Workspace> | undefined;
  if (cmd.s) {
    services = [];
    for (const serviceName of cmd.s.split(',')) {
      const existingService = project.services.get(serviceName);
      if (!existingService) {
        logger.error(chalk.red(`Unknown service ${serviceName}`));
        process.exit(1);
      } else {
        services.push(existingService);
      }
    }
  }

  return { env, state, project, config, services };
};
