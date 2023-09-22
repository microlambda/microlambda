import { logger } from '../../utils/logger';
import { printAccountInfos } from './list';
import { verifyState } from '../../utils/verify-state';
import { regions } from '@microlambda/config';
import { State } from '@microlambda/remote-state';
import {getDefaultThreads, resolveProjectRoot} from '@microlambda/utils';
import { init } from '../../utils/init';
import { EnvironmentLoader } from '@microlambda/environments';
import {currentSha1} from "@microlambda/runner-core";
import {EnvsResolver} from "../../utils/deploy/envs";
import {EventLogsFileHandler, EventsLog} from "@microlambda/logger";
import chalk from "chalk";
import {checkIfEnvIsLock, releaseLockOnProcessExit} from "../../utils/check-env-lock";
import {resolveDeltas} from "../../utils/deploy/resolve-deltas";
import {performDeploy} from "../../utils/deploy/do-deploy";

export const destroyReplicate = async (env: string, region: string): Promise<void> => {
  logger.info('Removing regional replicate for', env);
  logger.lf();
  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-destroy-replicate-${Date.now()}`)]);

  const { project } = await init(projectRoot);

  logger.lf();
  logger.info(chalk.underline(chalk.bold('▼ Account informations')));
  logger.lf();
  const config = await printAccountInfos();

  await verifyState(config);
  if (!regions.includes(region)) {
    logger.error('Invalid region', region);
    logger.error('Valid regions are', regions.join(', '));
    process.exit(1);
  }

  const state = new State(config);
  const environment = await state.findEnv(env);
  if (!environment) {
    logger.error('Environment not found', env);
    process.exit(1);
  }
  if (!environment.regions.includes(region)) {
    logger.error('Environment is not replicated in region', region);
    process.exit(1);
  }

  const currentRevision = currentSha1();

    const envs = new EnvsResolver(project, env, eventsLog.scope('replicate/env'));

    const cmd = {
      s: undefined,
      force: false,
      forceDeploy: false,
      forcePackage: false,
      prompt: true,
      onlyPrompt: false,
      skipLock: false,
      c: getDefaultThreads().toString(),
      e: env,
      level: 9,
      recompile: true,
      install: true,
      verbose: false,
    };

    const releaseLock = await checkIfEnvIsLock(cmd, environment, project, config);
  releaseLockOnProcessExit(releaseLock);

  try {

    const updatedEnvironment = await state.removeReplicate(env, region);

    const operations = await resolveDeltas(updatedEnvironment, project, cmd, state, config, eventsLog, envs);

    const loader = new EnvironmentLoader(project);
    const {failures} = await loader.destroyRegionalReplicate(env, region);
    failures.forEach((err, envVar) => {
      logger.error(`Failed to destroy secret/ssm parameter ${envVar.raw} in region ${region}`);
      logger.error('Original error:', err);
    });

    if (failures.size) {
      await releaseLock();
      process.exit(1);
    }

    if (cmd.noDeploy) {
      logger.success(
        'Replicate destruction order created. On next deploy, environment resources will be destroyed from',
        region,
      );
      logger.success(`Run yarn mila deploy -e ${env} to remove resources from AWS Cloud`);
      process.exit(0);
    }

    await performDeploy({
      cmd,
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
    logger.error('Error destroying replicate', e);
    await releaseLock();
    process.exit(1);
  }
};
