import {map, mergeWith, Observable, tap} from 'rxjs';
import { EventsLog, EventsLogger } from '@microlambda/logger';
import { getDefaultThreads } from '@microlambda/utils';
import { Workspace } from './graph/workspace';
import { Project } from './graph/project';
import { RunCommandEvent, Runner } from '@microlambda/runner-core';

export type SchedulerEvent = RunCommandEvent & { cmd: 'start' | 'transpile' | 'build' };

export class Scheduler {
  private readonly _logger: EventsLogger;
  private readonly _concurrency: number;
  private readonly _runner: Runner;
  private _process: Observable<SchedulerEvent> | undefined;

  constructor(readonly project: Project, logger: EventsLog, concurrency?: number) {
    this._logger = logger.scope('core/scheduler');
    this._logger.debug('New recompilation scheduler instance');
    this._concurrency = concurrency || getDefaultThreads();
    this._runner = new Runner(this.project, this._concurrency, logger)
  }

  public startOne(service: Workspace): void {
    this._logger.info('Starting', service.name);
    this._runner.addWorkspaces('start', [service]);
  }

  public startAll(): void {
    this._runner.addWorkspaces('start', [...this.project.services.values()]);
  }

  public stopOne(service: Workspace): void {
    this._runner.removeWorkspace('start', [service]);
 }

  public gracefulShutdown(): void {
    this._runner.removeWorkspace('start', [...this.project.services.values()]);
  }

  public stopAll(): void {
    // Stop all running services
    return this.gracefulShutdown();
  }

  public restartOne(service: Workspace): void {
    this.stopOne(service);
    this.startOne(service);
  }

  public restartAll(): void {
    this.stopAll();
    this.startAll();
  }

  exec(initialScope: Workspace[], debounce: { transpile: number, build: number, start: number }): Observable<SchedulerEvent> {
    if (this._process) {
      throw new Error('A process is already running');
    }
    const initialTree = initialScope.map((service) => service.descendants.values()).flat();
    const transpile$: Observable<SchedulerEvent> = this._runner.runCommand({
      cmd: 'transpile',
      mode: 'parallel',
      workspaces: [...new Set(...initialTree)],
      watch: true,
      debounce: debounce.transpile,
    }).pipe(map((evt) => ({ ...evt, cmd: 'transpile' })));

    const build$: Observable<SchedulerEvent> = this._runner.runCommand({
      cmd: 'build',
      mode: 'topological',
      to: initialScope,
      watch: true,
      debounce: debounce.build,
    }).pipe(map((evt) => ({ ...evt, cmd: 'build' })));;

    const start$: Observable<SchedulerEvent> = this._runner.runCommand({
      cmd: 'build',
      mode: 'parallel',
      watch: true,
      workspaces: initialScope,
      debounce: debounce.start,
      args: this._startArgs,
      releasePorts: this._ports,
    }).pipe(map((evt) => ({ ...evt, cmd: 'start' })));
    this._process = transpile$.pipe(mergeWith(build$, start$));
    return this._process;
  }
  private get _startArgs(): Map<string, string[]> {
    const args = new Map();
    for (const service of this.project.services.values()) {
      if (service.ports) {
        args.set(service.name, [
          `--httpPort ${service.ports?.http.toString() || '3000'} --lambdaPort ${
            service.ports?.lambda.toString() || '4000'
          } --websocketPort ${service.ports?.websocket.toString() || '6000'} --reloadHandler`,
        ])
      }
    }
    return args;
  }

  private get _ports(): Map<string, number[]> {
    const args = new Map();
    for (const service of this.project.services.values()) {
      if (service.ports) {
        args.set(service.name, Object.values(service.ports));
      }
    }
    return args;
  }
}
