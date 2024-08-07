import { resolveProjectRoot } from '@microlambda/utils';
import { EventLogsFileHandler, EventsLog } from '@microlambda/logger';
import { printAccountInfos } from '../account';
import { IStateConfig, regions } from '@microlambda/config';
import { logger } from '../logger';
import { IEnvironment, State, verifyState } from '@microlambda/remote-state';
import { init, Project } from '@microlambda/core';

export const beforeReplicate = async (
  env: string,
  region: string,
  action: 'create' | 'destroy',
  account?: string,
): Promise<{
  environment: IEnvironment;
  project: Project;
  eventsLog: EventsLog;
  config: IStateConfig;
  projectRoot: string;
  state: State;
}> => {
  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [
    new EventLogsFileHandler(projectRoot, `mila-${action}-replicate-${Date.now()}`),
  ]);

  const { project } = await init(projectRoot, logger);

  const config = await printAccountInfos(account);

  await verifyState(config, logger);
  if (!regions.includes(region)) {
    logger.error('Invalid region', region);
    logger.error('Valid regions are', regions.join(', '));
    process.exit(1);
  }

  const state = new State(config.state.table, config.defaultRegion);
  const environment = await state.findEnv(env);
  if (!environment) {
    logger.error('Environment not found', env);
    process.exit(1);
  }

  return { environment, project, eventsLog, config, projectRoot, state };
};
