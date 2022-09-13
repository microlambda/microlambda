import { EventsLog } from '@microlambda/logger';
import { IRootConfig } from '@microlambda/config';
import { Project } from '@microlambda/core';
import { getDependenciesGraph } from './parse-deps-graph';
import { readConfig } from './read-config';
import { yarnInstall } from './yarn-install';

export const init = async (
  projectRoot: string,
  eventsLog?: EventsLog,
  reinstall = true,
): Promise<{ config: IRootConfig; project: Project }> => {
  const project =  await getDependenciesGraph(projectRoot, eventsLog);
  const config = await readConfig(projectRoot, eventsLog);
  if (reinstall) {
    await yarnInstall(project, eventsLog);
  }
  return { config: config, project };
};
