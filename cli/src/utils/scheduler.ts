import { concat, forkJoin, Observable, Subject, throwError } from 'rxjs';
import { LernaNode, Service } from '../lerna';
import { catchError, concatAll, takeUntil } from 'rxjs/operators';
import { execSync, spawn } from 'child_process';
import { CompilationStatus } from '../lerna/enums/compilation.status';
import { log } from './logger';

enum Status {
  READY,
  BUSY,
}

export class RecompilationScheduler {

  private _queue: {
    compile: LernaNode[];
    start: Service[];
  };
  private _status: Status;
  private _abort$: Subject<void> = new Subject<void>();

  constructor() {
    log.debug('New recompilation scheduler instance');
    this._reset();
  }

  private _reset() {
    this._queue = {
      compile: [],
      start: [],
    };
    this._status = Status.READY;
  }

  public requestCompilation(node: LernaNode) {
    log.debug(`Request to add compilation job`, node.getName());
    const inQueue = this._alreadyQueued(node, 'compile');
    const isRoot = node.isRoot();
    log.debug('Already in compilation queue', inQueue);
    log.debug('Root node', isRoot);
    if (!inQueue && !isRoot) {
      log.debug('Adding node in compilation job queue', node.getName());
      this._queue.compile.push(node);
    }
  }

  public requestStart(service: Service) {
    log.debug(`Request to add start job`, service.getName());
    const inQueue = this._alreadyQueued(service, 'start');
    log.debug('Already in compilation queue', inQueue);
    if (!inQueue) {
      log.debug('Adding service in start job queue', service.getName());
      this._queue.start.push(service);
    }
  }


  private _alreadyQueued(node: LernaNode, queue: 'compile' | 'start') {
    return this._queue[queue].some(n => n.getName() === node.getName());
  }

  public exec(): Promise<void> {
    if (this._status === Status.BUSY) {
      log.error('Scheduler is already busy');
      return;
    }
    this._status = Status.BUSY;
    log.debug('Executing recompilation task');
    log.debug('To compile', this._queue.compile.map(n => n.getName()));
    log.debug('To start', this._queue.start.map(n => n.getName()));

    const compilationJobs$ = this._queue.compile.map(node => this._compile(node));
    const startJobs$ = this._queue.start.map(service => service.start());

    const recompilationProcess$ = concat(compilationJobs$, forkJoin(startJobs$))
      .pipe(concatAll())
      .pipe(catchError((err) => {
        log.error(err);
        return throwError(err);
      }))
      .pipe(takeUntil(this._abort$));
    return new Promise<void>((resolve, reject) => {
      recompilationProcess$.subscribe(
        () => log.debug('Compiled'),
        (err) => {
          log.error(err);
          reject();
        },
        () => {
          log.info('All nodes recompiled');
          this._reset();
          resolve();
        },
      )
    });
  }

  public abort(): void {
    log.debug('Requested to abort recompilation');
    if (this._status === Status.BUSY) {
      this._reset();
      this._abort$.next();
    }
  }

  private _compile(node: LernaNode): Observable<void> {
    return new Observable<void>((observer) => {
      const tsVersion = execSync('npx tsc --version').toString().match(/[0-9]\.[0-9]\.[0-9]/)[0];
      node.setStatus(CompilationStatus.COMPILING);
      const spawnProcess = spawn('npx', ['tsc'], {
        cwd: node.getLocation(),
        env: process.env,
      });
      log.info(`Compiling package ${node.getName()} with typescript ${tsVersion}`);
      spawnProcess.stderr.on('data', (data) => {
        log.error(data);
      });
      spawnProcess.on('close', (code) => {
        if (code === 0) {
          node.setStatus(CompilationStatus.COMPILED);
          log.info(`Package compiled ${node.getName()}`);
          return observer.complete();
        } else {
          node.setStatus(CompilationStatus.ERROR_COMPILING);
          log.info(`Error compiling ${node.getName()}`);
          return observer.error();
        }
      });
      spawnProcess.on('error', (err) => {
        log.error(err);
        node.setStatus(CompilationStatus.ERROR_COMPILING);
        log.info(`Error compiling ${node.getName()}`, err);
        return observer.error(err);
      })
    });
  }
}
