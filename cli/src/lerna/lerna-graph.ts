import { IGraphElement, LernaNode } from './';
import { existsSync } from 'fs';
import { join } from 'path';
import { Package } from './';
import { Service } from './';
import { resolvePorts } from '../utils/resolve-ports';
import { IConfig } from '../config/config';
import { spawn } from 'child_process';
import { log } from '../utils/logger';
import { SocketsManager } from '../ipc/socket';

export const isService = (location: string): boolean => {
  return existsSync(join(location, 'serverless.yml')) || existsSync(join(location, 'serverless.yaml'));
};

export class LernaGraph {
  private readonly _config: IConfig;
  private readonly projectRoot: string;
  private readonly ports: { [key: string]: number };
  private readonly nodes: LernaNode[];

  constructor(nodes: IGraphElement[], projectRoot: string, config: IConfig, defaultPort?: number) {
    this._config = config;
    log('graph').debug('Building graph with', nodes);
    this.projectRoot = projectRoot;
    const services = nodes.filter((n) => isService(n.location));
    this.ports = resolvePorts(services, config, defaultPort);
    const builtNodes: Set<LernaNode> = new Set<LernaNode>();
    for (const node of nodes) {
      if (!Array.from(builtNodes).some((n) => n.getName() === node.name)) {
        log('graph').debug('Building node', node.name);
        log('graph').debug(
          'Already built',
          Array.from(builtNodes).map((b) => b.getName()),
        );
        log('graph').debug('Is service', isService(node.location));
        isService(node.location)
          ? new Service(this, node, builtNodes, nodes)
          : new Package(this, node, builtNodes, nodes);
      }
    }
    this.nodes = Array.from(builtNodes);
    log('graph').debug(
      'Built graph',
      this.nodes.map((n) => n.getName()),
    );
    log('graph').info(`Successfully built ${this.nodes.length} nodes`);
  }

  public getPort(service: string): number {
    return this.ports[service];
  }

  public registerIPCServer(sockets: SocketsManager): void {
    this.getNodes().forEach((n) => n.registerIPCServer(sockets));
  }

  public enableNodes(): void {
    log('graph').debug('Enabling nodes descendants');
    this.nodes
      .filter((n) => n.isEnabled())
      .forEach((n) => {
        log('graph').debug('Enabling node descendants', n.getName());
        const dependencies = n.getDependencies();
        log('graph').silly('Descendants', n.getDependencies());
        dependencies.forEach((d) => d.enable());
      });
  }

  /**
   * Enable a given node and all his descendants
   * @param node
   */
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
    log('graph').info('Bootstrapping dependencies');
    const spawnedProcess = spawn('npx', ['lerna', 'bootstrap'], {
      cwd: this.projectRoot,
      stdio: 'inherit',
    });
    return new Promise<void>((resolve, reject) => {
      spawnedProcess.on('close', (code) => {
        if (code === 0) {
          return resolve();
        }
        const err = `Process exited with status ${code}`;
        log('graph').error(err);
        return reject(err);
      });
      spawnedProcess.on('error', (err) => {
        log('graph').error('Process errored: ', err.message);
        return reject(err);
      });
    });
  }
}
