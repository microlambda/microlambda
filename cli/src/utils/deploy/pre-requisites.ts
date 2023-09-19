import { logger } from '../logger';
import chalk from 'chalk';
import { checkWorkingDirectoryClean } from '@microlambda/runner-core';
import { resolveProjectRoot } from '@microlambda/utils';
import { EventsLog } from '@microlambda/logger';
import { init } from '../init';
import { IEnvironment, State } from '@microlambda/remote-state';
import { verifyState } from '../verify-state';
import { IDeployCmd } from './cmd-options';
import { Project } from '@microlambda/core';
import { IRootConfig } from '@microlambda/config';

export const beforeDeploy = async (
  cmd: IDeployCmd,
  eventsLog: EventsLog,
): Promise<{ state: State; project: Project; env: IEnvironment; config: IRootConfig }> => {
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
  if (cmd.s && cmd.s.split(',').some((s) => !project.services.has(s))) {
    const missing = cmd.s.split(',').find((s) => !project.services.has(s));
    logger.error(chalk.red(`Unknown service ${missing}`));
    process.exit(1);
  }

  return { env, state, project, config };
};
