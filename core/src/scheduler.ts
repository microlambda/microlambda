import { Subject, Subscription } from "rxjs";
import { ILogger, Logger } from './logger';
import { getDefaultThreads } from './platform';
import { Workspace } from "./graph/workspace";
import { Project } from "./graph/project";
import { RunCommandEvent, Runner } from "@centipod/core";

export interface StopServiceEvent { service: Workspace, type: 'stopping' | 'stopped' }

export type RunCommandSchedulerEvent = RunCommandEvent & { cmd: 'start' | 'transpile' | 'build' };

export type SchedulerEvent = RunCommandSchedulerEvent | StopServiceEvent;

export const isStopServiceEvent = (evt: SchedulerEvent): evt is StopServiceEvent => ['stopping', 'stopped'].includes(String(evt.type));

export class Scheduler {
  private readonly _logger: ILogger;
  private readonly _concurrency: number;

  private _events$ = new Subject<SchedulerEvent>();
  events$ = this._events$.asObservable();

  private _targets = new Set<Workspace>();
  private readonly _runners: {
    transpile: Runner,
    build: Runner,
    start: Map<string, Runner>,
  };
  private _subscriptions: {
    transpile?: Subscription,
    build?: Subscription,
    start: Map<string, Subscription>,
  } = {
    start: new Map(),
  };

  constructor(readonly project: Project, logger: Logger, concurrency?: number) {
    this._logger = logger.log('scheduler');
    this._logger.debug('New recompilation scheduler instance');
    this._concurrency = concurrency || getDefaultThreads();
    this._runners = {
      transpile: new Runner(this.project, this._concurrency),
      build: new Runner(this.project, this._concurrency),
      start: new Map(),
    }
  }

  public startOne(service: Workspace): void {
    if (!this._runners.start?.has(service.name)) {
      this._targets.add(service);
      return this._exec({ toStart: new Set([service]), toStop: new Set() });
    } else {
      console.debug('Service', service.name, 'already started');
    }
  }

  public startAll(): void {
    if (this.project.services.size > (this._runners.start?.size || 0)) {
      this.project.services.forEach((w) => this._targets.add(w));
      return this._exec({ toStart: new Set([...this.project.services.values()]), toStop: new Set() });
    } else {
      console.debug('All services already started');
    }
  }

  public stopOne(service: Workspace): void {
    this._targets.delete(service);
    return this._exec({ toStart: new Set(), toStop: new Set([service]) });
  }

  public gracefulShutdown(): void {
    this._targets.clear();
    this._exec({ toStart: new Set(), toStop: new Set([...this.project.services.values()]) });
  }

  public stopAll(): void {
    // Stop all running services
    return this.gracefulShutdown();
  }

  public restartOne(service: Workspace, recompile = false): void {
    return this._exec({ toStart: new Set([service]), toStop: new Set([service]) });
  }

  public restartAll(recompile = true): void {
    return this._exec({ toStart: new Set([...this.project.services.values()]), toStop: new Set([...this.project.services.values()]) });
  }

  private _exec(jobs: {toStart: Set<Workspace>, toStop: Set<Workspace>}): void {
    // Abort previous transpile and build and rerun in watch mode
    this._runners.transpile.unwatch('transpile');
    this._runners.build.unwatch('build');
    this._subscriptions.transpile?.unsubscribe();
    this._subscriptions.build?.unsubscribe();
    this._runners.transpile = new Runner(this.project, this._concurrency);
    this._runners.build = new Runner(this.project, this._concurrency);
    const transpile$ = this._runners.transpile.runCommand('transpile', {
      mode: 'topological',
      force: false,
      to: [...this._targets]
    });
    const build$ = this._runners.transpile.runCommand('build', {
      mode: 'topological',
      force: false,
      to: [...this._targets]
    });
    this._subscriptions.transpile = transpile$.subscribe({
      next: (evt) => this._events$.next({ ...evt, cmd: 'transpile' }),
      error: (error) => {
        console.error(error);
      },
      complete: () => {
        delete this._subscriptions.transpile;
      },
    });
    this._subscriptions.build = build$.subscribe({
      next: (evt) => this._events$.next({ ...evt, cmd: 'build' }),
      error: (error) => {
        console.error(error);
      },
      complete: () => {
        delete this._subscriptions.build;
      },
    });

    // Stop services, then start services
    Promise.all([...jobs.toStop].map( async (w) => {
      if (this._runners.start.has(w.name)) {
        this._events$.next({ service: w, type: 'stopping' });
        await w.kill('start');
        this._events$.next({ service: w, type: 'stopped' });
        this._subscriptions.start.get(w.name)?.unsubscribe();
        this._runners.start.delete(w.name);
      }
    })).then(() => {
      jobs.toStart.forEach((w) => {
        if (!this._runners.start.has(w.name)) {
          const runner = new Runner(this.project, this._concurrency);
          this._runners.start.set(w.name, runner);
          const daemon$ = runner.runCommand('start', { mode: 'parallel', workspaces: [w], force: true });
          const subscription = daemon$.subscribe({
            next: (evt) => this._events$.next({ ...evt, cmd: 'start' }),
            error: (error) => {
              console.error(error);
            },
            complete: () => {
              this._subscriptions.start.delete(w.name);
            },
          });
          this._subscriptions.start.set(w.name, subscription);
        }
      });
    });
  }
}
