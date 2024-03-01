import { EventsLog } from '@microlambda/logger';
import { Project } from './graph/project';
import ora from 'ora';

export const getDependenciesGraph = async (projectRoot: string, logger?: EventsLog): Promise<Project> => {
  const parsingGraph = logger ? ora('Parsing dependency graph 🧶').start() : undefined;
  const graph = await Project.loadProject(projectRoot, logger);
  parsingGraph?.succeed();
  return graph;
};
