import { EventsLog } from '@microlambda/logger';
import { IRootConfig } from '@microlambda/config';
import { Project } from './graph/project';
import { getDependenciesGraph } from './parse-deps-graph';
import { readConfig } from './read-config';
import { yarnInstall } from './yarn-install';
import { IBaseLogger } from '@microlambda/types';

export const init = async (
  projectRoot: string,
  logger?: IBaseLogger,
  eventsLog?: EventsLog,
  reinstall = true,
): Promise<{ config: IRootConfig; project: Project }> => {
  const project = await getDependenciesGraph(projectRoot, eventsLog);
  const config = await readConfig(projectRoot, logger == null, eventsLog);
  if (reinstall) {
    await yarnInstall(project, logger, eventsLog);
  }
  return { config: config, project };
};
