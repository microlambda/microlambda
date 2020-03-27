import { isService, LernaGraph } from './lerna-graph';
import { existsSync, watch } from 'fs';
import { join } from 'path';
import { Package, Service } from './';
import { CompilationStatus } from './enums/compilation.status';
import { log, prefix } from '../utils/logger';
import glob from 'glob';
import chalk from 'chalk';
import { ChildProcess, execSync, spawn } from 'child_process';
import { Observable } from 'rxjs';
import { RecompilationMode, RecompilationScheduler } from '../utils/scheduler';
import { SocketsManager } from '../ipc/socket';
import { getBinary } from '../utils/external-binaries';

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
  protected _ipc: SocketsManager;

  public constructor(graph: LernaGraph, node: IGraphElement, nodes: Set<LernaNode>, elements: IGraphElement[]) {
    log('node').debug('Building node', node.name);
    this.graph = graph;
    this.name = node.name;
    this.version = node.version;
    this.private = node.private;
    this.location = node.location;
    this.nodeStatus = NodeStatus.DISABLED;
    this.compilationStatus = CompilationStatus.NOT_COMPILED;
    this.dependencies = node.dependencies.map((d) => {
      const dep = Array.from(nodes).find((n) => n.name === d);
      if (dep) {
        log('node').debug('Dependency is already built', d);
        return dep;
      }
      log('node').debug('Building dependency', d);
      const elt = elements.find((e) => e.name === d);
      log('node').debug('Is service', { name: d, result: isService(elt.location) });
      return isService(elt.location)
        ? new Service(graph, elt, nodes, elements)
        : new Package(graph, elt, nodes, elements);
    });
    log('node').debug('Node built', this.name);
    nodes.add(this);
  }

  public enable(): void {
    this.nodeStatus = NodeStatus.ENABLED;
  }

  public disable(): void {
    this.nodeStatus = NodeStatus.DISABLED;
  }

  public registerIPCServer(sockets: SocketsManager): void {
    this._ipc = sockets;
  }

  public isEnabled(): boolean {
    return this.nodeStatus === NodeStatus.ENABLED;
  }

  public isService(): boolean {
    log('node').debug('Is service', {
      node: this.getName(),
      location: join(this.location, 'serverless.yml'),
      result: existsSync(join(this.location, 'serverless.yml')),
    });
    return existsSync(join(this.location, 'serverless.yml')) || existsSync(join(this.location, 'serverless.yaml'));
  }

  public getCompilationStatus(): CompilationStatus {
    return this.compilationStatus;
  }

  public getChildren(): LernaNode[] {
    return this.dependencies;
  }

  public getChild(name: string): LernaNode {
    return this.dependencies.find((d) => d.name === name);
  }

  public setStatus(status: CompilationStatus): void {
    this.compilationStatus = status;
    this._ipc.graphUpdated();
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
    log('node').silly(
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

  public async watch(scheduler: RecompilationScheduler): Promise<void> {
    log('node').debug('Watching sources', `${this.location}/src/**/*.{ts,js,json}`);
    glob(`${this.location}/src/**/*.{ts,js,json}`, (err, matches) => {
      if (err) {
        log('node').error('Error determining files to watch', matches);
      }
      matches.forEach((path) => {
        log('node').debug('Watching', path);
        watch(path, () => {
          log('node').info(`${chalk.bold(this.name)}: ${path} changed. Recompiling`);
          scheduler.fileChanged(this);
        });
      });
    });
  }

  public compileNode(mode = RecompilationMode.LAZY): Observable<LernaNode> {
    return new Observable<LernaNode>((observer) => {
      switch (this.compilationStatus) {
        case CompilationStatus.COMPILED:
        case CompilationStatus.ERROR_COMPILING:
        case CompilationStatus.NOT_COMPILED:
          this._startCompilation(mode);
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

  private _startCompilation(mode: RecompilationMode): void {
    this.setStatus(CompilationStatus.COMPILING);
    if (mode === RecompilationMode.LAZY) {
      log('node').info('Fast-compiling using transpile-only', this.name);
      this.compilationProcess = spawn(
        getBinary('babel', this.graph.getProjectRoot(), this),
        ['src', '--out-dir', 'lib', '--extensions', '.ts', '--presets', '@babel/preset-typescript'],
        {
          cwd: this.location,
          env: process.env,
        },
      );
      this.compilationProcess.stdout.on('data', (data) => process.stdout.write(prefix.info + ' ' + data.toString()));
    } else {
      log('node').info('Safe-compiling performing type-checks', this.name);
      this.compilationProcess = spawn(getBinary('tsc', this.graph.getProjectRoot(), this), {
        cwd: this.location,
        env: process.env,
        stdio: 'inherit',
      });
    }
  }

  private _watchCompilation(): Observable<LernaNode> {
    return new Observable<LernaNode>((observer) => {
      this.compilationProcess.on('close', (code) => {
        log('node').silly('npx tsc process closed');
        if (code === 0) {
          this.setStatus(CompilationStatus.COMPILED);
          log('node').info(`Package compiled ${this.getName()}`);
          observer.next(this);
          // this.compilationProcess.removeAllListeners('close');
          return observer.complete();
        } else {
          this.setStatus(CompilationStatus.ERROR_COMPILING);
          log('node').info(`Error compiling ${this.getName()}`);
          // this.compilationProcess.removeAllListeners('close');
          return observer.error();
        }
      });
      this.compilationProcess.on('error', (err) => {
        log('node').silly('npx tsc process error');
        log('node').error(err);
        this.setStatus(CompilationStatus.ERROR_COMPILING);
        log('node').info(`Error compiling ${this.getName()}`, err);
        // this.compilationProcess.removeAllListeners('error');
        return observer.error(err);
      });
    });
  }
}
