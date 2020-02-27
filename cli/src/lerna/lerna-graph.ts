import { IGraphElement, LernaNode } from './';
import { existsSync } from 'fs';
import { join } from 'path';
import { Package } from './';
import { Service } from './';
import { resolvePorts } from '../utils/resolve-ports';
import { IConfig } from '../config/config';
import { spawn } from 'child_process';
import { log } from '../utils/logger';
import { RecompilationScheduler } from '../utils/scheduler';

export const isService = (location: string): boolean => {
  return existsSync(join(location, 'serverless.yml')) || existsSync(join(location, 'serverless.yaml'));
};

export class LernaGraph {
  private readonly projectRoot: string;
  private readonly ports: { [key: string]: number };
  private readonly nodes: LernaNode[];

  constructor(nodes: IGraphElement[], projectRoot: string, config: IConfig, defaultPort?: number) {
    log.debug('Building graph with', nodes);
    this.projectRoot = projectRoot;
    const services = nodes.filter((n) => isService(n.location));
    this.ports = resolvePorts(services, config, defaultPort);
    const builtNodes: Set<LernaNode> = new Set<LernaNode>();
    for (const node of nodes) {
      if (!Array.from(builtNodes).some((n) => n.getName() === node.name)) {
        log.debug('Building node', node.name);
        log.debug(
          'Already built',
          Array.from(builtNodes).map((b) => b.getName()),
        );
        log.debug('Is service', isService(node.location));
        isService(node.location)
          ? new Service(this, node, builtNodes, nodes)
          : new Package(this, node, builtNodes, nodes);
      }
    }
    this.nodes = Array.from(builtNodes);
    log.debug(
      'Built graph',
      this.nodes.map((n) => n.getName()),
    );
    log.info(`Successfully built ${this.nodes.length} nodes`);
  }

  public getPort(service: string): number {
    return this.ports[service];
  }

  public enableNodes(): void {
    log.debug('Enabling nodes descendants');
    this.nodes
      .filter((n) => n.isEnabled())
      .forEach((n) => {
        log.debug('Enabling node descendants', n.getName());
        const dependencies = n.getDependencies();
        log.silly('Descendants', n.getDependencies());
        dependencies.forEach((d) => d.enable());
      });
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

  private getRootNodes(): LernaNode[] {
    return this.nodes.filter((n) => n.isRoot());
  }

  public get(name: string): LernaNode {
    return this.nodes.find((n) => n.getName() === name);
  }

  public async bootstrap(): Promise<void> {
    log.info('Bootstrapping dependencies');
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
        log.error(err);
        return reject(err);
      });
      spawnedProcess.on('error', (err) => {
        log.error('Process errored: ', err.message);
        return reject(err);
      });
    });
  }

  public async compile(scheduler: RecompilationScheduler): Promise<void> {
    log.info('Compiling dependency graph');
    const roots = this.getRootNodes();
    log.debug(
      'Roots nodes',
      roots.map((n) => n.getName()),
    );
    // Proceed sequentially has leaf packages have to be compiled first
    for (const root of roots) {
      await root.compile(scheduler);
    }
    return scheduler.exec();
  }
}
