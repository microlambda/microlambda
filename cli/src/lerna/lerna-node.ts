import { isService, LernaGraph } from './lerna-graph';
import { existsSync, watch } from 'fs';
import { join } from 'path';
import { Package, Service } from './';
import { CompilationStatus } from './enums/compilation.status';
import glob from 'glob';
import chalk from 'chalk';
import { ChildProcess, spawn } from 'child_process';
import { Observable } from 'rxjs';
import { RecompilationMode, RecompilationScheduler } from '../utils/scheduler';
import { IPCSocketsManager } from '../ipc/socket';
import { getBinary } from '../utils/external-binaries';
import { compileFiles } from '../utils/typescript';
import { checksums, IChecksums } from '../utils/checksums';
import { actions } from '../ui';

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
  protected compilationPromise: Promise<void>;
  private nodeStatus: NodeStatus;
  protected _ipc: IPCSocketsManager;

  public constructor(graph: LernaGraph, node: IGraphElement, nodes: Set<LernaNode>, elements: IGraphElement[]) {
    graph.logger.log('node').debug('Building node', node.name);
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
        this.getGraph()
          .logger.log('node')
          .debug('Dependency is already built', d);
        return dep;
      }
      this.getGraph()
        .logger.log('node')
        .debug('Building dependency', d);
      const elt = elements.find((e) => e.name === d);
      this.getGraph()
        .logger.log('node')
        .debug('Is service', { name: d, result: isService(elt.location) });
      return isService(elt.location)
        ? new Service(graph, elt, nodes, elements)
        : new Package(graph, elt, nodes, elements);
    });
    this.getGraph()
      .logger.log('node')
      .debug('Node built', this.name);
    nodes.add(this);
  }

  public enable(): void {
    this.nodeStatus = NodeStatus.ENABLED;
  }

  public disable(): void {
    this.nodeStatus = NodeStatus.DISABLED;
  }

  public registerIPCServer(sockets: IPCSocketsManager): void {
    this._ipc = sockets;
  }

  public isEnabled(): boolean {
    return this.nodeStatus === NodeStatus.ENABLED;
  }

  public isService(): boolean {
    this.getGraph()
      .logger.log('node')
      .debug('Is service', {
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

  public getGraph(): LernaGraph {
    return this.graph;
  }

  public getVersion(): string {
    return this.version;
  }

  public getChild(name: string): LernaNode {
    return this.dependencies.find((d) => d.name === name);
  }

  public setStatus(status: CompilationStatus): void {
    this.compilationStatus = status;
    if (this._ipc) {
      this.getGraph()
        .logger.log('node')
        .debug('Notifying IPC server of graph update');
      this._ipc.graphUpdated();
    }
    this.getGraph().io.compilationStatusUpdated(this, this.compilationStatus);
    actions.updateCompilationStatus(this);
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
    this.getGraph()
      .logger.log('node')
      .silly(
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
    this.getGraph()
      .logger.log('node')
      .debug('Watching sources', `${this.location}/src/**/*.{ts,js,json}`);
    // TODO: Don't restart service on change, webpack plugin will auto-update
    // FIXME: newly added files are not watched
    // TODO: Restart service on sls.yaml change
    glob(`${this.location}/src/**/*.{ts,js,json}`, (err, matches) => {
      if (err) {
        this.getGraph()
          .logger.log('node')
          .error('Error determining files to watch', matches);
      }
      matches.forEach((path) => {
        this.getGraph()
          .logger.log('node')
          .debug('Watching', path);
        watch(path, () => {
          this.getGraph()
            .logger.log('node')
            .info(`${chalk.bold(this.name)}: ${path} changed. Recompiling`);
          scheduler.fileChanged(this);
        });
      });
    });
  }

  public compileNode(mode = RecompilationMode.FAST): Observable<LernaNode> {
    return new Observable<LernaNode>((observer) => {
      switch (this.compilationStatus) {
        case CompilationStatus.COMPILED:
        case CompilationStatus.ERROR_COMPILING:
        case CompilationStatus.NOT_COMPILED:
          this._startCompilation(mode).then((action) => {
            if (action.recompile) {
              this._watchCompilation(mode).subscribe(
                (next) => observer.next(next),
                (err) => observer.error(err),
                () => {
                  // Update checksums
                  if (action.checksums != null) {
                    checksums(this, this.getGraph().logger)
                      .write(action.checksums)
                      .then(() => {
                        this.getGraph()
                          .logger.log('node')
                          .info('Checksum written', this.name);
                        observer.complete();
                      })
                      .catch((e) => {
                        this.getGraph()
                          .logger.log('node')
                          .debug(e);
                        this.getGraph()
                          .logger.log('node')
                          .warn(
                            `Error caching checksum for node ${this.name}. Next time node will be recompiled event if source does not change`,
                          );
                        observer.complete();
                      });
                  } else {
                    observer.complete();
                  }
                },
              );
            } else {
              this.getGraph()
                .logger.log('node')
                .info(`Skipped recompilation of ${this.name}: sources did not change`);
              observer.next(this);
              observer.complete();
            }
          });
          break;
        case CompilationStatus.COMPILING:
          // Already compiling, just wait for it to complete
          this._watchCompilation(mode).subscribe(
            (next) => observer.next(next),
            (err) => observer.error(err),
            () => observer.complete(),
          );
          break;
      }
    });
  }

  private async _startCompilation(mode: RecompilationMode): Promise<{ recompile: boolean; checksums: IChecksums }> {
    this.setStatus(CompilationStatus.COMPILING);
    if (mode === RecompilationMode.FAST) {
      // Using directly typescript API
      this.getGraph()
        .logger.log('node')
        .info('Fast-compiling using transpile-only', this.name);
      this.compilationPromise = compileFiles(this.location, this.getGraph().logger);
      return { recompile: true, checksums: null };
    } else {
      let recompile = true;
      let currentChecksums: IChecksums = null;
      const checksumUtils = checksums(this, this.getGraph().logger);
      try {
        const oldChecksums = await checksumUtils.read();
        currentChecksums = await checksumUtils.calculate();
        recompile = checksumUtils.compare(oldChecksums, currentChecksums);
      } catch (e) {
        currentChecksums = await checksumUtils.calculate().catch(() => {
          return null;
        });
        this.getGraph()
          .logger.log('node')
          .warn('Error evaluating checksums for node', this.name);
        this.getGraph()
          .logger.log('node')
          .debug(e);
      }
      this.getGraph()
        .logger.log('node')
        .info('Safe-compiling performing type-checks', this.name);
      if (recompile) {
        this.compilationProcess = spawn(getBinary('tsc', this.graph.getProjectRoot(), this.getGraph().logger, this), {
          cwd: this.location,
          env: process.env,
          stdio: 'inherit',
        });
      }
      return { recompile, checksums: currentChecksums };
    }
  }

  private _watchCompilation(mode: RecompilationMode): Observable<LernaNode> {
    return new Observable<LernaNode>((observer) => {
      if (mode === RecompilationMode.FAST) {
        this.compilationPromise
          .then(() => {
            this.getGraph()
              .logger.log('node')
              .info('Package compiled', this.name);
            observer.next(this);
            this.setStatus(CompilationStatus.COMPILED);
            return observer.complete();
          })
          .catch((err) => {
            this.getGraph()
              .logger.log('node')
              .info(`Error compiling ${this.getName()}`, err);
            this.setStatus(CompilationStatus.ERROR_COMPILING);
            return observer.error(err);
          });
      } else {
        this.compilationProcess.on('close', (code) => {
          this.getGraph()
            .logger.log('node')
            .silly('npx tsc process closed');
          if (code === 0) {
            this.setStatus(CompilationStatus.COMPILED);
            this.getGraph()
              .logger.log('node')
              .info(`Package compiled ${this.getName()}`);
            observer.next(this);
            // this.compilationProcess.removeAllListeners('close');
            return observer.complete();
          } else {
            this.setStatus(CompilationStatus.ERROR_COMPILING);
            this.getGraph()
              .logger.log('node')
              .info(`Error compiling ${this.getName()}`);
            // this.compilationProcess.removeAllListeners('close');
            return observer.error();
          }
        });
        this.compilationProcess.on('error', (err) => {
          this.getGraph()
            .logger.log('node')
            .silly('npx tsc process error');
          this.getGraph()
            .logger.log('node')
            .error(err);
          this.setStatus(CompilationStatus.ERROR_COMPILING);
          this.getGraph()
            .logger.log('node')
            .info(`Error compiling ${this.getName()}`, err);
          // this.compilationProcess.removeAllListeners('error');
          return observer.error(err);
        });
      }
    });
  }
}
