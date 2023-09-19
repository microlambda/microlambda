import { Project as CentipodProject } from '@microlambda/runner-core';
import { Workspace } from './workspace';
import { resolvePorts } from '../resolve-ports';
import { EventsLog, EventsLogger } from '@microlambda/logger';
import { ConfigReader } from '@microlambda/config';

export class Project extends CentipodProject {
  private _services = new Map<string, Workspace>();
  private _packages = new Map<string, Workspace>();

  constructor(prj: CentipodProject, readonly logger?: EventsLogger) {
    super(prj.pkg, prj.root, prj._config, prj.project);
  }

  static scope = 'core/project';

  get log(): EventsLogger | undefined {
    return this.logger;
  }

  static async loadProject(root: string, logger?: EventsLog): Promise<Project> {
    const log = logger?.scope(Project.scope);
    log?.info('Loading project');
    const centipodProject = await super.loadProject(root, logger);
    log?.info('Found', centipodProject.workspaces.size, 'workspaces');
    const prj = new Project(centipodProject, log);
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
    const ports = await resolvePorts([...prj.workspaces.values()], new ConfigReader(root));
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
