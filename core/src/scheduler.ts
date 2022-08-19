import { Subject, Subscription } from "rxjs";
import { EventsLog, EventsLogger } from "@microlambda/logger";
import { getDefaultThreads } from "./platform";
import { Workspace } from "./graph/workspace";
import { Project } from "./graph/project";
import { RunCommandEvent, RunCommandEventEnum, Runner } from "@microlambda/runner-core";
import { ServiceStatus, TranspilingStatus, TypeCheckStatus } from "@microlambda/types";

export interface StopServiceEvent { service: Workspace, type: 'stopping' | 'stopped' }

export type RunCommandSchedulerEvent = RunCommandEvent & { cmd: 'start' | 'transpile' | 'build' };

export type SchedulerEvent = RunCommandSchedulerEvent | StopServiceEvent;

export const isStopServiceEvent = (evt: SchedulerEvent): evt is StopServiceEvent => ['stopping', 'stopped'].includes(String(evt.type));

export class Scheduler {
  private readonly _logger: EventsLogger;
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

  constructor(readonly project: Project, logger: EventsLog, concurrency?: number) {
    this._logger = logger.scope('core/scheduler');
    this._logger.debug('New recompilation scheduler instance');
    this._concurrency = concurrency || getDefaultThreads();
    this._runners = {
      transpile: new Runner(this.project, this._concurrency, undefined, logger),
      build: new Runner(this.project, this._concurrency, undefined, logger),
      start: new Map(),
    }
  }

  public startOne(service: Workspace): void {
    this._logger.info('Starting', service.name);
    if (!this._runners.start?.has(service.name)) {
      this._targets.add(service);
      return this._exec({ toStart: new Set([service]), toStop: new Set() });
    } else {
      this._logger.info('Service', service.name, 'already started');
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
    this._logger.info('Executing tasks');
    // Abort previous transpile and build and rerun in watch mode
    this._logger.info('Aborting previous build processes');
    this._runners.transpile.unwatch('transpile');
    this._runners.build.unwatch('build');
    this._subscriptions.transpile?.unsubscribe();
    this._subscriptions.build?.unsubscribe();
    this._runners.transpile = new Runner(this.project, this._concurrency, undefined, this._logger?.logger);
    this._runners.build = new Runner(this.project, this._concurrency, undefined, this._logger?.logger);
    this._logger.info('Building targets and their dependencies', [...this._targets].map((t) => t.name));
    const transpile$ = this._runners.transpile.runCommand('transpile', {
      mode: 'topological',
      force: false,
      to: [...this._targets],
      watch: true,
    });
    const build$ = this._runners.transpile.runCommand('build', {
      mode: 'topological',
      force: false,
      to: [...this._targets],
      watch: true,
    });
    this._subscriptions.transpile = transpile$.subscribe({
      next: (evt) => {
        switch(evt.type) {
          case RunCommandEventEnum.NODE_STARTED:
            this.project.getWorkspace(evt.workspace.name)?.updateStatus().transpiled(TranspilingStatus.TRANSPILING);
            break;
          case RunCommandEventEnum.NODE_PROCESSED:
            this.project.getWorkspace(evt.workspace.name)?.updateStatus().transpiled(TranspilingStatus.TRANSPILED);
            this.project.getWorkspace(evt.workspace.name)?.updateMetric().transpile({
              finishedAt: new Date().toISOString(),
              took: evt.result.overall,
              fromCache: evt.result.fromCache,
            })
            break;
          case RunCommandEventEnum.NODE_ERRORED:
            this.project.getWorkspace(evt.workspace.name)?.updateStatus().transpiled(TranspilingStatus.ERROR_TRANSPILING);
            break;
          case RunCommandEventEnum.NODE_INTERRUPTED:
            this.project.getWorkspace(evt.workspace.name)?.updateStatus().transpiled(TranspilingStatus.NOT_TRANSPILED);
            break;
        }
        this._events$.next({ ...evt, cmd: "transpile" });
      },
      error: (error) => {
        console.error(error);
      },
      complete: () => {
        delete this._subscriptions.transpile;
      },
    });
    this._subscriptions.build = build$.subscribe({
      next: (evt) => {
        switch(evt.type) {
          case RunCommandEventEnum.NODE_STARTED:
            this.project.getWorkspace(evt.workspace.name)?.updateStatus().typechecked(TypeCheckStatus.CHECKING);
            break;
          case RunCommandEventEnum.NODE_PROCESSED:
            this.project.getWorkspace(evt.workspace.name)?.updateStatus().typechecked(TypeCheckStatus.SUCCESS);
            this.project.getWorkspace(evt.workspace.name)?.updateMetric().typecheck({
              finishedAt: new Date().toISOString(),
              took: evt.result.overall,
              fromCache: evt.result.fromCache,
            });
            break;
          case RunCommandEventEnum.NODE_ERRORED:
            this.project.getWorkspace(evt.workspace.name)?.updateStatus().typechecked(TypeCheckStatus.ERROR);
            break;
          case RunCommandEventEnum.NODE_INTERRUPTED:
            this.project.getWorkspace(evt.workspace.name)?.updateStatus().typechecked(TypeCheckStatus.NOT_CHECKED);
            break;
        }
        this._events$.next({ ...evt, cmd: "build" });
      },
      error: (error) => {
        console.error(error);
      },
      complete: () => {
        delete this._subscriptions.build;
      },
    });

    // Stop services, then start services
    Promise.all([...jobs.toStop].map( async (w) => {
      this._logger.info('Stopping', w.name);
      if (this._runners.start.has(w.name)) {
        this._events$.next({ service: w, type: 'stopping' });
        this.project.getWorkspace(w.name)?.updateStatus().started(ServiceStatus.STOPPING);
        console.debug('Killing', w.name);
        await w.kill('start', [w.ports?.http, w.ports?.lambda, w.ports?.websocket].filter((p) => p != null) as number[]);
        this._logger.info('Serverless offline process killed', w.name);
        this.project.getWorkspace(w.name)?.updateStatus().started(ServiceStatus.STOPPED);
        this._events$.next({ service: w, type: 'stopped' });
        this._subscriptions.start.get(w.name)?.unsubscribe();
        this._runners.start.delete(w.name);
      } else {
        console.debug('Not started', w.name);
        this._logger.warn('Service not registered as running ', w.name);
      }
    })).then(() => {
      jobs.toStart.forEach((w) => {
        this._logger.info('Starting', w.name);
        if (!this._runners.start.has(w.name)) {
          const runner = new Runner(this.project, this._concurrency, undefined, this._logger.logger);
          this._runners.start.set(w.name, runner);
          this.project.getWorkspace(w.name)?.updateStatus().started(ServiceStatus.STARTING);
          const daemon$ = runner.runCommand('start', { mode: 'parallel', workspaces: [w], force: true }, [
            `--httpPort ${w.ports?.http.toString() || '3000'} --lambdaPort ${w.ports?.lambda.toString() || '4000'} --websocketPort ${w.ports?.websocket.toString() || '6000'}`,
          ]);
          const subscription = daemon$.subscribe({
            next: (evt) => {
              this._logger.debug({ evt: evt.type, workspace: w.name});
              this._events$.next({ ...evt, cmd: "start" });
              if (evt.type === RunCommandEventEnum.NODE_ERRORED) {
                this._logger.warn('Error starting', w.name);
                this.project.getWorkspace(w.name)?.updateStatus().started(ServiceStatus.CRASHED);
                this._targets.delete(w);
              } else if (evt.type === RunCommandEventEnum.NODE_PROCESSED) {
                this._logger.info('Successfully started', w.name);
                this.project.getWorkspace(w.name)?.updateStatus().started(ServiceStatus.RUNNING);
                this.project.getWorkspace(w.name)?.updateMetric().start({
                  finishedAt: new Date().toISOString(),
                  took: evt.result.overall,
                  fromCache: evt.result.fromCache,
                });
              }
            },
            error: (error) => {
              this._logger.error(error);
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
