import { IDeployCmd } from '../utils/deploy/cmd-options';
import { Runner } from '@microlambda/runner-core';
import { resolveProjectRoot } from '@microlambda/utils';
import { beforeDeploy } from '../utils/deploy/pre-requisites';
import { EventLogsFileHandler, EventsLog } from '@microlambda/logger';
import { logger } from '../utils/logger';
import chalk from 'chalk';
import { printAccountInfos } from './envs/list';
import { LockManager } from '@microlambda/remote-state';
import { getConcurrency } from '../utils/get-concurrency';
import { resolveEnvs } from '@microlambda/core';
import { SSMResolverMode } from '@microlambda/environments';

export const remove = async (cmd: IDeployCmd): Promise<void> => {
  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-remove-${Date.now()}`)]);

  const { env, project, state, config, services } = await beforeDeploy(cmd, eventsLog);

  const runner = new Runner(project, getConcurrency(cmd.c), eventsLog);

  logger.lf();
  logger.info(chalk.underline(chalk.bold('▼ Account informations')));
  logger.lf();
  await printAccountInfos();

  // TODO: Avoid duplication, factorize with deploy
  let lock: LockManager | undefined;
  if (!cmd.skipLock) {
    lock = new LockManager(config, env.name, cmd.s?.split(',') || [...project.services.keys()]);
    if (await lock.isLocked()) {
      logger.lf();
      logger.info('🔒 Environment is locked. Waiting for the lock to be released');
      await lock.waitLockToBeReleased();
    }
    await lock.lock();
  }

  // If cmd.s is given (coma-seperated list of services)
  // Verify that every service exist (already done in "beforeDeploy", just return list)

  const servicesInstances = await state.listServices(cmd.e);
  servicesInstances.map((i) => [i.name, i.sha1]);

  // Print table of services to destroy to the user
  // Using lib 'cli-table3'
  // Display table with services name as rows
  // And currently deployed sha1 in column

  // If --only-prompt  process.exit(0)
  // Ask for confirmation except if option --no-prompt

  // Source env
  const envs = await resolveEnvs(project, cmd.e, SSMResolverMode.ERROR, eventsLog.scope('remove/env'));

  // Run target "destroy" using mila runner
  runner.runCommand({
    cmd: 'destroy',
    env: envs,
    mode: 'parallel',
    stdio: cmd.verbose ? 'inherit' : 'pipe',
    workspaces: services ?? [...project.services.values()],
  });
};
