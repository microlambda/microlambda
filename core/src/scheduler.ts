import { BehaviorSubject, concat, from, merge, Observable, of, Subject, throwError } from 'rxjs';
import { concatAll, debounceTime, filter, mergeAll, mergeMap, takeUntil } from 'rxjs/operators';
import { ILogger, Logger } from './logger';
import { getDefaultThreads, getThreads } from './platform';
import { ServiceStatus, SchedulerStatus } from '@microlambda/types';
import { Workspace } from "./graph/workspace";
import { Project } from "./graph/project";
import { Runner, RunOptions } from "@centipod/core/lib/runner";

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
  node: Workspace;
  took?: number;
  megabytes?: { code: number; layer?: number };
}

export interface IRecompilationError {
  type: RecompilationErrorType;
  node: Workspace;
  logs: string[];
}

export class Scheduler {
  private _graph: Project | null = null;
  private _jobs: {
    transpile?: RunOptions;
    typeCheck?: RunOptions;
    start?: RunOptions;
  } = {};
  private _startProcessesIds = new Map<string, string>(); // workspace name, pid

  private _status: SchedulerStatus = SchedulerStatus.READY;
  private _recompilation: RecompilationStatus = RecompilationStatus.READY;
  private _abort$: Subject<void> = new Subject<void>();
  private _filesChanged$: Subject<void> = new Subject<void>();
  private _changes: Set<Workspace> = new Set();
  private _debounce: number;
  private _logger: ILogger;
  private _concurrency: number;
  private _status$: BehaviorSubject<SchedulerStatus> = new BehaviorSubject<SchedulerStatus>(SchedulerStatus.READY);
  public status$ = this._status$.asObservable();
  private _runner: Runner | undefined;

  get status(): SchedulerStatus {
    return this._status;
  }

  constructor(logger: Logger) {
    this._logger = logger.log('scheduler');
    this._logger.debug('New recompilation scheduler instance');
    // this._reset();
    this._debounce = 300;
    this._watchFileChanges();
    this._concurrency = getDefaultThreads();
  }

  public setGraph(graph: Project): void {
    this._graph = graph;
    this._runner = new Runner(this._graph, this._concurrency);
  }

  public setConcurrency(threads?: number): void {
    if (threads) {
      this._concurrency = getThreads(threads);
    }
  }

  public startOne(service: Workspace): Observable<IRecompilationEvent> {
    // Already started
    /*if (this._startProcessesIds.has(service.name)) {
      return of(null);
    }*/
    this._jobs = {
      transpile: {
        mode: 'parallel',
        workspaces: Array.from(service.descendants.values()),
        force: false,
      },
     typeCheck: {
        mode: 'topological',
        to: service,
        force: false,
      },
      start: {
        mode: 'parallel',
        workspaces: [service],
        force: true,
      }
    };
    return this._exec();
  }

  public startAll(): Observable<IRecompilationEvent> {
    if (!this._graph) {
      // Compile nodes that are not already compiled
      return throwError('TODO')
    }
    this._jobs = {
      transpile: {
        mode: 'parallel',
        workspaces: Array.from(this._graph.workspaces.values()),
        force: false,
      },
      typeCheck: {
        mode: 'topological',
        force: false,
      },
      start: {
        mode: 'parallel',
        workspaces: Array.from(this._graph.services.values()),
        force: true,
      }
    };
    return this._exec();
  }

  public stopOne(service: Workspace): Observable<IRecompilationEvent> {
    // Stop the service
    //this._requestStop(service);
    //return this._exec();
    throw Error('Not implemented');
  }

  public gracefulShutdown(): Observable<IRecompilationEvent> {
    /*if (this._graph) {
      this._graph
        .getServices()
        .filter((s) => [ServiceStatus.RUNNING, ServiceStatus.STARTING].includes(s.status))
        .forEach((s) => this._requestStop(s));
    }
    return this._exec();*/
    throw Error('Not implemented');
  }

  public stopAll(): Observable<IRecompilationEvent> {
    // Stop all running services
    return this.gracefulShutdown();
  }

  public restartOne(service: Workspace, recompile = false): Observable<IRecompilationEvent> {
    /*this._requestStop(service);
    this._compile([service], RecompilationMode.FAST, recompile);
    this._requestStart(service);
    return this._exec();*/
    throw Error('Not implemented');
  }

  public restartAll(recompile = true): Observable<IRecompilationEvent> {
    /*if (this._graph) {
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
    return this._exec();*/
    throw Error('Not implemented');
  }

  public fileChanged(node: Workspace): void {
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
          //this._reset();
          // find all services that are impacted
          this._logger.info(
            'Changed nodes',
            changes.map((n) => n.name),
          );

          // request recompilation
          //this._compile([...changes]);

          // rerun recompilation
          this._exec().subscribe();
        }
      });
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
    /*if (this._status === SchedulerStatus.BUSY) {
      this._logger.warn('Scheduler is already busy');
      this._reset();
    }
    if (this._status === SchedulerStatus.ABORTED) {
      this._logger.info('Previous recompilation has been preempted');
    }
    this._status = SchedulerStatus.BUSY;
    this._status$.next(SchedulerStatus.BUSY);
    this._logger.info('Executing recompilation task');

    if (!this._graph) {
      return throwError('Project not defined');
    }

    const runner = new Runner(this._graph, this._concurrency);
    // runner.runCommand('stop', )

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
    return recompilationProcess$.pipe(filter((evt) => !!evt));*/
    throw Error('Not implemented');
  }

  typecheck(service: Workspace, force: any) {

  }
}
