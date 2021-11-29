import { BehaviorSubject, concat, from, merge, Observable, Subject } from 'rxjs';
import { concatAll, debounceTime, filter, mergeAll, mergeMap, takeUntil } from 'rxjs/operators';
import { ILogger, Logger } from './logger';
import { getDefaultThreads, getThreads } from './platform';
import { DependenciesGraph, IDeployEvent, IPackageEvent, Node, Service } from './graph';
import { ServiceStatus, SchedulerStatus } from '@microlambda/types';

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
  STOP_IN_PROGRESS,
  STOP_SUCCESS,
  STOP_FAILURE,
  TRANSPILE_IN_PROGRESS,
  TRANSPILE_SUCCESS,
  TRANSPILE_FAILURE,
  TYPE_CHECK_IN_PROGRESS,
  TYPE_CHECK_SUCCESS,
  TYPE_CHECK_FAILURE,
  START_IN_PROGRESS,
  START_SUCCESS,
  START_FAILURE,
  DEPLOY_IN_PROGRESS,
  DEPLOY_SUCCESS,
  DEPLOY_FAILURE,
}

export enum RecompilationErrorType {
  TYPE_CHECK_ERROR,
}

export enum RecompilationMode {
  FAST,
  SAFE,
}

export interface IRecompilationEvent {
  type: RecompilationEventType;
  node: Node;
  took?: number;
  megabytes?: { code: number; layer?: number };
}

export interface IRecompilationError {
  type: RecompilationErrorType;
  node: Node;
  logs: string[];
}

export class RecompilationScheduler {
  private _graph: DependenciesGraph | null = null;
  private _jobs: {
    stop: Service[];
    transpile: Node[];
    typeCheck: { node: Node; force: boolean; throws: boolean }[];
    start: Service[];
  } = {
    stop: [],
    transpile: [],
    typeCheck: [],
    start: [],
  };

  /**
   *
   * Run local
   *
   *                                 [tslib]                 [npm run start]
   *                       ------- transpile (T) ------- start (//)
   *  ------ stop (//) ----
   *                      -------- typechecking (T)
   *
   *
   * Deploy
   *
   * ----- typechecking (T) ---------- package (T) -------- deploy (//)
   *
   */
  private _status: SchedulerStatus = SchedulerStatus.READY;
  private _recompilation: RecompilationStatus = RecompilationStatus.READY;
  private _abort$: Subject<void> = new Subject<void>();
  private _filesChanged$: Subject<void> = new Subject<void>();
  private _changes: Set<Node> = new Set();
  private _debounce: number;
  private _logger: ILogger;
  private _concurrency: number;
  private _status$: BehaviorSubject<SchedulerStatus> = new BehaviorSubject<SchedulerStatus>(SchedulerStatus.READY);
  public status$ = this._status$.asObservable();
  get status(): SchedulerStatus {
    return this._status;
  }

  constructor(logger: Logger) {
    this._logger = logger.log('scheduler');
    this._logger.debug('New recompilation scheduler instance');
    this._reset();
    this._debounce = 300;
    this._watchFileChanges();
    this._concurrency = getDefaultThreads();
  }

  public setGraph(graph: DependenciesGraph): void {
    this._graph = graph;
  }

  public setConcurrency(threads?: number): void {
    if (threads) {
      this._concurrency = getThreads(threads);
    }
  }

  public startOne(service: Service): Observable<IRecompilationEvent> {
    // Compile nodes that are not compiled yet
    this._compile(service.getDependencies());

    // Start service
    this._requestStart(service);
    return this._exec();
  }

  public startAll(): Observable<IRecompilationEvent> {
    if (this._graph) {
      // Compile nodes that are not already compiled
      const toStart = this._graph.getServices().filter((s) => s.status !== ServiceStatus.RUNNING);
      const roots = toStart.filter((n) => n.isRoot());
      this._compile(roots);

      // Start services that are not already started
      toStart.filter((s) => s.isEnabled()).forEach((s) => this._requestStart(s));
    }
    return this._exec();
  }

  public stopOne(service: Service): Observable<IRecompilationEvent> {
    // Stop the service
    this._requestStop(service);
    return this._exec();
  }

  public gracefulShutdown(): Observable<IRecompilationEvent> {
    if (this._graph) {
      this._graph
        .getServices()
        .filter((s) => [ServiceStatus.RUNNING, ServiceStatus.STARTING].includes(s.status))
        .forEach((s) => this._requestStop(s));
    }
    return this._exec();
  }

  public stopAll(): Observable<IRecompilationEvent> {
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
    if (this._graph) {
      // Stop all running/starting services
      const toRestart = this._graph
        .getServices()
        .filter((s) => [ServiceStatus.RUNNING, ServiceStatus.STARTING].includes(s.status));
      toRestart.forEach((s) => this._requestStop(s));

      // Recompile their dependencies tree
      this._compile(
        toRestart.filter((s) => s.isRoot()),
        RecompilationMode.FAST,
        recompile,
      );

      // And restart them
      toRestart.filter((s) => s.isEnabled()).forEach((s) => this._requestStart(s));
    }
    return this._exec();
  }

  /**
   * Compile and start the whole project
   */
  public async startProject(graph: DependenciesGraph, compile = true): Promise<void> {
    this._logger.debug('Starting project');
    if (compile) {
      // Compile all enabled nodes from leaves to roots
      this._logger.debug('Building compilation queue...', graph.getNodes().filter((n) => n.isEnabled()).length);
      this._compile(
        graph.getNodes().filter((n) => n.isEnabled()),
        RecompilationMode.FAST,
        false,
        false,
      );
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
    await this._execPromise();
    /*const watch = (): void => {
      this._logger.info('Watching for file changes');
      graph.getNodes().forEach((n) => n.watch());
    };
    try {
      await this._execPromise();
      watch();
    } catch (e) {
      watch();
    }*/
  }

  public stopProject(graph: DependenciesGraph): Promise<void> {
    this._reset();
    graph
      .getServices()
      .filter((s) => s.isEnabled())
      .forEach((s) => this._requestStop(s));
    return this._execPromise();
  }

  public fileChanged(node: Node): void {
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
          // TODO: Proper preemption
          // TODO: If is service leaf, only request type-check
          // TODO: If not, find impacted services, stop them, recompile from root to leaves (type check) and impacted files and restart
          const changes = Array.from(this._changes);
          this._reset();
          // find all services that are impacted
          this._logger.info(
            'Changed nodes',
            changes.map((n) => n.getName()),
          );

          // request recompilation
          this._compile([...changes]);

          // rerun recompilation
          this._exec().subscribe();
        }
      });
  }

  recompileSafe(node: Node, force = false): void {
    this._compile([node], RecompilationMode.FAST, force);
  }

  /**
   * Recompile any array of nodes from roots to leaves
   * @param target: The nodes to compile
   * @param mode: Whether or node type-check and transpiling jobs should be executed in separate threads
   * @param force: perform type-checking even if checksums are unchanged
   * @param throws: whether type check should throws and stop jobs execution
   * @private
   */
  private _compile(target: Node | Node[], mode = RecompilationMode.FAST, force = false, throws = true): void {
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
    const recursivelyCompile = (nodes: Node[], requested: Set<Node>, depth = 0): void => {
      this._logger.debug(
        '-'.repeat(depth),
        'Recursively compile',
        nodes.map((n) => n.getName()),
      );
      for (const node of nodes) {
        this._logger.debug('-'.repeat(depth), 'Request to compile', node.getName());
        // For each node get his descendants and compile them before him
        const dependencies = node.getChildren().filter((d) => {
          // compile node only if it is himself in requested targets
          const inRequest = toCompile.includes(d);
          // or he has at least one descendant (= node depending upon) in requested targets
          const hasDescendantInRequest = d.getDependent().some((descendant) => toCompile.includes(descendant));
          this._logger.debug('should compile ?', {
            name: d.getName(),
            inRequest,
            hasDescendantInRequest,
          });
          return hasDescendantInRequest || inRequest;
        });
        this._logger.debug(
          '-'.repeat(depth),
          'Has dependencies',
          dependencies.map((d) => d.getName()),
        );
        if (dependencies.length > 0) {
          // If the current node has dependencies that should be compiled before him, compile them (recursion down)
          recursivelyCompile(dependencies, requested, depth + 1);
        }
        // Else compile it and return (recursion up)
        // Check if node has not been already recompiled earlier in recursion (using set)
        const alreadyCompiled = requested.has(node);
        if (alreadyCompiled) {
          this._logger.debug('-'.repeat(depth), 'Already in compilation queue', node.getName());
        } else {
          // Check if node is a service that is not used by another service as package
          // In that case, no need to transpile if fast-compilation if asked. Service will be transpiled by serverless-webpack
          const isRootService = roots.includes(node) && node.isService();
          if (mode === RecompilationMode.FAST && !isRootService) {
            this._logger.debug('-'.repeat(depth), 'Added to transpiling queue', node.getName());
            this._requestTranspile(node);
          }
          this._logger.debug('-'.repeat(depth), 'Added to type-checking queue', node.getName());
          this._requestTypeCheck(node, force, throws);
          // Avoid node to be recompiled later in recursion using a set
          requested.add(node);
        }
      }
    };
    recursivelyCompile(roots, new Set());
  }

  private _reset(): void {
    this._logger.info('Resetting scheduler');
    this._abort$.next();
    this._jobs = {
      stop: [],
      transpile: [],
      typeCheck: [],
      start: [],
    };
    this._recompilation = RecompilationStatus.READY;
    this._status = SchedulerStatus.READY;
    this._status$.next(SchedulerStatus.READY);
    this._changes = new Set<Node>();
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

  private _requestTypeCheck(node: Node, force: boolean, throws: boolean): void {
    this._logger.debug(`Request to add typeCheck job`, node.getName());
    const inQueue = this._jobs.typeCheck.some((n) => n.node.getName() === node.getName());
    this._logger.debug('Already in typeCheck queue', inQueue);
    if (!inQueue) {
      this._logger.debug('Adding node in typeCheck queue', node.getName());
      this._jobs.typeCheck.push({ node, force, throws });
    }
  }

  private _requestTranspile(node: Node): void {
    this._logger.debug(`Request to add transpile job`, node.getName());
    const inQueue = this._alreadyQueued(node, 'transpile');
    this._logger.debug('Already in transpile queue', inQueue);
    if (!inQueue) {
      this._logger.debug('Adding node in transpile queue', node.getName());
      this._jobs.transpile.push(node);
    }
  }

  private _requestStart(service: Service): void {
    if (!service.isEnabled()) {
      this._logger.warn('Trying to start a service disabled by config', service.getName());
    }
    this._requestTypeCheck(service, false, false);
    this._logger.debug(`Request to add start job`, service.getName());
    const inQueue = this._alreadyQueued(service, 'start');
    this._logger.debug('Already in start queue', inQueue);
    if (!inQueue) {
      this._logger.debug('Adding service in start job queue', service.getName());
      this._jobs.start.push(service);
    }
  }

  private _alreadyQueued(node: Node, queue: 'transpile' | 'start' | 'stop'): boolean {
    return this._jobs[queue].some((n) => n.getName() === node.getName());
  }

  private _execPromise(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const recompilationProcess$ = this._exec();
      this._logger.debug('Recompilation process', recompilationProcess$);
      recompilationProcess$.subscribe(
        (event) => this._logger.debug(event),
        (err) => {
          this._logger.error('exec promise error', err);
          return reject(err);
        },
        () => {
          this._logger.info('resolving exec promise');
          return resolve();
        },
      );
    });
  }

  private _exec(): Observable<IRecompilationEvent> {
    if (this._status === SchedulerStatus.BUSY) {
      this._logger.warn('Scheduler is already busy');
      this._reset();
    }
    if (this._status === SchedulerStatus.ABORTED) {
      this._logger.info('Previous recompilation has been preempted');
    }
    this._status = SchedulerStatus.BUSY;
    this._status$.next(SchedulerStatus.BUSY);
    this._logger.info('Executing recompilation task');
    this._logger.info(
      'To stop',
      this._jobs.stop.map((n) => n.getName()),
    );
    this._logger.info(
      'To transpile',
      this._jobs.transpile.map((n) => n.getName()),
    );
    this._logger.info(
      'To type-check',
      this._jobs.typeCheck.map((n) => n.node.getName()),
    );
    this._logger.info(
      'To start',
      this._jobs.start.map((n) => n.getName()),
    );

    const stopJobs$: Array<Observable<IRecompilationEvent>> = this._jobs.stop.map((node) => {
      return new Observable<IRecompilationEvent>((obs) => {
        obs.next({ node, type: RecompilationEventType.STOP_IN_PROGRESS });
        const now = Date.now();
        node.stop().subscribe(
          (node) => {
            this._logger.debug('Stopped', node.getName());
            obs.next({
              node: node,
              type: RecompilationEventType.STOP_SUCCESS,
              took: Date.now() - now,
            });
            return obs.complete();
          },
          (err) => {
            obs.next({
              node: node,
              type: RecompilationEventType.STOP_FAILURE,
              took: Date.now() - now,
            });
            this._logger.error('Error stopping', node.getName(), err);
            return obs.error(err);
          },
        );
      });
    });

    const transpilingJobs$: Array<Observable<IRecompilationEvent>> = this._jobs.transpile.map((node) => {
      return new Observable<IRecompilationEvent>((obs) => {
        obs.next({ node, type: RecompilationEventType.TRANSPILE_IN_PROGRESS });
        const now = Date.now();
        node.transpile().subscribe(
          (node) => {
            this._logger.debug('Transpiled', node.getName());
            obs.next({
              node: node,
              type: RecompilationEventType.TRANSPILE_SUCCESS,
              took: Date.now() - now,
            });
            return obs.complete();
          },
          (err) => {
            obs.next({
              node: node,
              type: RecompilationEventType.TYPE_CHECK_FAILURE,
              took: Date.now() - now,
            });
            this._logger.error('Error transpiling', err);
            return obs.error(err);
          },
        );
      });
    });

    const startJobs$: Array<Observable<IRecompilationEvent>> = this._jobs.start.map((service) => {
      return new Observable<IRecompilationEvent>((obs) => {
        obs.next({
          node: service,
          type: RecompilationEventType.START_IN_PROGRESS,
        });
        const now = Date.now();
        service.start().subscribe(
          (node) => {
            this._logger.debug('Service started', service.getName());
            obs.next({
              node: node,
              type: RecompilationEventType.START_SUCCESS,
              took: Date.now() - now,
            });
            return obs.complete();
          },
          (err) => {
            this._logger.error('Error starting', err);
            const evt: IRecompilationEvent = {
              type: RecompilationEventType.START_FAILURE,
              node: service,
            };
            return obs.next(evt);
          },
        );
      });
    });

    const typeCheckJobs$: Array<Observable<IRecompilationEvent>> = this._jobs.typeCheck.map((job) => {
      return new Observable<IRecompilationEvent>((obs) => {
        obs.next({
          node: job.node,
          type: RecompilationEventType.TYPE_CHECK_IN_PROGRESS,
        });
        const now = Date.now();
        job.node.performTypeChecking(job.force).subscribe(
          (node) => {
            this._logger.debug('Type checked', job.node.getName());
            obs.next({
              node: node,
              type: RecompilationEventType.TYPE_CHECK_SUCCESS,
              took: Date.now() - now,
            });
            return obs.complete();
          },
          (err) => {
            this._logger.error('Error typechecking', err);
            obs.next({
              node: job.node,
              type: RecompilationEventType.TYPE_CHECK_FAILURE,
              took: Date.now() - now,
            });
            if (job.throws) {
              const evt: IRecompilationError = {
                type: RecompilationErrorType.TYPE_CHECK_ERROR,
                node: job.node,
                logs: job.node.tscLogs,
              };
              return obs.error(evt);
            }
          },
        );
      });
    });

    this._recompilation = RecompilationStatus.STOPPING;

    const stop$: Observable<IRecompilationEvent> = new Observable<IRecompilationEvent>((obs) => {
      let stopped = 0;
      const allDone = (): void => {
        this._logger.info('All services stopped');
        this._recompilation = RecompilationStatus.COMPILING;
      };
      if (stopJobs$.length === 0) {
        allDone();
        return obs.complete();
      }
      from(stopJobs$)
        .pipe(mergeMap((stopJob$) => stopJob$))
        .subscribe(
          (evt) => {
            obs.next(evt);
            if (evt.type === RecompilationEventType.STOP_SUCCESS) {
              stopped++;
              this._logger.info(`Stopped ${stopped}/${stopJobs$.length} services`);
              if (stopped >= stopJobs$.length) {
                allDone();
                return obs.complete();
              }
            }
          },
          (err) => {
            this._logger.error('Error stopping service', err);
            return obs.error(err);
          },
        );
    });

    const transpile$: Observable<IRecompilationEvent> = new Observable<IRecompilationEvent>((obs) => {
      let transpiled = 0;
      const allDone = (): void => {
        this._logger.info('All dependencies transpiled');
        this._recompilation = RecompilationStatus.STARTING;
      };
      if (transpilingJobs$.length === 0) {
        allDone();
        return obs.complete();
      }
      from(transpilingJobs$)
        .pipe(mergeAll(this._concurrency))
        .subscribe(
          (evt) => {
            obs.next(evt);
            if (evt.type === RecompilationEventType.TRANSPILE_SUCCESS) {
              transpiled++;
              this._logger.info(`Transpiled ${transpiled}/${transpilingJobs$.length} services`);
              if (transpiled >= transpilingJobs$.length) {
                allDone();
                return obs.complete();
              }
            }
          },
          (err) => {
            this._logger.error('Error transpiling service', err);
            return obs.error(err);
          },
        );
    });

    const typeCheck$: Observable<IRecompilationEvent> = new Observable<IRecompilationEvent>((obs) => {
      let typeChecked = 0;
      const allDone = (): void => this._logger.info('Type-checking performed');
      if (typeCheckJobs$.length === 0) {
        allDone();
        return obs.complete();
      }
      concat(typeCheckJobs$)
        .pipe(concatAll())
        .subscribe(
          (evt) => {
            obs.next(evt);
            if (evt.type === RecompilationEventType.TYPE_CHECK_SUCCESS) {
              typeChecked++;
              this._logger.info(`Type-checked ${typeChecked}/${typeCheckJobs$.length} services`);
              if (typeChecked >= typeCheckJobs$.length) {
                allDone();
                return obs.complete();
              }
            }
          },
          () => {
            this._logger.warn('Typechecking failed !');
            // FIXME: MILA-72 Fault tolerant in start mode, not in build mode
            // return obs.error() if the
            return obs.complete();
          },
          () => {
            this._logger.warn('All typechecking performed !');
            return obs.complete();
          },
        );
    });

    const start$: Observable<IRecompilationEvent> = new Observable<IRecompilationEvent>((obs) => {
      let started = 0;
      const allDone = (): void => {
        this._logger.info('All services started');
        this._recompilation = RecompilationStatus.STARTING;
      };
      if (startJobs$.length === 0) {
        allDone();
        return obs.complete();
      }
      from(startJobs$)
        .pipe(mergeAll(this._concurrency))
        .subscribe(
          (evt) => {
            obs.next(evt);
            if (
              evt.type === RecompilationEventType.START_FAILURE ||
              evt.type === RecompilationEventType.START_SUCCESS
            ) {
              started++;
              this._logger.info(`Started ${started}/${startJobs$.length} services`);
              if (started >= startJobs$.length) {
                allDone();
                return obs.complete();
              }
            }
          },
          (err) => {
            this._logger.error('Error starting services');
            return obs.error(err);
          },
        );
    });

    const recompilationProcess$: Observable<IRecompilationEvent> = new Observable<IRecompilationEvent>((obs) => {
      concat([stop$, merge(typeCheck$, concat(transpile$, start$))])
        .pipe(concatAll(), takeUntil(this._abort$))
        .subscribe(
          (evt) => obs.next(evt),
          (err) => {
            this._logger.error('Error happened in tasks execution', err);
            this._reset();
            return obs.error(err);
          },
          () => {
            this._logger.info('All tasks finished');
            this._reset();
            return obs.complete();
          },
        );
    });

    this._logger.info('All tasks successfully scheduled');
    return recompilationProcess$.pipe(filter((evt) => !!evt));
  }

  buildOne(service: Node, onlySelf: boolean, force: boolean): Observable<IRecompilationEvent> {
    if (onlySelf) {
      this._requestTypeCheck(service, force, true);
    } else {
      this._compile([service], RecompilationMode.SAFE, force);
    }
    return this._exec();
  }

  buildAll(graph: DependenciesGraph, onlySelf: boolean, force: boolean): Observable<IRecompilationEvent> {
    if (onlySelf) {
      graph.getServices().forEach((s) => this._requestTypeCheck(s, force, true));
    } else {
      this._compile(graph.getServices(), RecompilationMode.SAFE, force);
    }
    return this._exec();
  }

  package(services: Service | Service[]): Observable<IPackageEvent> {
    const toPackage = Array.isArray(services) ? services : [services];
    this._logger.info(
      'Requested to package',
      toPackage.map((s) => s.getName()),
    );
    const packageJobs$: Array<Observable<IPackageEvent>> = toPackage.map((s) => s.package());
    return from(packageJobs$).pipe(mergeAll(this._concurrency));
  }

  remove(services: Service | Service[], stage: string): Observable<IDeployEvent> {
    const toRemove = Array.isArray(services) ? services : [services];
    this._logger.info(
      'Requested to remove',
      toRemove.map((s) => s.getName()),
    );
    const removeJobs$: Array<Observable<IDeployEvent>> = toRemove.map((s) => s.remove(stage));
    return from(removeJobs$).pipe(mergeAll(this._concurrency));
  }

  deploy(services: Service | Service[], stage: string): Observable<IDeployEvent> {
    const toDeploy = Array.isArray(services) ? services : [services];
    this._logger.info(
      'Requested to remove',
      toDeploy.map((s) => s.getName()),
    );
    const deployJobs$: Array<Observable<IDeployEvent>> = toDeploy.map((s) => s.deploy(stage));
    return from(deployJobs$).pipe(mergeAll(this._concurrency));
  }
}

/*
TODO:
- Unit tests
 */
