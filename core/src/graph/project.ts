import { Project as CentipodProject } from '@centipod/core';
import { Workspace } from './workspace';
import { resolvePorts } from "../resolve-ports";
import { IConfig } from "../config/config";
import { ConfigReader } from "../config/read-config";

export class Project extends CentipodProject {
  private _services = new Map<string, Workspace>();
  private _packages = new Map<string, Workspace>();

  constructor(prj: CentipodProject, private readonly _milaConfig: IConfig) {
    super(prj.pkg, prj.root, prj.config, prj.project);
  }

  static async loadProject(root: string): Promise<Project> {
    const centipodProject = await super.loadProject(root);
    const configReader = new ConfigReader();
    const config = configReader.readConfig();
    const prj = new Project(centipodProject, config);
    configReader.validate(prj);
    const ports = resolvePorts([...prj.workspaces.values()], config)
    for (const [name, workspace] of centipodProject.workspaces.entries()) {
      const milaWorkspace = new Workspace(workspace, ports[workspace.name]);
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
