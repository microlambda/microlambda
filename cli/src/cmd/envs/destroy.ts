import { logger } from '../../utils/logger';
import { printAccountInfos } from './list';
import { verifyState } from '../../utils/verify-state';
import { State } from '@microlambda/remote-state/lib/models/state';
import { resolveProjectRoot } from '@microlambda/utils';
import { resolveRemoveOperations } from '../../utils/remove/resolve-deltas';
import { checkIfEnvIsLock, releaseLockOnProcessExit } from '../../utils/check-env-lock';
import { init } from '../../utils/init';
import { EventLogsFileHandler, EventsLog } from '@microlambda/logger';
import { removeServices } from '../../utils/remove/do-remove';
import { promptConfirm } from '../../utils/remove/prompt-confirm';
import { removeSsmAndSecrets } from '../../utils/remove/remove-ssm';
import {deploySharedInfra} from "../../utils/shared-infra/deploy";

export const destroyEnv = async (
  name: string,
  cmd: { prompt: boolean; skipLock: boolean; onlyPrompt: boolean; destroy: boolean; c?: string, verbose: true },
): Promise<void> => {
  logger.info('🔥 Preparing to destroy environment');
  logger.lf();

  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-destroy-${Date.now()}`)]);

  const { project } = await init(projectRoot, eventsLog);
  const config = await printAccountInfos();

  await verifyState(config);
  const state = new State(config);
  const env = await state.findEnv(name);

  if (!env) {
    logger.error(`Environment not found: ${name}`);
    process.exit(1);
  }

  if (!cmd.destroy) {
    const services = await state.listServices(name);
    if (services.length) {
      logger.error('There is still services up and running in environment', name);
      logger.info('Run yarn mila destroy -e dev to destroy this services before removing env');
      process.exit(1);
    }
  }

  const releaseLock = await checkIfEnvIsLock({ skipLock: false }, env, project, config);
  releaseLockOnProcessExit(releaseLock);

  try {
    if (cmd.destroy) {
      const operations = await resolveRemoveOperations(env, state, [...project.services.values()], releaseLock);
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
    }

    await state.removeEnv(name);
    await removeSsmAndSecrets(env, project, releaseLock);

    await deploySharedInfra({
      action: 'remove',
      projectRoot,
      config,
      env,
      concurrency: cmd.c,
      isVerbose: cmd.verbose,
      releaseLock,
    })

    await releaseLock();

    logger.success('Successfully destroyed 🔥');
    process.exit(0);
  } catch (e) {
    logger.error(e);
    process.exit(1);
  }
};
