import { concat, from, merge, Observable, of, Subject, throwError } from 'rxjs';
import { LernaGraph, LernaNode, Service } from '../lerna';
import { catchError, concatAll, debounceTime, filter, map, mergeMap, takeUntil, tap } from 'rxjs/operators';
import { ServiceStatus } from '../lerna/enums/service.status';
import { ILogger, Logger } from './logger';
import { getDefaultThreads } from './platform';

enum SchedulerStatus {
  READY,
  BUSY,
  ABORTED,
}

enum RecompilationStatus {
  READY,
  STOPPING,
  STOPPED,
  COMPILING,
  COMPILED,
  STARTING,
  STARTED,
  FINISHED,
}

export enum RecompilationEventType {
  STOPPING_SERVICE,
  SERVICE_STOPPED,
  TRANSPILING_NODE,
  NODE_TRANSPILED,
  TYPE_CHECKING,
  TYPE_CHECKED,
  STARTING_SERVICE,
  SERVICE_STARTED,
  PACKAGING,
  PACKAGED,
  DEPLOYING,
  DEPLOYED,
}

export enum RecompilationErrorType {
  TYPE_CHECK_ERROR,
  PACKAGE_ERROR,
}

export enum RecompilationMode {
  FAST,
  SAFE,
}

export interface IRecompilationEvent {
  type: RecompilationEventType;
  node: LernaNode;
  took?: number;
  megabytes?: number;
}

export interface IRecompilationError {
  type: RecompilationErrorType;
  node: LernaNode;
  logs: string[];
}

export class RecompilationScheduler {
  private _graph: LernaGraph;
  private _jobs: {
    stop: Service[];
    transpile: LernaNode[];
    typeCheck: { node: LernaNode, force: boolean }[];
    start: Service[];
    package: { service: Service, level: number }[];
    deploy: Service[];
  };
  private _status: SchedulerStatus;
  private _recompilation: RecompilationStatus;
  private _abort$: Subject<void> = new Subject<void>();
  private _filesChanged$: Subject<void> = new Subject<void>();
  private _changes: Set<LernaNode>;
  private _debounce: number;
  private _logger: ILogger;
  private _concurrency: number;

  constructor(logger: Logger) {
    this._logger = logger.log('scheduler');
    this._logger.debug('New recompilation scheduler instance');
    this._reset();
    this._debounce = 300;
    this._watchFileChanges();
    this._concurrency = getDefaultThreads();
  }

  public setGraph(graph: LernaGraph): void {
    this._graph = graph;
  }

  public setConcurrency(threads: number) {
    this._concurrency = threads;
  }

  public startOne(service: Service): Observable<IRecompilationEvent> {
    // Compile nodes that are not compiled yet
    this._compile(service.getDependencies());

    // Start service
    this._requestStart(service);
    return this._exec();
  }

  public startAll(): Observable<IRecompilationEvent> {
    // Enable nodes that not already enabled
    this._graph.enableAll();

    // Compile nodes that are not already compiled
    const toStart = this._graph.getServices().filter((s) => s.getStatus() !== ServiceStatus.RUNNING);
    const roots = toStart.filter((n) => n.isRoot());
    this._compile(roots);

    // Start services that are not already started
    toStart.forEach((s) => this._requestStart(s));
    return this._exec();
  }

  public stopOne(service: Service): Observable<IRecompilationEvent> {
    // Disable "orphan" nodes i.e. nodes that are descendant of the service to stop but used by no other
    // enabled nodes
    // FIXME: Use disable status only for config explicit exclusion (use unwatch instead to stop watching unused dependencies)
    this._graph.disableOne(service);
    // Stop the service
    this._requestStop(service);
    return this._exec();
  }

  public gracefulShutdown(): Observable<IRecompilationEvent> {
    this._graph
      .getServices()
      .filter((s) => [ServiceStatus.RUNNING, ServiceStatus.STARTING].includes(s.getStatus()))
      .forEach((s) => this._requestStop(s));
    return this._exec();
  }

  public stopAll(): Observable<IRecompilationEvent> {
    // Disable all nodes
    // FIXME: Use disable status only for config explicit exclusion (use unwatch instead to stop watching unused dependencies)
    this._graph.getNodes().forEach((n) => n.disable());

    // Stop all running services
    return this.gracefulShutdown();
  }

  public restartOne(service: Service, recompile = false): Observable<IRecompilationEvent> {
    this._requestStop(service);
    this._compile([service], RecompilationMode.FAST, recompile);
    this._requestStart(service);
    return this._exec();
  }

  public restartAll(recompile = true): Observable<IRecompilationEvent> {
    // Stop all running/starting services
    const toRestart = this._graph
      .getServices()
      .filter((s) => [ServiceStatus.RUNNING, ServiceStatus.STARTING].includes(s.getStatus()));
    toRestart.forEach((s) => this._requestStop(s));

    // Recompile their dependencies tree
    this._compile(
      toRestart.filter((s) => s.isRoot()),
      RecompilationMode.FAST,
      recompile,
    );

    // And restart them
    toRestart.forEach((s) => this._requestStart(s));
    return this._exec();
  }

  /**
   * Compile and start the whole project
   */
  public async startProject(graph: LernaGraph, compile = true): Promise<void> {
    this._logger.debug('Starting project');
    if (compile) {
      // Compile all enabled nodes from leaves to roots
      this._logger.debug('Building compilation queue...', graph.getNodes().filter((n) => n.isEnabled()).length);
      this._compile(graph.getNodes().filter((n) => n.isEnabled()));
    }
    this._logger.debug(
      'Compilation queue built',
      this._jobs.transpile.map((n) => n.getName()),
    );

    // Start all services
    this._logger.debug('Building start queue...');
    graph
      .getServices()
      .filter((s) => s.isEnabled())
      .forEach((service) => {
        this._requestStart(service);
      });
    this._logger.debug(
      'Start queue built',
      this._jobs.start.map((n) => n.getName()),
    );
    this._logger.debug('Executing tasks');
    return this._execPromise();
  }

  public stopProject(graph: LernaGraph): Promise<void> {
    this._reset();
    graph
      .getServices()
      .filter((s) => s.isEnabled())
      .forEach((s) => this._requestStop(s));
    return this._execPromise();
  }

  public fileChanged(node: LernaNode): void {
    this._changes.add(node);
    this._filesChanged$.next();
  }

  private _watchFileChanges(): void {
    this._filesChanged$
      .asObservable()
      .pipe(debounceTime(this._debounce))
      .subscribe(async () => {
        if (this._changes.size > 0) {
          this._logger.info('Triggering recompilation...');
          // abort previous recompilation if any
          this._abort$.next();
          // find all services that are impacted
          this._logger.info('Changed nodes', Array.from(this._changes).map(n => n.getName()));
          const impactedServices: Set<Service> = new Set<Service>();
          for (const node of this._changes) {
            const isRunningService = (n: LernaNode): boolean => {
              if (n.isService()) {
                const s = n as Service;
                return s.isRunning();
              }
            }
            if (isRunningService(node)) {
              impactedServices.add(node as Service);
            }
            const dependantServices = node.getDependent().filter((n) => isRunningService(n));
            dependantServices.forEach((s) => impactedServices.add(s as Service));
          }
          this._logger.info('Restarting impacted running services', Array.from(impactedServices).map(n => n.getName()));
          // stop them
          impactedServices.forEach((s) => this._requestStop(s));

          // request recompilation
          this._compile([...this._changes]);

          // start the stopped services
          impactedServices.forEach((s) => this._requestStart(s));

          // rerun recompilation
          this._exec().subscribe();
        }
      });
  }

  recompileSafe(node: LernaNode, force = false) {
    this._compile([node], RecompilationMode.FAST, force);
  }

  /**
   * Recompile any array of nodes from roots to leaves
   * @param target: The nodes to compile
   * @param mode: Whether or node type-check and transpiling jobs should be executed in separate threads
   * @param force: perform type-checking even if checksums are unchanged
   * @private
   */
  private _compile(target: LernaNode | LernaNode[], mode = RecompilationMode.FAST, force = false): void {
    const toCompile = Array.isArray(target) ? target : [target];
    this._logger.debug(
      'Requested to compile nodes',
      toCompile.map((n) => n.getName()),
    );
    this._logger.debug('Recompilation mode', mode === RecompilationMode.FAST ? 'fast' : 'safe');
    // Find roots
    const roots = toCompile.filter((n) => !n.getDependent().some((dep) => toCompile.includes(dep)));
    this._logger.debug(
      'Root nodes',
      roots.map((n) => n.getName()),
    );
    const recursivelyCompile = (nodes: LernaNode[], requested: Set<LernaNode>): void => {
      for (const node of nodes) {
        this._logger.debug('Request to compile', node.getName());
        // For each node get his descendants and compile them before him
        const dependencies = node.getChildren().filter((d) => {
          // compile node only if it is himself in requested targets
          const inRequest = toCompile.includes(d);
          // or he has at least one descendant (= node depending upon) in requested targets
          const hasDescendantInRequest = d.getDependent().some((descendant) => toCompile.includes(descendant));
          this._logger.debug('should compile ?', {
            name: d.getName(),
            enabled: d.isEnabled(),
            inRequest,
            hasDescendantInRequest,
          });
          return d.isEnabled() && (hasDescendantInRequest || inRequest);
        });
        this._logger.debug('Has dependencies', dependencies.length);
        if (dependencies.length > 0) {
          // If the current node has dependencies that should be compiled before him, compile them (recursion down)
          recursivelyCompile(dependencies, requested);
        }
        // Else compile it and return (recursion up)
        // Check if node has not been already recompiled earlier in recursion (using set)
        const alreadyCompiled = requested.has(node);
        if (alreadyCompiled) {
          this._logger.debug('Already in compilation queue', node.getName());
          return;
        }

        // Check if node is a service that is not used by another service as package
        // In that case, no need to transpile if fast-compilation if asked. Service will be transpiled by serverless-webpack
        const isRootService = roots.includes(node) && node.isService();
        if (mode === RecompilationMode.FAST && !isRootService) {
          this._logger.debug('Added to transpiling queue', node.getName());
          this._requestTranspile(node);
        }
        this._logger.debug('Added to type-checking queue', node.getName());
        this._requestTypeCheck(node, force);
        // Avoid node to be recompiled later in recursion using a set
        requested.add(node);
      }
    };
    recursivelyCompile(roots, new Set());
  }

  private _reset(): void {
    this._logger.debug('Resetting scheduler');
    this._abort$.next();
    this._jobs = {
      stop: [],
      transpile: [],
      typeCheck: [],
      start: [],
      package: [],
      deploy: [],
    };
    this._recompilation = RecompilationStatus.READY;
    this._status = SchedulerStatus.READY;
    this._changes = new Set<LernaNode>();
  }

  private _requestStop(service: Service): void {
    this._logger.debug(`Request to add stop job`, service.getName());
    const inQueue = this._alreadyQueued(service, 'stop');
    this._logger.debug('Already in stop queue', inQueue);
    if (!inQueue) {
      this._logger.debug('Adding service in stop job queue', service.getName());
      this._jobs.stop.push(service);
    }
  }

  private _requestTypeCheck(node: LernaNode, force : boolean): void {
    this._logger.debug(`Request to add typeCheck job`, node.getName());
    const inQueue = this._jobs.typeCheck.some((n) => n.node.getName() === node.getName());
    this._logger.debug('Already in typeCheck queue', inQueue);
    if (!inQueue) {
      this._logger.debug('Adding node in typeCheck queue', node.getName());
      this._jobs.typeCheck.push({ node, force });
    }
  }

  private _requestTranspile(node: LernaNode): void {
    this._logger.debug(`Request to add transpile job`, node.getName());
    const inQueue = this._alreadyQueued(node, 'transpile');
    this._logger.debug('Already in transpile queue', inQueue);
    if (!inQueue) {
      this._logger.debug('Adding node in transpile queue', node.getName());
      this._jobs.transpile.push(node);
    }
  }

  private _requestStart(service: Service): void {
    this._logger.debug(`Request to add start job`, service.getName());
    const inQueue = this._alreadyQueued(service, 'start');
    this._logger.debug('Already in start queue', inQueue);
    if (!inQueue) {
      this._logger.debug('Adding service in start job queue', service.getName());
      this._jobs.start.push(service);
    }
  }

  private _requestPackage(service: Service, level = 4): void {
    this._logger.debug(`Request to add package job`, service.getName());
    const inQueue = this._jobs.package.some((n) => n.service.getName() === service.getName());
    this._logger.debug('Already in package queue', inQueue);
    if (!inQueue) {
      this._logger.debug('Adding service in package job queue', service.getName());
      this._jobs.package.push({ service, level });
    }
  }

  private _requestDeploy(service: Service): void {
    this._logger.debug(`Request to add deploy job`, service.getName());
    const inQueue = this._alreadyQueued(service, 'deploy');
    this._logger.debug('Already in deploy queue', inQueue);
    if (!inQueue) {
      this._logger.debug('Adding service in deploy job queue', service.getName());
      this._jobs.deploy.push(service);
    }
  }

  private _alreadyQueued(node: LernaNode, queue: 'transpile' | 'start' | 'stop' | 'deploy'): boolean {
    return this._jobs[queue].some((n) => n.getName() === node.getName());
  }

  private _execPromise(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const recompilationProcess$ = this._exec();
      this._logger.debug('Recompilation process', recompilationProcess$);
      recompilationProcess$.subscribe(
        (event) => this._logger.debug(event),
        (err) => reject(err),
        () => resolve(),
      );
    });
  }

  private _exec(): Observable<IRecompilationEvent> {
    if (this._status === SchedulerStatus.BUSY) {
      this._logger.warn('Scheduler is already busy');
      this._abort$.next();
      return;
    }
    if (this._status === SchedulerStatus.ABORTED) {
      this._logger.info('Previous recompilation has been preempted');
    }
    this._status = SchedulerStatus.BUSY;
    this._logger.debug('Executing recompilation task');
    this._logger.debug(
      'To stop',
      this._jobs.stop.map((n) => n.getName()),
    );
    this._logger.debug(
      'To transpile',
      this._jobs.transpile.map((n) => n.getName()),
    );
    this._logger.debug(
      'To type-check',
      this._jobs.typeCheck.map((n) => n.node.getName()),
    );
    this._logger.debug(
      'To start',
      this._jobs.start.map((n) => n.getName()),
    );

    const stopJobs$: Array<Observable<IRecompilationEvent>> = this._jobs.stop.map((s) =>
      s.stop().pipe(
        map((service) => {
          this._logger.debug('Stopped', service.getName());
          return { node: service, type: RecompilationEventType.SERVICE_STOPPED };
        }),
        catchError((err) => {
          this._logger.error(err);
          return throwError(err);
        }),
      ),
    );

    const transpilingJobs$: Array<Observable<IRecompilationEvent>> = this._jobs.transpile.map((node) =>
      node.transpile().pipe(
        map((node) => {
          this._logger.debug('Compiled', node.getName());
          return { node: node, type: RecompilationEventType.NODE_TRANSPILED };
        }),
        catchError((err) => {
          this._logger.error(err);
          return throwError(err);
        }),
      ),
    );

    const startJobs$: Array<Observable<IRecompilationEvent>> = this._jobs.start.map((s) =>
      s.start().pipe(
        map((service) => {
          this._logger.debug('Started', service.getName());
          return { node: service, type: RecompilationEventType.SERVICE_STARTED };
        }),
        catchError((err) => {
          this._logger.error(err);
          return throwError(err);
        }),
      ),
    );

    const typeCheckJobs$: Array<Observable<IRecompilationEvent>> = this._jobs.typeCheck.map((job) => {
      return new Observable<IRecompilationEvent>((obs) => {
        obs.next({ node: job.node, type: RecompilationEventType.TYPE_CHECKING });
        const now = Date.now();
        job.node.performTypeChecking(job.force).subscribe(
          (node) => {
            this._logger.debug('Type checked', job.node.getName());
            obs.next({ node: node, type: RecompilationEventType.TYPE_CHECKED, took: Date.now() - now });
            obs.complete();
          },
          (err) => {
            this._logger.error(err);
            const evt: IRecompilationError = {
              type: RecompilationErrorType.TYPE_CHECK_ERROR,
              node: job.node,
              logs: job.node.tscLogs,
            }
            obs.error(evt);
          },
        );
      });
    });

    const packageJobs$: Array<Observable<IRecompilationEvent>> = this._jobs.package.map((job) => {
      return new Observable<IRecompilationEvent>((obs) => {
        obs.next({ node: job.service, type: RecompilationEventType.PACKAGING});
        const now = Date.now();
        job.service.package(job.level).subscribe(
          (output) => {
            this._logger.debug('Service packaged', job.service.getName());
            obs.next({ node: output.service, type: RecompilationEventType.PACKAGED, took: Date.now() - now, megabytes: output.megabytes });
            obs.complete();
          },
          (err) => {
            this._logger.error(err);
            const evt: IRecompilationError = {
              type: RecompilationErrorType.PACKAGE_ERROR,
              node: job.service,
              logs: [err],
            }
            obs.error(evt);
          },
        )
      });
    });

    const deployJobs$: Array<Observable<IRecompilationEvent>> = this._jobs.deploy.map((service) => {
      return new Observable<IRecompilationEvent>((obs) => {
        obs.next({ node: service, type: RecompilationEventType.DEPLOYING});
        const now = Date.now();
        service.deploy().subscribe(
          (service) => {
            this._logger.debug('Service deployed', service.getName());
            obs.next({ node: service, type: RecompilationEventType.DEPLOYED, took: Date.now() - now });
            obs.complete();
          },
          (err) => {
            this._logger.error(err);
            obs.error({node: service, err: err});
          },
        )
      });
    });

    this._recompilation = RecompilationStatus.STOPPING;

    let stopped = 0;
    let started = 0;
    let transpiled = 0;
    let typeChecked = 0;
    let packaged = 0;
    let deployed = 0;

    const afterStopped = (): void => {
      const allDone = (): void => {
        this._logger.info('All services stopped');
        this._recompilation = RecompilationStatus.COMPILING;
      }
      if (stopJobs$.length === 0) {
        return allDone();
      }
      stopped++;
      this._logger.debug(`Stopped ${stopped}/${stopJobs$.length} services`);
      if (stopped >= stopJobs$.length) {
        allDone();
      }
    };

    const stop$: Observable<IRecompilationEvent> =
      stopJobs$.length > 0
        ? from(stopJobs$).pipe(
            mergeMap((stopJob$) => stopJob$),
            tap(afterStopped.bind(this)),
          )
        : of(null).pipe(tap(afterStopped.bind(this)));

    const afterTranspiled = (): void => {
      const allDone = (): void => {
        this._logger.info('All dependencies transpiled');
        this._recompilation = RecompilationStatus.STARTING;
      }
      if (transpilingJobs$.length === 0) {
        return allDone();
      }
      transpiled++;
      this._logger.debug(`Transpiled ${transpiled}/${transpilingJobs$.length} services`);
      if (transpiled >= transpilingJobs$.length) {
        allDone();
      }
    };

    const transpile$: Observable<IRecompilationEvent> =
      transpilingJobs$.length > 0
        ? concat(transpilingJobs$).pipe(concatAll(), tap(afterTranspiled.bind(this)))
        : of(null).pipe(tap(afterTranspiled.bind(this)));


    const afterTypechecking = (evt: IRecompilationEvent): void => {
      const allDone = (): void => this._logger.info('Type-checking performed');
      if (typeCheckJobs$.length === 0) {
        return allDone();
      }
      if (evt.type === RecompilationEventType.TYPE_CHECKED) {
        typeChecked++;
        this._logger.debug(`Type-checked ${typeChecked}/${typeCheckJobs$.length} services`);
        if (typeChecked >= typeCheckJobs$.length) {
          allDone();
        }
      }
    };

    const typeCheck$: Observable<IRecompilationEvent> =
      typeCheckJobs$.length > 0
        ? concat(typeCheckJobs$).pipe(concatAll(), tap(afterTypechecking.bind(this)))
        : of(null).pipe(tap(afterTypechecking.bind(this)));

    const afterStarted = (): void => {
      const allDone = (): void => {
        this._logger.info('All services started');
        this._recompilation = RecompilationStatus.STARTING;
      }
      if (startJobs$.length === 0) {
        return allDone();
      }
      started++;
      this._logger.debug(`Started ${started}/${startJobs$.length} services`);
      if (started >= startJobs$.length) {
        allDone();
      }
    };

    const start$: Observable<IRecompilationEvent> =
      startJobs$.length > 0
        ? from(startJobs$).pipe(
            mergeMap((startJob$) => startJob$),
            tap(afterStarted.bind(this)),
          )
        : of(null).pipe(tap(afterStarted.bind(this)));

    const afterPackaged = (): void => {
      const allDone = (): void => {
        this._logger.info('All services packaged');
      }
      if (packageJobs$.length === 0) {
        return allDone();
      }
      packaged++;
      this._logger.debug(`Packaged ${packaged}/${packageJobs$.length} services`);
      if (packaged >= packageJobs$.length) {
        allDone();
      }
    };

    const package$: Observable<IRecompilationEvent> =
      packageJobs$.length > 0
        ? from(packageJobs$).pipe(
        mergeMap((packageJob$) => packageJob$, this._concurrency),
        tap(afterPackaged.bind(this)),
        )
        : of(null).pipe(tap(afterPackaged.bind(this)));

    const afterDeployed = (): void => {
      const allDone = (): void => {
        this._logger.info('All services deployed');
      }
      if (deployJobs$.length === 0) {
        return allDone();
      }
      deployed++;
      this._logger.debug(`Deployed ${deployed}/${deployJobs$.length} services`);
      if (deployed >= deployJobs$.length) {
        allDone();
      }
    };

    const deploy$: Observable<IRecompilationEvent> =
      deployJobs$.length > 0
        ? from(deployJobs$).pipe(
        mergeMap((deployJob$) => deployJob$, this._concurrency),
        tap(afterDeployed.bind(this)),
        )
        : of(null).pipe(tap(afterDeployed.bind(this)));

    const recompilationProcess$: Observable<IRecompilationEvent> = concat([stop$, merge(concat(typeCheck$, package$, deploy$), concat(transpile$, start$))]).pipe(
      concatAll(),
      takeUntil(this._abort$),
      catchError((err) => {
        this._logger.error(err);
        this._reset();
        return throwError(err);
      }),
      tap(null, null, () => {
        this._logger.info('All tasks finished');
        this._reset();
      }),
    );

    this._logger.debug('All tasks successfully scheduled');
    return recompilationProcess$.pipe(filter(evt => !!evt));
  }

  buildOne(service: Service, onlySelf: boolean): Observable<IRecompilationEvent> {
    if (onlySelf) {
      this._requestTypeCheck(service, true);
    } else {
      this._compile([service], RecompilationMode.SAFE, true);
    }
    return this._exec();
  }

  buildAll(graph: LernaGraph, onlySelf: boolean): Observable<IRecompilationEvent> {
    if (onlySelf) {
      graph.getServices().forEach(s => this._requestTypeCheck(s, true));
    } else {
      this._compile(graph.getServices(), RecompilationMode.SAFE, true);
    }
    return this._exec();
  }

  packageOne(service: Service, recompile: boolean, level = 4) {
    if (recompile) {
      this._compile([service], RecompilationMode.SAFE, true);
    }
    this._requestPackage(service, level);
    return this._exec();
  }

  packageAll(graph: LernaGraph, recompile: boolean, level = 4) {
    if (recompile) {
      this._compile(graph.getServices(), RecompilationMode.SAFE, true);
    }
    graph.getServices().forEach(s => this._requestPackage(s, level));
    return this._exec();
  }
}

/*
TODO:
- Unit tests
 */
