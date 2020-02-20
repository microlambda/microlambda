import { IGraphElement, LernaNode } from './';
import { existsSync } from "fs";
import { join } from "path";
import { Package } from './';
import { Service } from './';
import { resolvePorts } from '../utils/resolve-ports';
import { IConfig } from '../config/config';
import { spawn } from 'child_process';
import { log } from '../utils/logger';
import { RecompilationScheduler } from '../utils/scheduler';

export class LernaGraph {

  private readonly projectRoot: string;
  private readonly ports: {[key: string]: number};
  private readonly nodes: LernaNode[];

  constructor(nodes: IGraphElement[], projectRoot: string, config: IConfig, defaultPort?: number) {
    this.projectRoot = projectRoot;
    const isService = (location: string) => {
      return existsSync(join(location, 'serverless.yml')) || existsSync(join(location, 'serverless.yaml'));
    };
    const services = nodes.filter(n => isService(n.location));
    this.ports = resolvePorts(services, config, defaultPort);
    this.nodes = nodes.map(n => isService(n.location) ? new Service(this, n) : new Package(this, n));
  };

  public getPort(service: string) {
    return this.ports[service];
  }

  public enableNodes(): void {
    this.nodes.filter(n => n.enabled).forEach(n => {
      const dependencies = n.getDependencies();
      dependencies.forEach(d => d.enable());
    })
  }

  public getProjectRoot() { return this.projectRoot }

  public getServices(): Service[] { return this.nodes.filter(n => n.isService()) as Service[] }
  public getPackages(): Package[] { return this.nodes.filter(n => !n.isService()) as Package[] }

  public getNodes(): LernaNode[] { return this.nodes }

  private getRootNodes(): LernaNode[] { return this.nodes.filter(n => n.isRoot())}

  public get(name: string): LernaNode {
    return this.nodes.find(n => n.getName() === name);
  }

  public async bootstrap(): Promise<void> {
    log.info('Bootstrapping dependencies');
    const spawnedProcess = spawn('npx', ['lerna', 'bootstrap'], {
      cwd: this.projectRoot,
    });
    return new Promise<void>((resolve, reject) => {
      spawnedProcess.stdout.on('data', (data) => log.debug(data.toString()));
      spawnedProcess.stderr.on('data', (data) => log.debug(data.toString()));
      spawnedProcess.on('close', (code) => {
        if (code === 0) {
          return resolve();
        }
        return reject();
      });
    });
  }

  public async compile(scheduler: RecompilationScheduler): Promise<void> {
    log.info('Compiling dependency graph');
    const roots = this.getRootNodes();
    log.debug('Roots nodes', roots.map(n => n.getName()));
    // Proceed sequentially has leaf packages have to be compiled first
    for(const root of roots) {
      await root.compile(scheduler);
    }
    return scheduler.exec();
  }
}
