import { LernaGraph } from './lerna-graph';
import { existsSync, watch } from 'fs';
import { join } from 'path';
import { Package, Service } from './';
import { CompilationStatus } from './enums/compilation.status';
import { log } from '../utils/logger';
import glob from 'glob';
import { RecompilationScheduler } from '../utils/scheduler';
import chalk from 'chalk';

export interface IGraphElement {
  name: string;
  version: string;
  private: boolean;
  location: string;
  dependencies: IGraphElement[];
}

export abstract class LernaNode {
  protected readonly name: string;
  protected readonly location: string;
  protected readonly graph: LernaGraph;
  protected readonly dependencies: LernaNode[];

  private readonly version: string;
  private readonly private: boolean;

  protected compilationStatus: CompilationStatus;

  protected constructor(graph: LernaGraph, node: IGraphElement) {
    this.graph = graph;
    this.name = node.name;
    this.version = node.version;
    this.private = node.private;
    this.location = node.location;
    this.compilationStatus = CompilationStatus.NOT_COMPILED;
    this.dependencies = node.dependencies.map(d => this.isService() ? new Service(graph, d) : new Package(graph, d));
  };

  public isService(): boolean {
    return existsSync(join(this.location, 'serverless.yml')) || existsSync(join(this.location, 'serverless.yaml'));
  };

  public setStatus(status: CompilationStatus) {
    this.compilationStatus = status;
  }

  public isRoot(): boolean {
    return this.getDependent().length === 0;
  }

  public getName(): string { return this.name }
  public getLocation(): string { return this.location }

  public getDependencies(): LernaNode[] {

    const hasNext = (previous: LernaNode): boolean  => previous.dependencies.length > 0;

    const concatNext = (deps: Set<string>, currentNode: LernaNode, depth = 0): void => {
      if (hasNext(currentNode)) {
        for (const node of currentNode.dependencies) {
          if (!deps.has(node.name)) {
            deps.add(node.name);
          }
          concatNext(deps, node, depth + 1);
        }
      }
    };

    const dependencies: Set<string> = new Set();
    concatNext(dependencies, this);
    const dependencyNodes = Array.from(dependencies).map(name => this.graph.get(name));
    log.silly(`Node ${this.name} has the following dependencies`, dependencyNodes.map(d => d.name));
    return dependencyNodes;
  }

  /**
   * Get all dependents nodes.
   */
  public getDependent(): LernaNode[] {
    const dependent = this.graph.getNodes()
      .filter(n => n
        .getDependencies()
        .map(n => n .name)
        .includes(this.name));
    log.silly(`Nodes depending upon ${this.name}`, dependent.map(d => d.name));
    return dependent;
  }

  /**
   * Get the direct parents in dependency tree.
   */
  public getParents(): LernaNode[] {
    return this.graph.getNodes()
      .filter(n => n.dependencies.some(d => d.name === this.name))
  }

  /**
   * Recursively compiles this package and all its dependencies
   */
  public compile(scheduler: RecompilationScheduler): void {
    log.debug('Recursively compile', this.name);
    for (const dep of this.dependencies) {
      log.debug('Compiling dependency first', dep.name);
      try {
        dep.compile(scheduler)
      } catch (e) {
        log.error(e);
        throw e;
      }
    }
    scheduler.requestCompilation(this);
  }

  public async watch(scheduler: RecompilationScheduler) {
    log.debug('Watching sources', `${this.location}/src/**/*.{ts,js,json}`);
    glob(`${this.location}/src/**/*.{ts,js,json}`, (err, matches) => {
      if (err) {
        log.error('Error determining files to watch', matches);
      }
      matches.forEach((path) => {
        log.debug('Watching', path);
        watch(path, ((event, filename) => {
            log.info(`${chalk.bold(this.name)}: ${path} changed. Recompiling`);
            this._recompile(scheduler);
        }));
      })
    })
  }

  private async _recompile(scheduler: RecompilationScheduler): Promise<void> {
    // scheduler.abort();
    const dependentNodes = this.getDependent().concat(this);
    log.debug(`${chalk.bold(this.name)}: Dependent nodes`, dependentNodes.map(d => d.name));
    const dependentServices = dependentNodes.filter(dep => dep instanceof Service);
    log.debug(`${chalk.bold(this.name)}: Dependent services`, dependentServices.map(d => d.name));
    log.debug(`${chalk.bold(this.name)}: Stopping dependent services`);
    await Promise.all(dependentServices.map((s: Service) => s.stop()));
    this._recompileUpstream(scheduler);
    dependentServices.forEach((s: Service) => scheduler.requestStart(s));
    await scheduler.exec()
  }

  private _recompileUpstream(scheduler: RecompilationScheduler): void {
    log.debug(`${chalk.bold(this.name)}: Recompiling upstream`);
    scheduler.requestCompilation(this);
    for (const parent of this.getParents()) {
      parent._recompileUpstream(scheduler);
    }
  }
}
