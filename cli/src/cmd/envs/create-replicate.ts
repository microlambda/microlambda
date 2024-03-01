import { logger } from '../../utils/logger';
import { resolveDeltas } from '../../utils/deploy/resolve-deltas';
import { EnvsResolver } from '../../utils/deploy/envs';
import { performDeploy } from '../../utils/deploy/do-deploy';
import { currentSha1 } from '@microlambda/runner-core';
import { IReplicateCmd } from '../../utils/replicate/cmd';
import { beforeReplicate } from '../../utils/replicate/before-replicate';
import { replicateSsmParameters } from '../../utils/replicate/ssm';
import { checkIfEnvIsLock, releaseLockOnProcessExit } from '@microlambda/core';

export const createReplicate = async (env: string, region: string, cmd: IReplicateCmd): Promise<void> => {
  logger.lf();
  logger.info('🌎 Creating regional replicate for', env);
  logger.lf();

  const { environment, project, eventsLog, config, projectRoot, state } = await beforeReplicate(env, region, 'create');

  if (environment.regions.includes(region)) {
    logger.warn('Environment is already replicated in region', region);
    process.exit(2);
  }
  const currentRevision = currentSha1();

  const envs = new EnvsResolver(project, env, eventsLog.scope('replicate/env'));

  const releaseLock = await checkIfEnvIsLock(cmd, environment, project, config, logger);
  releaseLockOnProcessExit(releaseLock, logger);

  let shouldRestoreEnv = false;
  try {
    const updatedEnvironment = await state.createReplicate(env, region);
    shouldRestoreEnv = true;
    const operations = await resolveDeltas(
      updatedEnvironment,
      project,
      { ...cmd, e: env },
      state,
      config,
      eventsLog,
      envs,
    );

    await replicateSsmParameters(project, env, region, releaseLock);

    if (!cmd.deploy) {
      logger.success(
        'Replicate destruction order created. On next deploy, environment resources will be destroyed from',
        region,
      );
      logger.success(`Run yarn mila deploy -e ${env} to remove resources from AWS Cloud`);
      await releaseLock();
      process.exit(0);
    }

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
      await state.removeReplicate(env, region);
    }
    logger.error('Error creating replicate', e);
    await releaseLock();
    process.exit(1);
  }
};
