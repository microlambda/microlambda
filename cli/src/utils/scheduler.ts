import { concat, forkJoin, Observable, of, Subject, throwError } from 'rxjs';
import { LernaGraph, LernaNode, Service } from '../lerna';
import { catchError, concatAll, debounceTime, last, map, takeUntil } from 'rxjs/operators';
import { log } from './logger';

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

enum RecompilationEventType {
  SERVICE_STOPPED,
  NODE_COMPILED,
  SERVICE_STARTED,
}

export enum RecompilationMode {
  LAZY,
  NORMAL,
  EAGER,
}

interface IRecompilationEvent {
  type: RecompilationEventType;
  node: LernaNode;
}

export class RecompilationScheduler {
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

  constructor() {
    log.debug('New recompilation scheduler instance');
    this._reset();
    this._debounce = 300;
    // this._mode = RecompilationMode.NORMAL;
    this._watchFileChanges();
  }

  public setMode(mode: RecompilationMode) {
    this._mode = mode;
  }

  /**
   * Compile and start the whole project
   */
  public async startProject(graph: LernaGraph, compile = true): Promise<void> {
    log.debug('Starting project');
    if (compile) {
      // Compile all enabled nodes from leaves to roots
      log.debug('Building compilation queue...', graph.getNodes().filter((n) => n.isEnabled()).length);
      this._recompile(graph.getNodes().filter((n) => n.isEnabled()));
    }
    log.debug(
      'Compilation queue built',
      this._jobs.compile.map((n) => n.getName()),
    );

    // Start all services
    log.debug('Building start queue...');
    graph
      .getServices()
      .filter((s) => s.isEnabled())
      .forEach((service) => {
        this._requestStart(service);
      });
    log.debug(
      'Start queue built',
      this._jobs.start.map((n) => n.getName()),
    );
    log.debug('Executing tasks');
    return this._exec();
  }

  public async stopProject(graph: LernaGraph): Promise<void> {
    this._reset();
    graph
      .getServices()
      .filter((s) => s.isEnabled())
      .forEach((s) => this._requestStop(s));
    return this._exec();
  }

  public fileChanged(node: LernaNode): void {
    this._changes.add(node);
    this._filesChanged$.next();
  }

  private _watchFileChanges() {
    this._filesChanged$
      .asObservable()
      .pipe(debounceTime(this._debounce))
      .subscribe(async (changes) => {
        if (this._changes.size > 0) {
          log.info('Triggering recompilation...');
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
          this._recompile([...this._changes]);

          // start the stopped services
          impactedServices.forEach((s) => this._requestStart(s));

          // rerun recompilation
          this._exec();
        }
      });
  }

  /**
   * Recompile any array of nodes from leaves to roots
   * @param toCompile
   * @private
   */
  private _recompile(toCompile: LernaNode[]) {
    log.debug(
      'Requested to compile nodes',
      toCompile.map((n) => n.getName()),
    );
    log.debug('Recompilation mode', this._mode);
    // Find roots
    const roots = toCompile.filter((n) => !n.getDependent().some((dep) => toCompile.includes(dep)));
    log.debug(
      'Root nodes',
      roots.map((n) => n.getName()),
    );
    const recursivelyCompile = (nodes: LernaNode[], requested: Set<LernaNode>): void => {
      for (const node of nodes) {
        log.debug('Request to compile', node.getName());
        // For each node get his children and compile them before him
        const dependencies = node.getChildren().filter((d) => {
          const inRequest = toCompile.includes(d);
          if (this._mode > RecompilationMode.LAZY) {
            const hasDescendantInRequest = d.getDependencies().some((descendant) => toCompile.includes(descendant));
            log.debug('should compile ?', {
              name: d.getName(),
              enabled: d.isEnabled(),
              inRequest,
              hasDescendantInRequest,
            });
            return d.isEnabled() && (hasDescendantInRequest || inRequest);
          }
          log.debug('should compile ?', {
            name: d.getName(),
            enabled: d.isEnabled(),
            inRequest,
          });
          return d.isEnabled() && inRequest;
        });
        log.debug('Has dependencies', dependencies.length);
        if (dependencies.length > 0) {
          recursivelyCompile(dependencies, requested);
        }
        const isRootService = roots.includes(node) && node.isService();
        const shouldBeCompiled = this._mode === RecompilationMode.EAGER || !isRootService;
        if (shouldBeCompiled && !requested.has(node)) {
          this._requestCompilation(node);
          log.debug('Added to compilation queue', node.getName());
          requested.add(node);
        } else {
          log.debug('Already in compilation queue', node.getName());
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
    log.debug(`Request to add stop job`, service.getName());
    const inQueue = this._alreadyQueued(service, 'stop');
    log.debug('Already in stop queue', inQueue);
    if (!inQueue) {
      log.debug('Adding service in stop job queue', service.getName());
      this._jobs.stop.push(service);
    }
  }

  private _requestCompilation(node: LernaNode): void {
    log.debug(`Request to add compilation job`, node.getName());
    const inQueue = this._alreadyQueued(node, 'compile');
    log.debug('Already in compilation queue', inQueue);
    if (!inQueue) {
      log.debug('Adding node in start compilation queue', node.getName());
      this._jobs.compile.push(node);
    }
  }

  private _requestStart(service: Service): void {
    log.debug(`Request to add start job`, service.getName());
    const inQueue = this._alreadyQueued(service, 'start');
    log.debug('Already in start queue', inQueue);
    if (!inQueue) {
      log.debug('Adding service in start job queue', service.getName());
      this._jobs.start.push(service);
    }
  }

  private _alreadyQueued(node: LernaNode, queue: 'compile' | 'start' | 'stop'): boolean {
    return this._jobs[queue].some((n) => n.getName() === node.getName());
  }

  private _exec(): Promise<void> {
    if (this._status === SchedulerStatus.BUSY) {
      log.warn('Scheduler is already busy');
      this._abort$.next();
      return;
    }
    if (this._status === SchedulerStatus.ABORTED) {
      log.info('Previous recompilation has been preempted');
    }
    this._status = SchedulerStatus.BUSY;
    log.debug('Executing recompilation task');
    log.debug(
      'To stop',
      this._jobs.stop.map((n) => n.getName()),
    );
    log.debug(
      'To compile',
      this._jobs.compile.map((n) => n.getName()),
    );
    log.debug(
      'To start',
      this._jobs.start.map((n) => n.getName()),
    );

    const stopJobs$: Array<Observable<IRecompilationEvent>> = this._jobs.stop.map((s) =>
      s.stop().pipe(
        map((service) => {
          log.debug('[scheduler] stopped', service.getName());
          return { node: service, type: RecompilationEventType.SERVICE_STOPPED };
        }),
        catchError((err) => {
          log.error(err);
          return throwError(err);
        }),
      ),
    );

    const compilationJobs$: Array<Observable<IRecompilationEvent>> = this._jobs.compile.map((node) =>
      node.compileNode(this._mode).pipe(
        map((node) => {
          log.debug('[scheduler] compiled', node.getName());
          return { node: node, type: RecompilationEventType.NODE_COMPILED };
        }),
        catchError((err) => {
          log.error(err);
          return throwError(err);
        }),
      ),
    );

    const startJobs$: Array<Observable<IRecompilationEvent>> = this._jobs.start.map((s) =>
      s.start().pipe(
        map((service) => {
          log.debug('[scheduler] started', service.getName());
          return { node: service, type: RecompilationEventType.SERVICE_STARTED };
        }),
        catchError((err) => {
          log.error(err);
          return throwError(err);
        }),
      ),
    );

    this._recompilation = RecompilationStatus.STOPPING;

    const stop$: Observable<RecompilationStatus> = forkJoin(stopJobs$).pipe(map(() => RecompilationStatus.STOPPED));
    const start$: Observable<RecompilationStatus> = forkJoin(startJobs$).pipe(map(() => RecompilationStatus.STARTED));
    const compile$: Observable<RecompilationStatus> =
      compilationJobs$.length > 0
        ? concat(compilationJobs$)
            .pipe(concatAll(), last())
            .pipe(map(() => RecompilationStatus.COMPILED))
        : of(RecompilationStatus.COMPILED);

    const recompilationProcess$ = concat([stop$, compile$, start$]).pipe(concatAll(), takeUntil(this._abort$));

    return new Promise<void>((resolve, reject) => {
      recompilationProcess$.subscribe(
        (status) => {
          switch (status) {
            case RecompilationStatus.STOPPED:
              log.debug('[scheduler] All services stopped');
              this._recompilation = RecompilationStatus.COMPILING;
              break;
            case RecompilationStatus.COMPILED:
              log.debug('[scheduler] All dependencies compiled');
              this._recompilation = RecompilationStatus.STARTING;
              break;
            case RecompilationStatus.STARTED:
              log.debug('[scheduler] All services started');
              this._recompilation = RecompilationStatus.FINISHED;
              break;
          }
        },
        (err) => {
          log.error(err);
          this._reset();
          reject();
        },
        () => {
          log.info('[scheduler] all tasks finished');
          this._reset();
          resolve();
        },
      );
    });
  }
}
