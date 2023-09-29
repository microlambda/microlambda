import { logger } from '../../utils/logger';
import { currentSha1 } from '@microlambda/runner-core';
import { EnvsResolver } from '../../utils/deploy/envs';
import { checkIfEnvIsLock, releaseLockOnProcessExit } from '../../utils/check-env-lock';
import { resolveDeltas } from '../../utils/deploy/resolve-deltas';
import { performDeploy } from '../../utils/deploy/do-deploy';
import { beforeReplicate } from '../../utils/replicate/before-replicate';
import { destroyRegionalSsmReplicate } from '../../utils/replicate/ssm';
import { IReplicateCmd } from '../../utils/replicate/cmd';

export const destroyReplicate = async (env: string, region: string, cmd: IReplicateCmd): Promise<void> => {
  logger.lf();
  logger.info('🔥 Removing regional replicate for', env);
  logger.lf();

  const { environment, project, eventsLog, config, projectRoot, state } = await beforeReplicate(env, region, 'destroy');

  if (!environment.regions.includes(region)) {
    logger.error('Environment is not replicated in region', region);
    process.exit(1);
  }

  const currentRevision = currentSha1();

  const releaseLock = await checkIfEnvIsLock(cmd, environment, project, config);
  releaseLockOnProcessExit(releaseLock);

  let shouldRestoreEnv = false;
  try {
    const updatedEnvironment = await state.removeReplicate(env, region);
    shouldRestoreEnv = true;

    const envs = new EnvsResolver(project, env, eventsLog.scope('replicate/env'));

    await destroyRegionalSsmReplicate(project, env, region, releaseLock);

    if (!cmd.deploy) {
      logger.success(
        'Replicate destruction order created. On next deploy, environment resources will be destroyed from',
        region,
      );
      logger.success(`Run yarn mila deploy -e ${env} to remove resources from AWS Cloud`);
      await releaseLock();
      process.exit(0);
    }

    const operations = await resolveDeltas(
      updatedEnvironment,
      project,
      { ...cmd, e: env },
      state,
      config,
      eventsLog,
      envs,
    );
    await performDeploy({
      cmd: { ...cmd, e: env },
      releaseLock,
      operations,
      env: updatedEnvironment,
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
    if (shouldRestoreEnv) {
      await state.createReplicate(env, region);
    }
    logger.error('Error destroying replicate', e);
    await releaseLock();
    process.exit(1);
  }
};
