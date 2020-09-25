import { IGraphElement, LernaNode } from './';
import { existsSync } from 'fs';
import { join } from 'path';
import { Package } from './';
import { Service } from './';
import { resolvePorts } from '../utils/resolve-ports';
import { IConfig } from '../config/config';
import { spawn } from 'child_process';
import { Logger } from '../utils/logger';
import { IPCSocketsManager } from '../ipc/socket';
import { IOSocketManager } from '../server/socket';
import { RecompilationScheduler } from '../utils/scheduler';

export const isService = (location: string): boolean => {
  return existsSync(join(location, 'serverless.yml')) || existsSync(join(location, 'serverless.yaml'));
};

export class LernaGraph {
  private _io: IOSocketManager;

  private readonly _config: IConfig;
  private readonly projectRoot: string;
  private readonly ports: { [key: string]: number };
  private readonly nodes: LernaNode[];
  private readonly _logger: Logger;
  get logger(): Logger {
    return this._logger;
  }
  get io(): IOSocketManager {
    return this._io;
  }

  constructor(scheduler: RecompilationScheduler, nodes: IGraphElement[], projectRoot: string, config: IConfig, logger: Logger, defaultPort?: number) {
    this._logger = logger;
    this._config = config;
    this._logger.log('graph').debug('Building graph with', nodes);
    this.projectRoot = projectRoot;
    const services = nodes.filter((n) => isService(n.location));
    this.ports = resolvePorts(services, config, this._logger, defaultPort);
    const builtNodes: Set<LernaNode> = new Set<LernaNode>();
    for (const node of nodes) {
      if (!Array.from(builtNodes).some((n) => n.getName() === node.name)) {
        this._logger.log('graph').debug('Building node', node.name);
        this._logger.log('graph').debug(
          'Already built',
          Array.from(builtNodes).map((b) => b.getName()),
        );
        this._logger.log('graph').debug('Is service', isService(node.location));
        isService(node.location)
          ? new Service(scheduler, this, node, builtNodes, nodes)
          : new Package(scheduler, this, node, builtNodes, nodes);
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
  public enableOne(node: LernaNode): void {
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
  public disableOne(node: LernaNode): void {
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

  public getNodes(): LernaNode[] {
    return this.nodes;
  }

  public get(name: string): LernaNode {
    return this.nodes.find((n) => n.getName() === name);
  }

  public async bootstrap(): Promise<void> {
    this._logger.log('graph').info('Bootstrapping dependencies');
    const spawnedProcess = spawn('npx', ['lerna', 'bootstrap'], {
      cwd: this.projectRoot,
      stdio: 'ignore',
    });
    return new Promise<void>((resolve, reject) => {
      spawnedProcess.on('close', (code) => {
        if (code === 0) {
          return resolve();
        }
        const err = `Process exited with status ${code}`;
        this._logger.log('graph').error(err);
        return reject(err);
      });
      spawnedProcess.on('error', (err) => {
        this._logger.log('graph').error('Process errored: ', err.message);
        return reject(err);
      });
    });
  }

  registerIOSockets(io: IOSocketManager) {
    this._io = io;
  }
}
