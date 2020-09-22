import { concat, from, Observable, of, Subject, throwError } from 'rxjs';
import { LernaGraph, LernaNode, Service } from '../lerna';
import { catchError, concatAll, debounceTime, last, map, mergeMap, takeUntil, tap } from 'rxjs/operators';
import { ServiceStatus } from '../lerna/enums/service.status';
import { CompilationStatus } from '../lerna/enums/compilation.status';
import { CompilationMode } from '../config/config';
import { Logger } from './logger';

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
  SERVICE_STOPPED,
  NODE_COMPILED,
  SERVICE_STARTED,
}

export enum RecompilationMode {
  FAST,
  SAFE,
}

export interface IRecompilationEvent {
  type: RecompilationEventType;
  node: LernaNode;
}

export class RecompilationScheduler {
  private _graph: LernaGraph;
  private _jobs: {
    stop: Service[];
    compile: LernaNode[];
    start: Service[];
  };
  private _status: SchedulerStatus;
  private _recompilation: RecompilationStatus;
  private _abort$: Subject<void> = new Subject<void>();
  private _mode: RecompilationMode;
  private _filesChanged$: Subject<void> = new Subject<void>();
  private _changes: Set<LernaNode>;
  private _debounce: number;
  private _logger: Logger;

  constructor(logger: Logger) {
    this._logger = logger;
    this._logger.log('scheduler').debug('New recompilation scheduler instance');
    this._reset();
    this._debounce = 300;
    this._mode = RecompilationMode.FAST;
    this._watchFileChanges();
  }

  public setGraph(graph: LernaGraph): void {
    this._graph = graph;
  }

  public setMode(mode: CompilationMode): void {
    switch (mode) {
      case 'safe':
        this._mode = RecompilationMode.SAFE;
        break;
      case 'fast':
        this._mode = RecompilationMode.FAST;
        break;
      default:
        this._logger.log('scheduler').warn('Invalid compilation mode. Fallback on fast');
        this._mode = RecompilationMode.FAST;
        break;
    }
  }

  public startOne(service: Service): Observable<IRecompilationEvent> {
    // Enable service and its descendants
    this._graph.enableOne(service);

    // Compile nodes that are not compiled yet
    this._compile([service], false);

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
    this._compile(roots, false);

    // Start services that are not already started
    toStart.forEach((s) => this._requestStart(s));
    return this._exec();
  }

  public stopOne(service: Service): Observable<IRecompilationEvent> {
    // Disable "orphan" nodes i.e. nodes that are descendant of the service to stop but used by no other
    // enabled nodes
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
    this._graph.getNodes().forEach((n) => n.disable());

    // Stop all running services
    return this.gracefulShutdown();
  }

  public restartOne(service: Service, recompile = false): Observable<IRecompilationEvent> {
    this._requestStop(service);
    this._compile([service], recompile);
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
    this._logger.log('scheduler').debug('Starting project');
    if (compile) {
      // Compile all enabled nodes from leaves to roots
      this._logger
        .log('scheduler')
        .debug('Building compilation queue...', graph.getNodes().filter((n) => n.isEnabled()).length);
      this._compile(graph.getNodes().filter((n) => n.isEnabled()));
    }
    this._logger.log('scheduler').debug(
      'Compilation queue built',
      this._jobs.compile.map((n) => n.getName()),
    );

    // Start all services
    this._logger.log('scheduler').debug('Building start queue...');
    graph
      .getServices()
      .filter((s) => s.isEnabled())
      .forEach((service) => {
        this._requestStart(service);
      });
    this._logger.log('scheduler').debug(
      'Start queue built',
      this._jobs.start.map((n) => n.getName()),
    );
    this._logger.log('scheduler').debug('Executing tasks');
    return this._execPromise();
  }

  public async compile(graph: LernaNode): Promise<void>;
  public async compile(node: LernaGraph): Promise<void>;
  public async compile(target: LernaGraph | LernaNode): Promise<void>;
  public async compile(target: LernaGraph | LernaNode): Promise<void> {
    const isGraph = (target: LernaGraph | LernaNode): target is LernaGraph => {
      return target instanceof LernaGraph;
    };
    if (isGraph(target)) {
      target.getNodes().forEach((n) => n.enable());
      this._compile(target.getNodes());
    } else if (this._mode === RecompilationMode.FAST) {
      target.enable();
      this._compile([target]);
    } else {
      const descendants = target.getDependencies();
      const toCompile = [...descendants, target];
      toCompile.forEach((n) => n.enable());
      this._compile(toCompile);
    }
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
          this._logger.log('scheduler').info('Triggering recompilation...');
          // abort previous recompilation if any
          this._abort$.next();
          // find all services that are impacted
          const impactedServices: Set<Service> = new Set<Service>();
          for (const node of this._changes) {
            if (node.isService() && node.isEnabled()) {
              impactedServices.add(node as Service);
            }
            const dependantServices = node.getDependent().filter((n) => n.isService() && n.isEnabled());
            dependantServices.forEach((s) => impactedServices.add(s as Service));
          }
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

  /**
   * Recompile any array of nodes from leaves to roots
   * @param toCompile: nodes to compile.
   * @param recompile: recompile nodes that are already compiled
   * @param compileServices
   * @private
   */
  private _compile(toCompile: LernaNode[], recompile = true, compileServices = false): void {
    this._logger.log('scheduler').debug(
      'Requested to compile nodes',
      toCompile.map((n) => n.getName()),
    );
    this._logger.log('scheduler').debug('Recompilation mode', this._mode);
    // Find roots
    const roots = toCompile.filter((n) => !n.getDependent().some((dep) => toCompile.includes(dep)));
    this._logger.log('scheduler').debug(
      'Root nodes',
      roots.map((n) => n.getName()),
    );
    const recursivelyCompile = (nodes: LernaNode[], requested: Set<LernaNode>): void => {
      for (const node of nodes) {
        this._logger.log('scheduler').debug('Request to compile', node.getName());
        // For each node get his children and compile them before him
        const dependencies = node.getChildren().filter((d) => {
          const inRequest = toCompile.includes(d);
          if (this._mode === RecompilationMode.SAFE) {
            const hasDescendantInRequest = d.getDependencies().some((descendant) => toCompile.includes(descendant));
            this._logger.log('scheduler').debug('should compile ?', {
              name: d.getName(),
              enabled: d.isEnabled(),
              inRequest,
              hasDescendantInRequest,
            });
            return d.isEnabled() && (hasDescendantInRequest || inRequest);
          }
          this._logger.log('scheduler').debug('should compile ?', {
            name: d.getName(),
            enabled: d.isEnabled(),
            inRequest,
          });
          return d.isEnabled() && inRequest;
        });
        this._logger.log('scheduler').debug('Has dependencies', dependencies.length);
        if (dependencies.length > 0) {
          recursivelyCompile(dependencies, requested);
        }
        const isRootService = roots.includes(node) && node.isService();
        const notAlreadyCompiled = recompile || node.getCompilationStatus() !== CompilationStatus.COMPILED;
        const shouldBeCompiled = compileServices || (!isRootService && notAlreadyCompiled);
        if (shouldBeCompiled && !requested.has(node)) {
          this._requestCompilation(node);
          this._logger.log('scheduler').debug('Added to compilation queue', node.getName());
          requested.add(node);
        } else {
          this._logger.log('scheduler').debug('Already in compilation queue', node.getName());
        }
      }
    };
    recursivelyCompile(roots, new Set());
  }

  private _reset(): void {
    this._abort$.next();
    this._jobs = {
      stop: [],
      compile: [],
      start: [],
    };
    this._recompilation = RecompilationStatus.READY;
    this._status = SchedulerStatus.READY;
    this._changes = new Set<LernaNode>();
  }

  private _requestStop(service: Service): void {
    this._logger.log('scheduler').debug(`Request to add stop job`, service.getName());
    const inQueue = this._alreadyQueued(service, 'stop');
    this._logger.log('scheduler').debug('Already in stop queue', inQueue);
    if (!inQueue) {
      this._logger.log('scheduler').debug('Adding service in stop job queue', service.getName());
      this._jobs.stop.push(service);
    }
  }

  private _requestCompilation(node: LernaNode): void {
    this._logger.log('scheduler').debug(`Request to add compilation job`, node.getName());
    const inQueue = this._alreadyQueued(node, 'compile');
    this._logger.log('scheduler').debug('Already in compilation queue', inQueue);
    if (!inQueue) {
      this._logger.log('scheduler').debug('Adding node in start compilation queue', node.getName());
      this._jobs.compile.push(node);
    }
  }

  private _requestStart(service: Service): void {
    this._logger.log('scheduler').debug(`Request to add start job`, service.getName());
    const inQueue = this._alreadyQueued(service, 'start');
    this._logger.log('scheduler').debug('Already in start queue', inQueue);
    if (!inQueue) {
      this._logger.log('scheduler').debug('Adding service in start job queue', service.getName());
      this._jobs.start.push(service);
    }
  }

  private _alreadyQueued(node: LernaNode, queue: 'compile' | 'start' | 'stop'): boolean {
    return this._jobs[queue].some((n) => n.getName() === node.getName());
  }

  private _execPromise(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const recompilationProcess$ = this._exec();
      this._logger.log('scheduler').debug('Recompilation process', recompilationProcess$);
      recompilationProcess$.subscribe(
        (event) => this._logger.log('scheduler').debug(event),
        (err) => reject(err),
        () => resolve(),
      );
    });
  }

  private _exec(): Observable<IRecompilationEvent> {
    if (this._status === SchedulerStatus.BUSY) {
      this._logger.log('scheduler').warn('Scheduler is already busy');
      this._abort$.next();
      return;
    }
    if (this._status === SchedulerStatus.ABORTED) {
      this._logger.log('scheduler').info('Previous recompilation has been preempted');
    }
    this._status = SchedulerStatus.BUSY;
    this._logger.log('scheduler').debug('Executing recompilation task');
    this._logger.log('scheduler').debug(
      'To stop',
      this._jobs.stop.map((n) => n.getName()),
    );
    this._logger.log('scheduler').debug(
      'To compile',
      this._jobs.compile.map((n) => n.getName()),
    );
    this._logger.log('scheduler').debug(
      'To start',
      this._jobs.start.map((n) => n.getName()),
    );

    const stopJobs$: Array<Observable<IRecompilationEvent>> = this._jobs.stop.map((s) =>
      s.stop().pipe(
        map((service) => {
          this._logger.log('scheduler').debug('Stopped', service.getName());
          return { node: service, type: RecompilationEventType.SERVICE_STOPPED };
        }),
        catchError((err) => {
          this._logger.log('scheduler').error(err);
          return throwError(err);
        }),
      ),
    );

    const compilationJobs$: Array<Observable<IRecompilationEvent>> = this._jobs.compile.map((node) =>
      node.compileNode(this._mode).pipe(
        map((node) => {
          this._logger.log('scheduler').debug('Compiled', node.getName());
          return { node: node, type: RecompilationEventType.NODE_COMPILED };
        }),
        catchError((err) => {
          this._logger.log('scheduler').error(err);
          return throwError(err);
        }),
      ),
    );

    const startJobs$: Array<Observable<IRecompilationEvent>> = this._jobs.start.map((s) =>
      s.start().pipe(
        map((service) => {
          this._logger.log('scheduler').debug('Started', service.getName());
          return { node: service, type: RecompilationEventType.SERVICE_STARTED };
        }),
        catchError((err) => {
          this._logger.log('scheduler').error(err);
          return throwError(err);
        }),
      ),
    );

    this._recompilation = RecompilationStatus.STOPPING;

    const afterStopped = (): void => {
      this._logger.log('scheduler').info('All services stopped');
      this._recompilation = RecompilationStatus.COMPILING;
    };

    const stop$: Observable<IRecompilationEvent> =
      stopJobs$.length > 0
        ? from(stopJobs$).pipe(
            mergeMap((stopJob$) => stopJob$),
            last(),
            tap(afterStopped.bind(this)),
          )
        : of(null).pipe(tap(afterStopped.bind(this)));

    const afterCompiled = (): void => {
      this._logger.log('scheduler').info('All dependencies compiled');
      this._recompilation = RecompilationStatus.STARTING;
    };

    const compile$: Observable<IRecompilationEvent> =
      compilationJobs$.length > 0
        ? concat(compilationJobs$).pipe(concatAll(), last(), tap(afterCompiled.bind(this)))
        : of(null).pipe(tap(afterCompiled.bind(this)));

    const afterStarted = (): void => {
      this._logger.log('scheduler').info('All dependencies compiled');
      this._recompilation = RecompilationStatus.STARTING;
    };

    const start$: Observable<IRecompilationEvent> =
      startJobs$.length > 0
        ? from(startJobs$).pipe(
            mergeMap((startJob$) => startJob$),
            last(),
            tap(afterStarted.bind(this)),
          )
        : of(null).pipe(tap(afterStarted.bind(this)));

    const recompilationProcess$: Observable<IRecompilationEvent> = concat([stop$, compile$, start$]).pipe(
      concatAll(),
      takeUntil(this._abort$),
      catchError((err) => {
        this._logger.log('scheduler').error(err);
        this._reset();
        return throwError(err);
      }),
      last(),
      tap(() => {
        this._logger.log('scheduler').info('All tasks finished');
        this._reset();
      }),
    );

    this._logger.log('scheduler').debug('All tasks successfully scheduled');
    return recompilationProcess$;
  }
}
