import { isService, LernaGraph } from './lerna-graph';
import { existsSync } from 'fs';
import { join } from 'path';
import { Package, Service } from './';
import { TranspilingStatus, TypeCheckStatus } from './enums/compilation.status';
import chalk from 'chalk';
import { ChildProcess, spawn } from 'child_process';
import { Observable } from 'rxjs';
import { RecompilationScheduler } from '../utils/scheduler';
import { IPCSocketsManager } from '../ipc/socket';
import { getBinary } from '../utils/external-binaries';
import { compileFiles } from '../utils/typescript';
import { checksums, IChecksums } from '../utils/checksums';
import { actions } from '../ui';
import { FSWatcher, watch } from 'chokidar';

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

  protected transpilingStatus: TranspilingStatus;
  protected transpilingPromise: Promise<void>;

  protected typeCheckStatus: TypeCheckStatus;
  protected typeCheckProcess: ChildProcess;
  private _typeCheckLogs: string[] = [];

  private _checksums: IChecksums;
  private _lastTypeCheck: string;

  private nodeStatus: NodeStatus;
  protected _ipc: IPCSocketsManager;

  protected _scheduler: RecompilationScheduler;
  private _watchers: FSWatcher[] = [];

  public constructor(scheduler: RecompilationScheduler, graph: LernaGraph, node: IGraphElement, nodes: Set<LernaNode>, elements: IGraphElement[]) {
    graph.logger.log('node').debug('Building node', node.name);
    this.graph = graph;
    this.name = node.name;
    this.version = node.version;
    this.private = node.private;
    this.location = node.location;
    this.nodeStatus = NodeStatus.DISABLED;
    this.transpilingStatus = TranspilingStatus.NOT_TRANSPILED;
    this.typeCheckStatus = TypeCheckStatus.NOT_CHECKED;
    this._scheduler = scheduler;
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
        ? new Service(scheduler, graph, elt, nodes, elements)
        : new Package(scheduler, graph, elt, nodes, elements);
    });
    this.getGraph()
      .logger.log('node')
      .debug('Node built', this.name);
    nodes.add(this);
  }

  get tscLogs() { return this._typeCheckLogs };

  get lastTypeCheck() { return this._lastTypeCheck };

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

  public getTranspilingStatus(): TranspilingStatus {
    return this.transpilingStatus;
  }

  public getTypeCheckStatus(): TypeCheckStatus {
    return this.typeCheckStatus;
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

  public setTranspilingStatus(status: TranspilingStatus): void {
    this.transpilingStatus = status;
    if (this._ipc) {
      this.getGraph()
        .logger.log('node')
        .debug('Notifying IPC server of graph update');
      this._ipc.graphUpdated();
    }
    if (this.getGraph().io) {
      this.getGraph().io.transpilingStatusUpdated(this, this.transpilingStatus);
    }
    actions.updateCompilationStatus(this);
  }

  public setTypeCheckingStatus(status: TypeCheckStatus): void {
    this.typeCheckStatus = status;
    if (this.getGraph().io) {
      this.getGraph().io.typeCheckStatusUpdated(this, this.typeCheckStatus);
    }
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

  public transpile(): Observable<LernaNode> {
    return new Observable<LernaNode>((observer) => {
      switch (this.transpilingStatus) {
        case TranspilingStatus.TRANSPILED:
        case TranspilingStatus.ERROR_TRANSPILING:
        case TranspilingStatus.NOT_TRANSPILED:
          this.transpilingPromise = this._startTranspiling();
          break;
        case TranspilingStatus.TRANSPILING:
          this.getGraph()
            .logger.log('node')
            .info('Package already transpiling', this.name);
          break;
      }
      this.transpilingPromise.then(() => {
        this.getGraph()
          .logger.log('node')
          .info('Package transpiled', this.name);
        observer.next(this);
        this.setTranspilingStatus(TranspilingStatus.TRANSPILED);
        return observer.complete();
      }).catch((err) => {
        this.getGraph()
          .logger.log('node')
          .info(`Error transpiling ${this.getName()}`, err);
        this.setTranspilingStatus(TranspilingStatus.ERROR_TRANSPILING);
        return observer.error(err);
      });
    });
  }

  public performTypeChecking(force = false): Observable<LernaNode> {
    return new Observable<LernaNode>((observer) => {
      switch (this.typeCheckStatus) {
        case TypeCheckStatus.SUCCESS:
        case TypeCheckStatus.ERROR:
        case TypeCheckStatus.NOT_CHECKED:
          this._startTypeChecking(force).then((action) => {
            if (action.recompile) {
              this._watchTypeChecking().subscribe(
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
                        this._checksums = action.checksums;
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
                .info(`Skipped type-checking of ${this.name}: sources did not change`);
              this.setTypeCheckingStatus(TypeCheckStatus.SUCCESS);
              this._typeCheckLogs = [
                'Safe-compilation skipped, sources did not change since last type check. Checksums:',
                JSON.stringify(this._checksums, null, 2),
              ]
              observer.next(this);
              observer.complete();
            }
          });
          break;
        case TypeCheckStatus.CHECKING:
          // Already compiling, just wait for it to complete
          this._watchTypeChecking().subscribe(
            (next) => observer.next(next),
            (err) => observer.error(err),
            () => observer.complete(),
          );
          break;
      }
    });
  }

  private async _startTranspiling(): Promise<void> {
    this.setTranspilingStatus(TranspilingStatus.TRANSPILING);
    // Using directly typescript API
    this.getGraph()
      .logger.log('node')
      .info('Fast-compiling using transpile-only', this.name);
    return compileFiles(this.location, this.getGraph().logger);
  }

  private async _startTypeChecking(force = false): Promise<{ recompile: boolean; checksums: IChecksums }> {
    this.setTypeCheckingStatus(TypeCheckStatus.CHECKING);
    let recompile = true;
    let currentChecksums: IChecksums = null;
    const checksumUtils = checksums(this, this.getGraph().logger);
    if (!force) {
      // FIXME: Checksums => all dependencies nodes must also have no changes to be considered no need to recompile
      try {
        const oldChecksums = await checksumUtils.read();
        currentChecksums = await checksumUtils.calculate();
        this._checksums = currentChecksums;
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
    } else {
      try {
        currentChecksums = await checksumUtils.calculate();
      } catch (e) {
        this.getGraph()
          .logger.log('node')
          .warn('Error evaluating checksums for node', this.name);
      }
    }
    if (recompile) {
      this.typeCheckProcess = spawn(getBinary('tsc', this.graph.getProjectRoot(), this.getGraph().logger, this), {
        cwd: this.location,
        env: { ...process.env, FORCE_COLOR: '2' },
      });
      this.typeCheckProcess.stderr.on('data', (data) => {
        this.getGraph()
          .logger.log('tsc')
          .error(`${chalk.bold(this.name)}: ${data}`);
        this._handleTscLogs(data);
      });
      this.typeCheckProcess.stdout.on('data', (data) => {
        this.getGraph()
          .logger.log('tsc')
          .info(`${chalk.bold(this.name)}: ${data}`);
        this._handleTscLogs(data);
      });
    }
    return { recompile, checksums: currentChecksums };
  }

  private _handleTscLogs(data: any): void {
    this._typeCheckLogs.push(data.toString());
    if(this.getGraph().io) {
      this.getGraph().io.handleTscLogs(this.name, data.toString());
    }
  }

  private _watchTypeChecking(): Observable<LernaNode> {
    return new Observable<LernaNode>((observer) => {
        this.typeCheckProcess.on('close', (code) => {
          this.getGraph()
            .logger.log('node')
            .silly('npx tsc process closed');
          if (code === 0) {
            this.setTypeCheckingStatus(TypeCheckStatus.SUCCESS);
            this.getGraph()
              .logger.log('node')
              .info(`Package safe-compiled ${this.getName()}`);
            observer.next(this);
            this._lastTypeCheck = new Date().toISOString();
            // this.compilationProcess.removeAllListeners('close');
            return observer.complete();
          } else {
            this.setTypeCheckingStatus(TypeCheckStatus.ERROR);
            this.getGraph()
              .logger.log('node')
              .info(`Error safe-compiling ${this.getName()}`);
            // this.compilationProcess.removeAllListeners('close');
            return observer.error();
          }
        });
        this.typeCheckProcess.on('error', (err) => {
          this.getGraph()
            .logger.log('node')
            .silly('npx tsc process error');
          this.getGraph()
            .logger.log('node')
            .error(err);
          this.setTypeCheckingStatus(TypeCheckStatus.ERROR);
          this.getGraph()
            .logger.log('node')
            .info(`Error safe-compiling ${this.getName()}`, err);
          // this.compilationProcess.removeAllListeners('error');
          return observer.error(err);
        });
    });
  }

  watch() {
    this.getGraph()
      .logger.log('node')
      .info('Watching sources', `${this.location}/src/**/*.{ts,js,json}`);
    const watcher = watch(`${this.location}/src/**/*.{ts,js,json}`);
    watcher.on('change', (path) => {
      this.getGraph()
        .logger.log('node')
        .info(`${chalk.bold(this.name)}: ${path} changed. Recompiling`);
      const isFinalLeaf = this.isService() && this.getDependent().length === 0;
      if (!isFinalLeaf) {
        this._scheduler.fileChanged(this);
      } else {
        this._scheduler.buildOne(this as unknown as Service, true, true).subscribe();
      }
    })
    this._watchers.push(watcher);
  }

  protected unwatch() {
    this._watchers.forEach(w => w.close());
  }
}
