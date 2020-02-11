import { IGraphElement, LernaNode } from './lerna-node';
import { existsSync } from "fs";
import { join } from "path";
import { Package } from './package';
import { Service } from './service';
import { resolvePorts } from '../utils/resolve-ports';
import { IConfig } from '../config/config';

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

  public getProjectRoot() { return this.projectRoot }

  public getServices(): Service[] { return this.nodes.filter(n => n.isService()) as Service[] }
  public getPackages(): Package[] { return this.nodes.filter(n => !n.isService()) as Package[] }

  public getNodes(): LernaNode[] { return this.nodes }

  private getRootNodes(): LernaNode[] { return this.nodes.filter(n => n.isRoot())}

  public get(name: string): LernaNode {
    return this.nodes.find(n => n.getName() === name);
  }

  public bootstrap(): void {
    // NPX LERNA BOOTSTRAP
  }

  public compile(): void {
    // NPX LERNA RUN TSC
  }
}
