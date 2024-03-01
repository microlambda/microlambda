import { logger } from '../utils/logger';
import { resolveDeltas } from '../utils/deploy/resolve-deltas';
import { beforeDeploy } from '../utils/deploy/pre-requisites';
import { IDeployCmd } from '../utils/deploy/cmd-options';
import { EventLogsFileHandler, EventsLog } from '@microlambda/logger';
import { resolveProjectRoot } from '@microlambda/utils';
import { currentSha1 } from '@microlambda/runner-core';
import { printAccountInfos } from './envs/list';
import { EnvsResolver } from '../utils/deploy/envs';
import { performDeploy } from '../utils/deploy/do-deploy';
import { checkIfEnvIsLock, releaseLockOnProcessExit } from '@microlambda/core';

export const deploy = async (cmd: IDeployCmd): Promise<void> => {
  logger.lf();
  logger.info('🚀 Preparing to deploy environment');
  logger.lf();

  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-deploy-${Date.now()}`)]);

  await printAccountInfos();

  const { env, project, state, config } = await beforeDeploy(cmd, eventsLog);

  const currentRevision = currentSha1();

  const releaseLock = await checkIfEnvIsLock(cmd, env, project, config, logger);
  releaseLockOnProcessExit(releaseLock, logger);

  try {
    const envs = new EnvsResolver(project, env.name, eventsLog.scope('deploy/env'));
    const operations = await resolveDeltas(env, project, cmd, state, config, eventsLog, envs);
    await performDeploy({
      cmd,
      releaseLock,
      operations,
      env,
      project,
      projectRoot,
      config,
      envs,
      eventsLog,
      state,
      currentRevision,
    });
    process.exit(0);
  } catch (e) {
    logger.error('Deployment failed', e);
    await releaseLock();
    process.exit(1);
  }
};
