import { IDeployCmd } from '../utils/deploy/cmd-options';
import { resolveProjectRoot } from '@microlambda/utils';
import { beforeDeploy } from '../utils/deploy/pre-requisites';
import { EventLogsFileHandler, EventsLog } from '@microlambda/logger';
import { logger } from '../utils/logger';
import { printAccountInfos } from '../utils/account';
import { resolveRemoveOperations } from '../utils/remove/resolve-deltas';
import { removeServices } from '../utils/remove/do-remove';
import { promptConfirm } from '../utils/remove/prompt-confirm';
import { checkIfEnvIsLock, releaseLockOnProcessExit } from '@microlambda/core';
import { getStateConfig } from '@microlambda/config';

export const remove = async (cmd: IDeployCmd): Promise<void> => {
  logger.lf();
  logger.info('🔥 Preparing to remove services');
  logger.lf();
  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-remove-${Date.now()}`)]);

  const { env, project, state, config, services } = await beforeDeploy(cmd, eventsLog);

  const stateConfig = await printAccountInfos(cmd.a);
  getStateConfig(config, cmd.a);
  const releaseLock = await checkIfEnvIsLock(cmd, env, project, stateConfig, logger);
  releaseLockOnProcessExit(releaseLock, logger);

  try {
    const operations = await resolveRemoveOperations(env, state, services, releaseLock);
    await promptConfirm(env.name, cmd, releaseLock);
    await removeServices({
      operations,
      project,
      env,
      eventsLog,
      releaseLock,
      isVerbose: cmd.verbose,
      concurrency: cmd.c,
      state,
    });
    await releaseLock();
    logger.lf();
    logger.success(`Successfully removed ${env.name} 🚀`);
  } catch (e) {
    logger.error('Remove failed', e);
    await releaseLock();
    process.exit(1);
  }
};
