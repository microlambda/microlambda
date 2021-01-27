import { Node } from './';
import { existsSync } from 'fs';
import { join } from 'path';
import { Package } from './';
import { Service } from './';
import { resolvePorts } from '../resolve-ports';
import { IConfig } from '../config/config';
import { ILogger, Logger } from '../logger';
import { IPCSocketsManager } from '../ipc/socket';
import { RecompilationScheduler } from '../scheduler';
import { Project } from '@yarnpkg/core';
import { getName } from '../yarn/project';
import { BehaviorSubject, Observable } from 'rxjs';

export const isService = (location: string): boolean => {
  return existsSync(join(location, 'serverless.yml')) || existsSync(join(location, 'serverless.yaml'));
};

export class DependenciesGraph {
  private readonly _config: IConfig;
  private readonly projectRoot: string;
  private readonly ports: { [key: string]: number };
  private readonly nodes: Node[];
  private readonly _logger: Logger;
  private readonly _log: ILogger;
  private readonly _project: Project;

  get project(): Project {
    return this._project;
  }

  get logger(): Logger {
    return this._logger;
  }

  constructor(
    scheduler: RecompilationScheduler,
    project: Project,
    config: IConfig,
    logger: Logger,
    defaultPort?: number,
  ) {
    this._logger = logger;
    this._log = logger.log('graph');
    this._config = config;
    this._project = project;
    this._log.debug('Building graph with', project);
    this.projectRoot = project.cwd;
    const services = project.workspaces.filter((n) => isService(n.cwd));
    this.ports = resolvePorts(services, config, logger, defaultPort);
    const builtNodes: Set<Node> = new Set<Node>();
    this._log.debug(project.workspaces.map((w) => getName(w)));
    for (const node of project.workspaces) {
      if (project.topLevelWorkspace === node) {
        this._log.info('Ignoring top-level workspace', getName(project.topLevelWorkspace));
        continue;
      }
      if (!Array.from(builtNodes).some((n) => n.getName() === getName(node))) {
        this._log.debug('Building node', getName(node));
        this._log.debug(
          'Already built',
          Array.from(builtNodes).map((b) => b.getName()),
        );
        this._log.debug('Is service', isService(node.cwd));
        isService(node.cwd)
          ? new Service(scheduler, this, node, builtNodes, project)
          : new Package(scheduler, this, node, builtNodes, project);
      }
    }
    this.nodes = Array.from(builtNodes);
    this._log.debug(
      'Built graph',
      this.nodes.map((n) => n.getName()),
    );
    this._log.info(`Successfully built ${this.nodes.length} nodes`);
    this._enableNodes();
  }

  public getPort(service: string): number {
    return this.ports[service];
  }

  public registerIPCServer(sockets: IPCSocketsManager): void {
    this.getNodes().forEach((n) => n.registerIPCServer(sockets));
  }

  /**
   * Enables every node that are not already enabled and not excluded by config
   */
  private _enableNodes(): void {
    this.nodes.filter((n) => !n.isEnabled() && !this._config.noStart.includes(n.getName())).forEach((n) => n.enable());
  }

  public getProjectRoot(): string {
    return this.projectRoot;
  }

  public getServices(): Service[] {
    return this.nodes.filter((n) => n.isService()) as Service[];
  }
  public getPackages(): Package[] {
    return this.nodes.filter((n) => !n.isService()) as Package[];
  }

  public getNodes(): Node[] {
    return this.nodes;
  }

  public get(name: string): Node | undefined {
    return this.nodes.find((n) => n.getName() === name);
  }

  // TODO: Check if dependencies correctly installed
  /**
  public async install(): Promise<void> {
    await this._project.install({ cache: null, report: null });
  }*/
}
