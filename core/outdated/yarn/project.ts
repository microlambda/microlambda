import { Project, Configuration, Workspace, Ident, Descriptor } from '@yarnpkg/core';
import { convertPath, PortablePath, ppath } from '@yarnpkg/fslib/lib/path';
import { getPluginConfiguration, openWorkspace } from '@yarnpkg/cli';
import { DependenciesGraph } from '../graph';
import { IConfig } from '@microlambda/runner-core/lib/config';
import { Logger } from '@microlambda/logger';

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
  logger?: Logger,
): Promise<DependenciesGraph> => {
  const project = await getYarnProject(projectRoot);
  return new DependenciesGraph(project, config, logger);
};

/**
 * Get all regular and dev dependencies for a given workspace.
 * This in based on dependencies relationship declared in package.json
 * @param workspace - The workspace to analyze
 */
export const getAllDependencies = (workspace: Workspace): Descriptor[] => {
  return [
    ...Array.from(workspace.manifest.dependencies.values()),
    ...Array.from(workspace.manifest.devDependencies.values()),
  ];
};

/**
 * Get all workspace that depends on target workspace.
 * This in based on dependencies relationship declared in package.json
 * @param workspace - The yarn monorepo project to analyze
 * @param workspace - The workspace to analyze
 */
export const getAllDependent = (project: Project, workspace: Workspace): Workspace[] => {
  return project.workspaces.filter((w) => {
    const deps = getAllDependencies(w);
    return deps.some((d) => getName(d) === getName(workspace));
  });
};

/**
 * Find workspaces for which no other workspace depends on it
 * @param project - the yarn project o analyze, use getYarnProject to resolve it
 */
export const getRootWorkspaces = (project: Project): Workspace[] => {
  return project.workspaces.filter((w) => {
    const dependents = getAllDependent(project, w);
    return dependents.length === 0;
  });
};

/**
 * Find workspaces that depends on no other project workspace
 * @param project - the yarn project o analyze, use getYarnProject to resolve it
 */
export const getLeafWorkspaces = (project: Project): Workspace[] => {
  const workspacesNames = project.workspaces.map((w) => getName(w));
  return project.workspaces.filter((w) => {
    const dependencies = getAllDependencies(w);
    const hasLocalDependency = dependencies.some((d) => workspacesNames.includes(getName(d)));
    return !hasLocalDependency;
  });
};

/**
 * Sort workspace by topological order (i.e. the ones that are dependencies of other first).
 * Useful to build or publish packages in the correct oder.
 * @param project - the yarn project o analyze, use getYarnProject to resolve it
 */
export const getTopologicallySortedWorkspaces = (project: Project): Workspace[] => {
  const roots = getRootWorkspaces(project);
  const sortedWorkspaces: Set<Workspace> = new Set<Workspace>();
  const visitWorkspace = (workspace: Workspace): void => {
    const deps = getAllDependencies(workspace);
    for (const dep of deps) {
      const dependentWorkspace = project.workspaces.find((w) => getName(w) === getName(dep));
      if (dependentWorkspace) {
        visitWorkspace(dependentWorkspace);
      }
    }
    sortedWorkspaces.add(workspace);
  };
  for (const root of roots) {
    visitWorkspace(root);
  }
  return Array.from(sortedWorkspaces);
};
