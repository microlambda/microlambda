import { EventsLog } from '@microlambda/logger';
import { Project } from '@microlambda/core';
import ora from 'ora';

export const getDependenciesGraph = async (projectRoot: string, logger?: EventsLog): Promise<Project> => {
  const parsingGraph = ora('Parsing dependency graph 🧶').start();
  const graph = await Project.loadProject(projectRoot, logger);
  parsingGraph.succeed();
  return graph;
};
