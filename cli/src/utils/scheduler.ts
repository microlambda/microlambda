import { concat, forkJoin, Observable, of, Subject, throwError } from 'rxjs';
import { LernaNode, Service } from '../lerna';
import { catchError, concatAll, last, map, takeUntil } from 'rxjs/operators';
import { log } from './logger';
import { remove } from 'lodash';

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

interface IRecompilationEvent {
  type: RecompilationEventType;
  node: LernaNode;
}

export class RecompilationScheduler {
  private _queue: {
    stop: Service[];
    compile: LernaNode[];
    start: Service[];
  };
  private _status: SchedulerStatus;
  private _recompilation: RecompilationStatus;
  private _abort$: Subject<void> = new Subject<void>();

  constructor() {
    log.debug('New recompilation scheduler instance');
    this._reset();
  }

  private _reset() {
    this._queue = {
      stop: [],
      compile: [],
      start: [],
    };
    this._recompilation = RecompilationStatus.READY;
    this._status = SchedulerStatus.READY;
  }

  public reset() {
    this._abort$.next();
    this._reset();
  }

  public requestStop(service: Service) {
    log.debug(`Request to add stop job`, service.getName());
    const inQueue = this._alreadyQueued(service, 'stop');
    log.debug('Already in stop queue', inQueue);
    if (!inQueue) {
      log.debug('Adding service in stop job queue', service.getName());
      this._queue.stop.push(service);
    }
  }

  public requestCompilation(node: LernaNode) {
    log.debug(`Request to add compilation job`, node.getName());
    const inQueue = this._alreadyQueued(node, 'compile');
    const preempted = this._status === SchedulerStatus.ABORTED;
    const isRoot = node.isRoot();
    log.debug('Already in compilation queue', inQueue);
    log.debug('Root node', isRoot);
    log.debug('Preemption context', preempted);
    if (!preempted && !inQueue && !isRoot) {
      log.debug('Adding node in compilation job queue', node.getName());
      this._queue.compile.push(node);
    } else if (preempted && !isRoot) {
      if (!inQueue) {
        log.debug('Adding node in compilation job queue', node.getName());
        this._queue.compile.push(node);
      } else {
        log.debug('Moving job in last position of compilation queue', node.getName());
        remove(this._queue.compile, node.getName());
        this._queue.compile.push(node);
      }
    }
  }

  public requestStart(service: Service) {
    log.debug(`Request to add start job`, service.getName());
    const inQueue = this._alreadyQueued(service, 'start');
    log.debug('Already in start queue', inQueue);
    if (!inQueue) {
      log.debug('Adding service in start job queue', service.getName());
      this._queue.start.push(service);
    }
  }

  private _alreadyQueued(node: LernaNode, queue: 'compile' | 'start' | 'stop') {
    return this._queue[queue].some((n) => n.getName() === node.getName());
  }

  public exec(): Promise<void> {
    if (this._status === SchedulerStatus.BUSY) {
      log.warn('Scheduler is already busy');
      this.abort();
      return this.exec();
    }
    if (this._status === SchedulerStatus.ABORTED) {
      log.info('Previous recompilation has been preempted');
    }
    this._status = SchedulerStatus.BUSY;
    log.debug('Executing recompilation task');
    log.debug(
      'To stop',
      this._queue.stop.map((n) => n.getName()),
    );
    log.debug(
      'To compile',
      this._queue.compile.map((n) => n.getName()),
    );
    log.debug(
      'To start',
      this._queue.start.map((n) => n.getName()),
    );

    const stopJobs$: Array<Observable<IRecompilationEvent>> = this._queue.stop.map((s) =>
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

    const compilationJobs$: Array<Observable<IRecompilationEvent>> = this._queue.compile.map((node) =>
      node.compileNode().pipe(
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

    const startJobs$: Array<Observable<IRecompilationEvent>> = this._queue.start.map((s) =>
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

  public abort(): void {
    log.debug('Requested to abort recompilation');
    if (this._status === SchedulerStatus.BUSY) {
      log.debug('Scheduler is busy. Aborting');
      this._status = SchedulerStatus.ABORTED;
      // Keep a copy of these parameters as this._abort$.next() will reset them
      const stop = [...this._queue.stop];
      const compile = [...this._queue.compile];
      const start = [...this._queue.start];
      const recompilationStatus = this._recompilation;
      this._abort$.next();
      switch (recompilationStatus) {
        case RecompilationStatus.READY:
          log.debug('Scheduler was ready. No preemption.');
          break;
        case RecompilationStatus.STOPPING:
          log.debug('Scheduler was stopping services. Keep them in stop queue');
          stop.forEach((s) => this._queue.stop.push(s));
          compile.forEach((n) => this._queue.compile.push(n));
          start.forEach((s) => this._queue.start.push(s));
          break;
        case RecompilationStatus.STOPPED:
        case RecompilationStatus.COMPILING:
          log.debug('Scheduler was compiling services.');
          compile.forEach((n) => this._queue.compile.push(n));
          start.forEach((s) => this._queue.start.push(s));
          break;
        case RecompilationStatus.COMPILED:
        case RecompilationStatus.STARTING:
          // Some services where starting, put them back in stop queue
          log.debug('Scheduler was starting services. Stopping them');
          this._queue.start.forEach((s) => this._queue.stop.push(s));
          start.forEach((s) => this._queue.start.push(s));
          break;
        default:
          log.debug('Scheduler was in stable state. No preemption.');
          break;
      }
    }
  }
}
