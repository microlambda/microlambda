import { Node } from './';
import { existsSync } from 'fs';
import { join } from 'path';
import { Package } from './';
import { Service } from './';
import { resolvePorts } from '../resolve-ports';
import { IConfig } from '../config/config';
import { Logger } from '../logger';
import { IPCSocketsManager } from '../ipc/socket';
//import { IOSocketManager } from '@microlambda/server';
import { RecompilationScheduler } from '../scheduler';
import { Project } from '@yarnpkg/core';
import { getName } from '../yarn/project';

export const isService = (location: string): boolean => {
  return existsSync(join(location, 'serverless.yml')) || existsSync(join(location, 'serverless.yaml'));
};

export class DependenciesGraph {
  //private _io: IOSocketManager;

  private readonly _config: IConfig;
  private readonly projectRoot: string;
  private readonly ports: { [key: string]: number };
  private readonly nodes: Node[];
  private readonly _logger: Logger;
  private readonly _project: Project;
  get logger(): Logger {
    return this._logger;
  }
  /*get io(): IOSocketManager {
    return this._io;
  }*/

  get project(): Project {
    return this._project;
  }

  constructor(
    scheduler: RecompilationScheduler,
    project: Project,
    config: IConfig,
    logger: Logger,
    defaultPort?: number,
  ) {
    this._logger = logger;
    this._config = config;
    this._project = project;
    this._logger.log('graph').debug('Building graph with', project);
    this.projectRoot = project.cwd;
    const services = project.workspaces.filter((n) => isService(n.cwd));
    this.ports = resolvePorts(services, config, this._logger, defaultPort);
    const builtNodes: Set<Node> = new Set<Node>();
    this._logger.log('graph').debug(project.workspaces.map((w) => getName(w)));
    for (const node of project.workspaces) {
      if (!Array.from(builtNodes).some((n) => n.getName() === getName(node))) {
        this._logger.log('graph').debug('Building node', getName(node));
        this._logger.log('graph').debug(
          'Already built',
          Array.from(builtNodes).map((b) => b.getName()),
        );
        this._logger.log('graph').debug('Is service', isService(node.cwd));
        isService(node.cwd)
          ? new Service(scheduler, this, node, builtNodes, project)
          : new Package(scheduler, this, node, builtNodes, project);
      }
    }
    this.nodes = Array.from(builtNodes);
    this._logger.log('graph').debug(
      'Built graph',
      this.nodes.map((n) => n.getName()),
    );
    this._logger.log('graph').info(`Successfully built ${this.nodes.length} nodes`);
  }

  public getPort(service: string): number {
    return this.ports[service];
  }

  public registerIPCServer(sockets: IPCSocketsManager): void {
    this.getNodes().forEach((n) => n.registerIPCServer(sockets));
  }

  public enableNodes(): void {
    this._logger.log('graph').debug('Enabling nodes descendants');
    this.nodes
      .filter((n) => n.isEnabled())
      .forEach((n) => {
        this._logger.log('graph').debug('Enabling node descendants', n.getName());
        const dependencies = n.getDependencies();
        this._logger.log('graph').silly('Descendants', n.getDependencies());
        dependencies.forEach((d) => d.enable());
      });
  }

  /**
   * Enable a given node and all his descendants
   * @param node
   */
  // FIXME: Enabled status should only be used to discard node excluded by config, not for partial run
  public enableOne(node: Node): void {
    node.enable();
    node
      .getDependencies()
      .filter((n) => !n.isEnabled() && !this._config.noStart.includes(n.getName()))
      .forEach((n) => n.enable());
  }

  /**
   * Disable a given node and all his descendants that are not used by an other enabled node
   * @param node
   */
  // FIXME: Enabled status should only be used to discard node excluded by config, not for partial run
  public disableOne(node: Node): void {
    node.disable();
    node
      .getDependencies()
      .filter((n) => n.isEnabled() && !n.getDependent().some((ancestors) => ancestors.isEnabled()))
      .forEach((n) => n.disable());
  }

  /**
   * Enables every node that are not already enabled and not excluded by config
   */
  public enableAll(): void {
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

  public get(name: string): Node {
    return this.nodes.find((n) => n.getName() === name);
  }

  // TODO: Check if dependencies correctly installed
  /**
  public async install(): Promise<void> {
    await this._project.install({ cache: null, report: null });
  }*/

  /*registerIOSockets(io: IOSocketManager): void {
    this._io = io;
  }*/
}
