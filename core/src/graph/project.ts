import { Project as CentipodProject } from '@centipod/core';
import { Workspace } from './workspace';

export class Project extends CentipodProject {
  private _services = new Map<string, Workspace>();
  private _packages = new Map<string, Workspace>();

  constructor(prj: CentipodProject) {
    super(prj.pkg, prj.root, prj.config, prj.project);
  }

  static async loadProject(root: string): Promise<Project> {
    const centipodProject = await super.loadProject(root);
    const prj = new Project(centipodProject);
    for (const [name, workspace] of centipodProject.workspaces.entries()) {
      const milaWorkspace = new Workspace(workspace);
      if (milaWorkspace.isService) {
        prj._services.set(name, milaWorkspace);
      } else {
        prj._packages.set(name, milaWorkspace);
      }
      prj._workspaces.set(name, milaWorkspace);
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
