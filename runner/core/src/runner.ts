import { Observable} from "rxjs";
import {
  RunCommandEvent,
} from "./process";
import {Project} from "./project";
import {Workspace} from "./workspace";
import {EventsLog, EventsLogger} from '@microlambda/logger';
import {checkWorkingDirectoryClean} from './remote-cache-utils';
import {getDefaultThreads} from '@microlambda/utils';
import {Scheduler} from "./scheduler";

export interface ICommonRunOptions {
  cmd: string;
  mode: 'parallel' | 'topological';
  args?: string[] | string | Map<string, string[] | string>;
  env?: Record<string, string> | Map<string, Record<string, string>>;
  force?: boolean;
  stdio?: 'pipe' | 'inherit';
  cachePrefix?: string;
}

export interface IRemoteCacheRunOptions {
  watch?: false;
  remoteCache?: {
    table: string;
    region: string;
    bucket: string;
  }
  affected?: string;
}

export interface IWatchRunOptions {
  watch?: boolean;
  debounce?: number;
  releasePorts?: Map<string, Array<number>>;
}

export interface  IParallelRunOptions extends ICommonRunOptions, IWatchRunOptions {
  mode: 'parallel';
  workspaces?: Workspace[];
}

export interface  IParallelRemoteCacheRunOptions extends ICommonRunOptions, IRemoteCacheRunOptions {
  mode: 'parallel';
  workspaces?: Workspace[];
}

export interface ITopologicalRunOptions extends ICommonRunOptions, IWatchRunOptions {
  mode: 'topological';
  to?: Workspace[];
}

export interface ITopologicalRemoteCacheRunOptions extends ICommonRunOptions, IRemoteCacheRunOptions {
  mode: 'topological';
  to?: Workspace[];
}

export const isUsingRemoteCache = (options: RunOptions): options is IParallelRemoteCacheRunOptions | ITopologicalRemoteCacheRunOptions => {
  return (options as IParallelRemoteCacheRunOptions).remoteCache != null;
}

export type RunOptions = IParallelRunOptions | ITopologicalRunOptions | IParallelRemoteCacheRunOptions | ITopologicalRemoteCacheRunOptions;

export const isTopological = (options: RunOptions): options is ITopologicalRunOptions | ITopologicalRemoteCacheRunOptions => options.mode === 'topological';

interface ICurrentExecution {
  options: RunOptions;
  execution$: Observable<RunCommandEvent>;
  scheduler: Scheduler;
  scope: Array<Workspace>;
}

export class Runner {
  private _logger: EventsLogger | undefined;
  private _currentExecution = new Map<string, ICurrentExecution>()

  constructor(
    private readonly _project: Project,
    private readonly _concurrency: number = getDefaultThreads(),
    readonly logger?: EventsLog,
  ) {
    this._logger = logger?.scope('runner-core/runner');
  }

  runCommand(options: RunOptions): Observable<RunCommandEvent> {
    const currentExecution = this._currentExecution.get(options.cmd)?.execution$;
    if (currentExecution) {
      return currentExecution;
    }
    if (isUsingRemoteCache(options) && options.remoteCache) {
      checkWorkingDirectoryClean(this._project.root);
      if (options.watch) {
        throw new Error('Cannot execute command in watch mode while using remote caching');
      }
    }
    const scope = (isTopological(options) ? options.to : options.workspaces) ?? [...this._project.workspaces.values()];
    const scheduler = new Scheduler(this._project, options, this._concurrency, this.logger);
    const execution$ = scheduler.execute();
    this._currentExecution.set(options.cmd, {
      execution$,
      scheduler,
      scope,
      options,
    });
    return execution$;
  }

  private _areInScope(cmd: string, workspaces: Workspace[]): { inside: Array<Workspace>, outside: Array<Workspace>, cmdExecution: ICurrentExecution } {
    const cmdExecution = this._currentExecution.get(cmd);
    const previousScope = cmdExecution?.scope;
    this._logger?.debug({ previousScope: previousScope?.map((w) => w.name) });
    if (!previousScope) {
      throw new Error('Error adding/removing targets: no current execution');
    }
    if (!cmdExecution.options.watch) {
      throw new Error('Error adding/removing targets: current execution is not in watch mode');
    }
    const inside: Workspace[] = []
    const outside: Workspace[] = []
    for (const workspace of workspaces) {
      const isAlreadyInScope = previousScope.some(w => w.name === workspace.name);
      if (isAlreadyInScope) inside.push(workspace);
      else outside.push(workspace);
    }
    return { inside, outside, cmdExecution };
  }

  addWorkspaces(cmd: string, workspaces: Workspace[]): void {
    const { outside, cmdExecution } = this._areInScope(cmd, workspaces);
    this._logger?.debug({ outside: outside.map((w) => w.name) });
    const toAdd = outside;
    if (toAdd.length) {
      const previousScope = cmdExecution.scope;
      cmdExecution.scope =  [...previousScope, ...toAdd];
      this._logger?.info('added: new scope', cmd, cmdExecution.scope.map((w) => w.name));
      cmdExecution.scheduler.scopeChanged(cmdExecution.scope);
    }
  }

  removeWorkspace(cmd: string, workspaces: Workspace[]): void {
    this._logger?.debug('Removing', workspaces.map((w) => w.name));
    const { inside, cmdExecution } = this._areInScope(cmd, workspaces);
    const toRemove = inside;
    if (toRemove.length) {
      const previousScope = cmdExecution.scope;
      const shouldBeKeptInScope = (workspace: Workspace): boolean => {
        return !toRemove.some((w) => w.name === workspace.name);
      }
      cmdExecution.scope = previousScope.filter(shouldBeKeptInScope);
      this._logger?.info('removed: new scope', cmd, cmdExecution.scope.map((w) => w.name));
      cmdExecution.scheduler.scopeChanged(cmdExecution.scope);
    }
  }
}
