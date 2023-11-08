import { IDeployCmd } from '../utils/deploy/cmd-options';
import { resolveProjectRoot } from '@microlambda/utils';
import { beforeDeploy } from '../utils/deploy/pre-requisites';
import { EventLogsFileHandler, EventsLog } from '@microlambda/logger';
import { logger } from '../utils/logger';
import { printAccountInfos } from './envs/list';
import { checkIfEnvIsLock, releaseLockOnProcessExit } from '../utils/check-env-lock';
import { resolveRemoveOperations } from '../utils/remove/resolve-deltas';
import { removeServices } from '../utils/remove/do-remove';
import { promptConfirm } from '../utils/remove/prompt-confirm';

export const remove = async (cmd: IDeployCmd): Promise<void> => {
  logger.lf();
  logger.info('🔥 Preparing to remove services');
  logger.lf();
  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-remove-${Date.now()}`)]);

  const { env, project, state, config, services } = await beforeDeploy(cmd, eventsLog);

  await printAccountInfos();

  const releaseLock = await checkIfEnvIsLock(cmd, env, project, config);
  releaseLockOnProcessExit(releaseLock);

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
