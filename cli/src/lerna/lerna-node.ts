import { LernaGraph } from './lerna-graph';
import { existsSync, watch } from 'fs';
import { join } from 'path';
import { Package, Service } from './';
import { CompilationStatus } from './enums/compilation.status';
import { log } from '../utils/logger';
import glob from 'glob';
import { RecompilationScheduler } from '../utils/scheduler';
import chalk from 'chalk';
import { ChildProcess, execSync, spawn } from 'child_process';
import { Observable } from 'rxjs';

const tsVersion = execSync('npx tsc --version')
  .toString()
  .match(/[0-9]\.[0-9]\.[0-9]/)[0];

export interface IGraphElement {
  name: string;
  version: string;
  private: boolean;
  location: string;
  dependencies: string[];
}

enum NodeStatus {
  DISABLED,
  ENABLED,
}

export abstract class LernaNode {
  protected readonly name: string;
  protected readonly location: string;
  protected readonly graph: LernaGraph;
  protected readonly dependencies: LernaNode[];

  private readonly version: string;
  private readonly private: boolean;

  protected compilationStatus: CompilationStatus;
  protected compilationProcess: ChildProcess;
  private nodeStatus: NodeStatus;

  public constructor(graph: LernaGraph, node: IGraphElement, nodes: LernaNode[], elements: IGraphElement[]) {
    log.debug('Building node', node.name);
    this.graph = graph;
    this.name = node.name;
    this.version = node.version;
    this.private = node.private;
    this.location = node.location;
    this.nodeStatus = NodeStatus.DISABLED;
    this.compilationStatus = CompilationStatus.NOT_COMPILED;
    this.dependencies = node.dependencies.map((d) => {
      const dep = nodes.find((n) => n.name === d);
      if (dep) {
        log.debug('Dependency is already built', d);
        return dep;
      }
      log.debug('Building dependency', d);
      const elt = elements.find((e) => e.name === d);
      return this.isService() ? new Service(graph, elt, nodes, elements) : new Package(graph, elt, nodes, elements);
    });
    log.debug('Node built', this.name);
  }

  public enable(): void {
    this.nodeStatus = NodeStatus.ENABLED;
  }

  public isEnabled(): boolean {
    return this.nodeStatus === NodeStatus.ENABLED;
  }

  public isService(): boolean {
    return existsSync(join(this.location, 'serverless.yml')) || existsSync(join(this.location, 'serverless.yaml'));
  }

  public getCompilationStatus() {
    return this.compilationStatus;
  }

  public getChildren() {
    return this.dependencies;
  }

  public getChild(name: string) {
    return this.dependencies.find((d) => d.name === name);
  }

  public setStatus(status: CompilationStatus) {
    this.compilationStatus = status;
  }

  public isRoot(): boolean {
    return this.getDependent().length === 0;
  }

  public getName(): string {
    return this.name;
  }
  public getLocation(): string {
    return this.location;
  }

  public getDependencies(): LernaNode[] {
    const deps: LernaNode[] = [];
    this._getDependencies(deps);
    return deps;
  }

  private _getDependencies(deps: LernaNode[]): void {
    for (const dep of this.dependencies) {
      deps.push(dep);
      dep._getDependencies(deps);
    }
  }

  /**
   * Get all dependents nodes.
   */
  public getDependent(): LernaNode[] {
    const dependent = this.graph.getNodes().filter((n) =>
      n
        .getDependencies()
        .map((n) => n.name)
        .includes(this.name),
    );
    log.silly(
      `Nodes depending upon ${this.name}`,
      dependent.map((d) => d.name),
    );
    return dependent;
  }

  /**
   * Get the direct parents in dependency tree.
   */
  public getParents(): LernaNode[] {
    return this.graph.getNodes().filter((n) => n.dependencies.some((d) => d.name === this.name));
  }

  /**
   * Recursively compiles this package and all its dependencies
   */
  public compile(scheduler: RecompilationScheduler): void {
    if (!this.isEnabled()) {
      log.debug('Node is disabled', this.name);
      return;
    }
    log.debug('Recursively compile', this.name);
    for (const dep of this.dependencies) {
      log.debug('Compiling dependency first', dep.name);
      try {
        dep.compile(scheduler);
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
        watch(path, (event, filename) => {
          log.info(`${chalk.bold(this.name)}: ${path} changed. Recompiling`);
          this._recompile(scheduler);
        });
      });
    });
  }

  private async _recompile(scheduler: RecompilationScheduler): Promise<void> {
    scheduler.abort();
    const dependentNodes = this.getDependent()
      .concat(this)
      .filter((n) => n.isEnabled());
    log.debug(
      `${chalk.bold(this.name)}: Dependent nodes`,
      dependentNodes.map((d) => d.name),
    );
    const dependentServices = dependentNodes.filter((dep) => dep instanceof Service);
    log.debug(
      `${chalk.bold(this.name)}: Dependent services`,
      dependentServices.map((d) => d.name),
    );
    log.debug(`${chalk.bold(this.name)}: Stopping dependent services`);
    dependentServices.forEach((s: Service) => scheduler.requestStop(s));
    this._recompileUpstream(scheduler);
    dependentServices.forEach((s: Service) => scheduler.requestStart(s));
    await scheduler.exec();
  }

  private _recompileUpstream(scheduler: RecompilationScheduler): void {
    log.debug(`${chalk.bold(this.name)}: Recompiling upstream`);
    scheduler.requestCompilation(this);
    for (const parent of this.getParents()) {
      parent._recompileUpstream(scheduler);
    }
  }

  public compileNode(): Observable<LernaNode> {
    return new Observable<LernaNode>((observer) => {
      log.info(`Compiling package ${this.name} with typescript ${tsVersion}`);
      switch (this.compilationStatus) {
        case CompilationStatus.COMPILED:
        case CompilationStatus.ERROR_COMPILING:
        case CompilationStatus.NOT_COMPILED:
          this._startCompilation();
          this._watchCompilation().subscribe(
            (next) => observer.next(next),
            (err) => observer.error(err),
            () => observer.complete(),
          );
          break;
        case CompilationStatus.COMPILING:
          // Already compiling, just wait for it to complete
          this._watchCompilation().subscribe(
            (next) => observer.next(next),
            (err) => observer.error(err),
            () => observer.complete(),
          );
          break;
      }
    });
  }

  private _startCompilation(): void {
    this.setStatus(CompilationStatus.COMPILING);
    this.compilationProcess = spawn('npx', ['tsc'], {
      cwd: this.location,
      env: process.env,
    });
    this.compilationProcess.stderr.on('data', (data) => log.error(`${chalk.bold(this.name)}: ${data}`));
    this.compilationProcess.stdout.on('data', (data) => log.debug(`${chalk.bold(this.name)}: ${data}`));
  }

  private _watchCompilation(): Observable<LernaNode> {
    return new Observable<LernaNode>((observer) => {
      this.compilationProcess.on('close', (code) => {
        log.silly('npx tsc process closed');
        if (code === 0) {
          this.setStatus(CompilationStatus.COMPILED);
          log.info(`Package compiled ${this.getName()}`);
          observer.next(this);
          // this.compilationProcess.removeAllListeners('close');
          return observer.complete();
        } else {
          this.setStatus(CompilationStatus.ERROR_COMPILING);
          log.info(`Error compiling ${this.getName()}`);
          // this.compilationProcess.removeAllListeners('close');
          return observer.error();
        }
      });
      this.compilationProcess.on('error', (err) => {
        log.silly('npx tsc process error');
        log.error(err);
        this.setStatus(CompilationStatus.ERROR_COMPILING);
        log.info(`Error compiling ${this.getName()}`, err);
        // this.compilationProcess.removeAllListeners('error');
        return observer.error(err);
      });
    });
  }
}
