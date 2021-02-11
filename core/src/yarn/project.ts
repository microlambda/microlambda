import { Project, Configuration, Workspace, Ident } from '@yarnpkg/core';
import { convertPath, PortablePath, ppath } from '@yarnpkg/fslib/lib/path';
import { getPluginConfiguration, openWorkspace } from '@yarnpkg/cli';
import { RecompilationScheduler } from '../scheduler';
import { IConfig } from '../config/config';
import { Logger } from '../logger';
import { DependenciesGraph } from '../graph';

export const getYarnProject = async (projectRoot: string): Promise<Project> => {
  const rootPath = convertPath<PortablePath>(ppath, projectRoot);
  const plugins = getPluginConfiguration();
  const configuration = await Configuration.find(rootPath, plugins);
  const mainWorkspace = await openWorkspace(configuration, rootPath);
  return mainWorkspace.project;
};

export const getName = (entity: Workspace | Ident): string => {
  const buildName = (desc: Ident): string => {
    return desc.scope ? ['@' + desc.scope, desc.name].join('/') : desc.name;
  };
  if (entity instanceof Workspace) {
    if (entity.manifest.name == null) {
      throw new Error(`Cannot get identity name: workspace @ ${entity.cwd} manifest has no name.`);
    }
    return buildName(entity.manifest.name);
  }
  return buildName(entity);
};

export const getGraphFromYarnProject = async (
  projectRoot: string,
  config: IConfig,
  scheduler?: RecompilationScheduler,
  logger?: Logger,
  defaultPort = 3001,
): Promise<DependenciesGraph> => {
  const project = await getYarnProject(projectRoot);
  return new DependenciesGraph(project, config, scheduler, logger, defaultPort);
};
