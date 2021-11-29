import { Project as CentipodProject } from '@centipod/core';
import { Workspace } from './workspace';

export class Project extends CentipodProject {
  private readonly _services = new Map<string, Workspace>();
  private readonly _packages = new Map<string, Workspace>();

  static async loadProject(root: string): Promise<Project> {
    const prj = await super.loadProject(root) as Project;
    for (const [name, workspace] of prj.workspaces.entries()) {
      const milaWorkspace = workspace as Workspace;
      if (milaWorkspace.isService) {
        prj._services.set(name, milaWorkspace);
      } else {
        prj._packages.set(name, milaWorkspace);
      }
    }
    return prj;
  }

  get services(): Map<string, Workspace> {
    return this._services;
  }

  get packages(): Map<string, Workspace> {
    return this._packages;
  }
}
