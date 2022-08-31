import { logger } from '../logger';
import chalk from 'chalk';
import { checkWorkingDirectoryClean } from '@microlambda/runner-core';
import { resolveProjectRoot } from '@microlambda/utils';
import { EventLogsFileHandler, EventsLog } from '@microlambda/logger';
import { init } from '../init';
import { IEnvironment, State } from '@microlambda/remote-state';
import { verifyState } from '../verify-state';
import { IDeployCmd } from './cmd-options';
import { Project } from '@microlambda/core';
import { IRootConfig } from '@microlambda/config';

export const beforeDeploy = async (cmd: IDeployCmd): Promise<{ state: State, project: Project, env: IEnvironment, config: IRootConfig }> => {
  if (!cmd.e) {
    logger.error(chalk.red('You must specify a target environment using the -e option'));
    process.exit(1);
  }
  // Check working dir clean
  checkWorkingDirectoryClean();

  // Check branch mapping
  // if not good branch and not --skip-branch-check throw
  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-deploy-${Date.now()}`)]);

  // Validate env
  const { config, project } = await init(projectRoot, eventsLog);
  const state = new State(config);
  await verifyState(config);
  const env = await state.findEnv(cmd.e);
  if (!env) {
    logger.error(chalk.red('Target environment not found in remote state. You must initialize environments using yarn mila env create <name>'));
    process.exit(1);
  }

  // Validate targets
  if(cmd.s && cmd.s.split(',').some((s) => !project.services.has(s))) {
    const missing = cmd.s.split(',').find((s) => !project.services.has(s));
    logger.error(chalk.red(`Unknown service ${missing}`));
    process.exit(1);
  }

  return { env, state, project, config };
}
