import { DependenciesGraph, isService } from './dependencies-graph';
import { existsSync } from 'fs';
import { join } from 'path';
import { Package, Service } from './';
import chalk from 'chalk';
import { ChildProcess, spawn } from 'child_process';
import { BehaviorSubject, Observable } from 'rxjs';
import { RecompilationScheduler } from '../scheduler';
import { IPCSocketsManager } from '../ipc/socket';
import { getBinary } from '../external-binaries';
import { compileFiles } from '../typescript';
import { checksums, IChecksums } from '../checksums';
import { FSWatcher, watch } from 'chokidar';
import { Project, Workspace } from '@yarnpkg/core';
import { getName } from '../yarn/project';
import { TranspilingStatus, TypeCheckStatus } from '@microlambda/types';
import { ILogger } from '../logger';

enum NodeStatus {
  DISABLED,
  ENABLED,
}

interface INodeMetrics {
  lastTypeCheck: Date | null;
  typeCheckTook: number | null;
  typeCheckFromCache: boolean;
  lastTranspiled: Date | null;
  transpileTook: number | null;
}

interface IServiceMetrics extends INodeMetrics {
  lastStarted: Date | null;
  startedTook: number | null;
}

export abstract class Node {
  protected readonly name: string;
  protected readonly location: string;
  protected readonly graph: DependenciesGraph;
  protected readonly dependencies: Node[];

  private readonly version: string | null;
  private readonly private: boolean;

  protected transpilingStatus: TranspilingStatus;
  protected transpilingPromise: Promise<void> | undefined;

  protected typeCheckStatus: TypeCheckStatus;
  protected typeCheckProcess: ChildProcess | undefined;
  private _typeCheckLogs: string[] = [];

  private _checksums: IChecksums = {};

  protected _metrics: IServiceMetrics = {
    lastTypeCheck: null,
    typeCheckTook: null,
    typeCheckFromCache: false,
    lastTranspiled: null,
    transpileTook: null,
    lastStarted: null,
    startedTook: null,
  };
  private _typeCheckStartedAt: number | undefined;
  private _transpiledStartedAt: number | undefined;

  get metrics(): IServiceMetrics {
    return this._metrics;
  }

  private nodeStatus: NodeStatus;
  protected _ipc: IPCSocketsManager | undefined;

  protected _scheduler: RecompilationScheduler | undefined;
  private _watchers: FSWatcher[] = [];

  private _tscLogs$: BehaviorSubject<string> = new BehaviorSubject('');
  private _typeCheck$: BehaviorSubject<TypeCheckStatus> = new BehaviorSubject<TypeCheckStatus>(
    TypeCheckStatus.NOT_CHECKED,
  );
  private _transpiled$: BehaviorSubject<TranspilingStatus> = new BehaviorSubject<TranspilingStatus>(
    TranspilingStatus.NOT_TRANSPILED,
  );
  protected _logger: ILogger | undefined;

  public typeCheck$ = this._typeCheck$.asObservable();
  public transpiled$ = this._transpiled$.asObservable();
  public tscLogs$ = this._tscLogs$.asObservable();

  public constructor(
    graph: DependenciesGraph,
    node: Workspace,
    nodes: Set<Node>,
    project: Project,
    scheduler?: RecompilationScheduler,
  ) {
    this.graph = graph;
    this.name = getName(node);
    this._logger = this.graph.logger?.log(this.name);
    this._logger?.debug('Building node', getName(node));
    this.version = node.manifest.version;
    this.private = node.manifest.private;
    this.location = node.cwd;
    this.nodeStatus = NodeStatus.DISABLED;
    this.transpilingStatus = TranspilingStatus.NOT_TRANSPILED;
    this.typeCheckStatus = TypeCheckStatus.NOT_CHECKED;
    this._scheduler = scheduler;
    const workspaces = project.workspaces;
    const dependentWorkspaces: Node[] = [];
    const dependencies = Array.from(node.manifest.dependencies.values());
    const devDependencies = Array.from(node.manifest.devDependencies.values());
    for (const descriptor of dependencies.concat(devDependencies)) {
      const name = getName(descriptor);
      const alreadyBuilt = Array.from(nodes).find((n) => n.name === name);
      if (alreadyBuilt) {
        this._logger?.debug('Dependency is already built', alreadyBuilt);
        dependentWorkspaces.push(alreadyBuilt);
        continue;
      }
      this._logger?.debug('Building dependency', descriptor);
      const workspace = workspaces.find((w) => getName(w) === name);
      if (!workspace) {
        this._logger?.debug('is external dependency', name);
        continue;
      }
      this._logger?.debug('Is service', { name, result: isService(workspace.cwd) });
      dependentWorkspaces.push(
        isService(workspace.cwd)
          ? new Service(graph, workspace, nodes, project, scheduler)
          : new Package(graph, workspace, nodes, project, scheduler),
      );
    }
    this.dependencies = dependentWorkspaces;
    this._logger?.debug('Node built', this.name);
    nodes.add(this);
  }

  get tscLogs(): string[] {
    return this._typeCheckLogs;
  }

  public registerIPCServer(sockets: IPCSocketsManager): void {
    this._ipc = sockets;
  }

  public enable(): void {
    this.nodeStatus = NodeStatus.ENABLED;
  }

  public isEnabled(): boolean {
    return this.nodeStatus === NodeStatus.ENABLED;
  }

  public isService(): boolean {
    this._logger?.debug('Is service', {
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

  public getChildren(): Node[] {
    return this.dependencies;
  }

  public getGraph(): DependenciesGraph {
    return this.graph;
  }

  public getVersion(): string | null {
    return this.version;
  }

  public getChild(name: string): Node | undefined {
    return this.dependencies.find((d) => d.name === name);
  }

  public setTranspilingStatus(status: TranspilingStatus): void {
    this.transpilingStatus = status;
    if (this._ipc) {
      this._logger?.debug('Notifying IPC server of graph update');
      this._ipc.graphUpdated();
    }
    this._transpiled$.next(this.transpilingStatus);
  }

  public setTypeCheckingStatus(status: TypeCheckStatus): void {
    this.typeCheckStatus = status;
    this._typeCheck$.next(this.typeCheckStatus);
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

  public getDependencies(): Node[] {
    const deps: Node[] = [];
    this._getDependencies(deps);
    return deps;
  }

  private _getDependencies(deps: Node[]): void {
    for (const dep of this.dependencies) {
      deps.push(dep);
      dep._getDependencies(deps);
    }
  }

  /**
   * Get all dependents nodes.
   */
  public getDependent(): Node[] {
    const dependent = this.graph.getNodes().filter((n) =>
      n
        .getDependencies()
        .map((n) => n.name)
        .includes(this.name),
    );
    this._logger?.silly(
      `Nodes depending upon ${this.name}`,
      dependent.map((d) => d.name),
    );
    return dependent;
  }

  /**
   * Get the direct parents in dependency tree.
   */
  public getParents(): Node[] {
    return this.graph.getNodes().filter((n) => n.dependencies.some((d) => d.name === this.name));
  }

  public transpile(): Observable<Node> {
    return new Observable<Node>((observer) => {
      switch (this.transpilingStatus) {
        case TranspilingStatus.TRANSPILED:
        case TranspilingStatus.ERROR_TRANSPILING:
        case TranspilingStatus.NOT_TRANSPILED:
          this.transpilingPromise = this._startTranspiling();
          break;
        case TranspilingStatus.TRANSPILING:
          this._logger?.info('Package already transpiling', this.name);
          break;
      }
      if (this.transpilingPromise) {
        this.transpilingPromise
          .then(() => {
            this._logger?.info('Package transpiled', this.name);
            observer.next(this);
            this.setTranspilingStatus(TranspilingStatus.TRANSPILED);
            this._metrics.lastTranspiled = new Date();
            this._metrics.transpileTook = this._transpiledStartedAt ? Date.now() - this._transpiledStartedAt : null;
            this._transpiledStartedAt = undefined;
            return observer.complete();
          })
          .catch((err) => {
            this._logger?.info(`Error transpiling ${this.getName()}`, err);
            this.setTranspilingStatus(TranspilingStatus.ERROR_TRANSPILING);
            this._transpiledStartedAt = undefined;
            return observer.error(err);
          });
      }
    });
  }

  public performTypeChecking(force = false): Observable<Node> {
    return new Observable<Node>((observer) => {
      switch (this.typeCheckStatus) {
        case TypeCheckStatus.SUCCESS:
        case TypeCheckStatus.ERROR:
        case TypeCheckStatus.NOT_CHECKED:
          this._startTypeChecking(force).then((action) => {
            const updateMetrics = (fromCache: boolean): void => {
              this._metrics.typeCheckFromCache = fromCache;
              this._metrics.typeCheckTook = this._typeCheckStartedAt ? Date.now() - this._typeCheckStartedAt : null;
              this._typeCheckStartedAt = undefined;
            };
            if (action.recompile) {
              this._watchTypeChecking().subscribe(
                (next) => observer.next(next),
                (err) => observer.error(err),
                () => {
                  updateMetrics(false);
                  // Update checksums
                  if (action.checksums != null) {
                    checksums(this, this.graph.logger)
                      .write(action.checksums)
                      .then(() => {
                        this._logger?.info('Checksum written', this.name);
                        this._checksums = action.checksums || {};
                        observer.complete();
                      })
                      .catch((e) => {
                        this._logger?.debug(e);
                        this._logger?.warn(
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
              updateMetrics(true);
              this._logger?.info(`Skipped type-checking of ${this.name}: sources did not change`);
              this.setTypeCheckingStatus(TypeCheckStatus.SUCCESS);
              this._handleTscLogs('Safe-compilation skipped, sources did not change since last type check. Checksums:');
              this._handleTscLogs(JSON.stringify(this._checksums, null, 2));
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
    this._transpiledStartedAt = Date.now();
    this.setTranspilingStatus(TranspilingStatus.TRANSPILING);
    // Using directly typescript API
    this._logger?.info('Fast-compiling using transpile-only', this.name);
    this.watch();
    return compileFiles(this.location, this.graph.logger);
  }

  private async _startTypeChecking(force = false): Promise<{ recompile: boolean; checksums: IChecksums | null }> {
    this.setTypeCheckingStatus(TypeCheckStatus.CHECKING);
    this._typeCheckStartedAt = Date.now();
    this._metrics.lastTypeCheck = new Date();
    let recompile = true;
    let currentChecksums: IChecksums | null = {};
    const checksumUtils = checksums(this, this.graph.logger);
    if (!force) {
      // FIXME: IMPORTANT
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
        this._logger?.warn('Error evaluating checksums for node', this.name);
        this._logger?.debug(e);
      }
      this._logger?.info('Safe-compiling performing type-checks', this.name);
    } else {
      try {
        currentChecksums = await checksumUtils.calculate();
      } catch (e) {
        this._logger?.warn('Error evaluating checksums for node', this.name);
      }
    }
    if (recompile) {
      this.typeCheckProcess = spawn(getBinary('tsc', this.graph.getProjectRoot(), this.graph.logger, this), {
        cwd: this.location,
        env: { ...process.env, FORCE_COLOR: '2' },
      });
      if (this.typeCheckProcess.stderr && this.typeCheckProcess.stdout) {
        this.typeCheckProcess.stderr.on('data', (data) => {
          this._logger?.error(`${chalk.bold(this.name)}: ${data}`);
          this._handleTscLogs(data);
        });
        this.typeCheckProcess.stdout.on('data', (data) => {
          this._logger?.info(`${chalk.bold(this.name)}: ${data}`);
          this._handleTscLogs(data);
        });
      }
    }
    return { recompile, checksums: currentChecksums };
  }

  private _handleTscLogs(data: Buffer | string): void {
    this._typeCheckLogs.push(data.toString());
    this._tscLogs$.next(data.toString());
  }

  private _watchTypeChecking(): Observable<Node> {
    return new Observable<Node>((observer) => {
      if (!this.typeCheckProcess) {
        observer.error('No typechecking process running on node ' + this.getName());
        return;
      }
      this.typeCheckProcess.on('close', (code) => {
        this._logger?.silly('npx tsc process closed');
        if (code === 0) {
          this._handleTscLogs('Process exited with status 0');
          this.setTypeCheckingStatus(TypeCheckStatus.SUCCESS);
          this._logger?.info(`Package safe-compiled ${this.getName()}`);
          observer.next(this);
          // this.compilationProcess.removeAllListeners('close');
          return observer.complete();
        } else {
          this.setTypeCheckingStatus(TypeCheckStatus.ERROR);
          this._logger?.info(`Error safe-compiling ${this.getName()}`);
          // this.compilationProcess.removeAllListeners('close');
          return observer.error();
        }
      });
      this.typeCheckProcess.on('error', (err) => {
        this._logger?.silly('npx tsc process error');
        this._logger?.error(err);
        this.setTypeCheckingStatus(TypeCheckStatus.ERROR);
        this._logger?.info(`Error safe-compiling ${this.getName()}`, err);
        // this.compilationProcess.removeAllListeners('error');
        return observer.error(err);
      });
    });
  }

  watch(): void {
    this._logger?.info('Watching sources', `${this.location}/src/**/*.{ts,js,json}`);
    const watcher = watch(`${this.location}/src/**/*.{ts,js,json}`);
    watcher.on('change', (path) => {
      if (this._scheduler) {
        this._logger?.info(`${chalk.bold(this.name)}: ${path} changed. Recompiling`);
        this._scheduler.fileChanged(this);
      }
    });
    this._watchers.push(watcher);
  }

  protected unwatch(): void {
    this._watchers.forEach((w) => w.close());
  }
}
