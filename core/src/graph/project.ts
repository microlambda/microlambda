import { Project as CentipodProject } from '@microlambda/runner-core';
import { Workspace } from './workspace';
import { resolvePorts } from "../resolve-ports";
import { IConfig } from "../config/config";
import { ConfigReader } from "../config/read-config";
import { EventsLog, EventsLogger} from "@microlambda/logger";

export class Project extends CentipodProject {
  private _services = new Map<string, Workspace>();
  private _packages = new Map<string, Workspace>();

  constructor(prj: CentipodProject, private readonly _milaConfig: IConfig, readonly logger?: EventsLogger) {
    super(prj.pkg, prj.root, prj.config, prj.project);
  }

  static scope = 'core/project';

  get log(): EventsLogger | undefined { return this.logger }

  static async loadProject(root: string, logger?: EventsLog): Promise<Project> {
    const log = logger?.scope(Project.scope);
    log?.info('Loading project');
    const centipodProject = await super.loadProject(root, logger);
    log?.info('Found', centipodProject.workspaces.size, 'workspaces');
    const configReader = new ConfigReader();
    const config = configReader.readConfig();
    const prj = new Project(centipodProject, config, log);
    configReader.validate(prj);
    for (const [name, workspace] of centipodProject.workspaces.entries()) {
      const milaWorkspace = new Workspace(workspace);
      if (milaWorkspace.isService) {
        prj._services.set(name, milaWorkspace);
      } else {
        prj._packages.set(name, milaWorkspace);
      }
      prj._workspaces.set(name, milaWorkspace);
    }
    log?.info('Found', prj.packages.size, 'packages');
    log?.info('Found', prj.services.size, 'services');
    log?.info('Resolving ports');
    const ports = resolvePorts([...prj.workspaces.values()], config)
    prj.services.forEach((s) => {
      log?.info('Service', s.name, 'is assigned port', ports[s.name]?.http);
      s.assignPorts(ports[s.name]);
    });
    return prj;
  }

  getWorkspace(name: string): Workspace | null {
    return this.project.workspaces.get(name) as Workspace;
  }

  get services(): Map<string, Workspace> {
    return this._services;
  }

  get packages(): Map<string, Workspace> {
    return this._packages;
  }
}
