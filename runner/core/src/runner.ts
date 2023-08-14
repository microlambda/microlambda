/* eslint-disable no-console */
import {BehaviorSubject, concat, from, Observable, of, skip, Subject, Subscriber, Subscription} from "rxjs";
import {catchError, concatAll, concatMap, map, mergeAll, takeUntil} from "rxjs/operators";
import {
  IErrorInvalidatingCacheEvent,
  IProcessResult,
  IResolvedTarget,
  IRunCommandErrorEvent,
  RunCommandEvent,
  RunCommandEventEnum,
  Step
} from "./process";
import {Project} from "./project";
import {Workspace} from "./workspace";
import {OrderedTargets, TargetsResolver} from "./targets";
import {Watcher, WatchEvent} from "./watcher";
import {EventsLog, EventsLogger} from '@microlambda/logger';
import {checkWorkingDirectoryClean} from './remote-cache-utils';
import {getDefaultThreads} from '@microlambda/utils';
import {v4 as uuid} from 'uuid';
import {Scheduler} from "./scheduler";

export interface ICommonRunOptions {
  cmd: string;
  mode: 'parallel' | 'topological';
  args?: string[] | string;
  env?: {[key: string]: string};
  force?: boolean;
  stdio?: 'pipe' | 'inherit';
  cachePrefix?: string;
}

export interface IRemoteCacheRunOptions {
  watch?: false;
  remoteCache?: {
    region: string;
    bucket: string;
  }
  affected?: string;
}

export interface IWatchRunOptions {
  watch?: boolean;
  debounce?: number;
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

//type FailedExecution =  { status: 'ko', error: unknown, target: IResolvedTarget};
//type SucceededExecution = {status: 'ok', result: IProcessResult, target: IResolvedTarget };
//type CaughtProcessExecution =  SucceededExecution | FailedExecution;

// const isFailedExecution = (execution: CaughtProcessExecution): execution is FailedExecution => { return execution.status === 'ko' }

/*export const isRunCommandErroredEvent = (error: unknown): error is RunCommandEvent => {
  const _error = error as (IRunCommandErrorEvent | IErrorInvalidatingCacheEvent);
  return (_error.type === RunCommandEventEnum.ERROR_INVALIDATING_CACHE || _error.type === RunCommandEventEnum.NODE_ERRORED) && !!_error.workspace;
}*/

export type RunOptions = IParallelRunOptions | ITopologicalRunOptions | IParallelRemoteCacheRunOptions | ITopologicalRemoteCacheRunOptions;

export const isTopological = (options: RunOptions): options is ITopologicalRunOptions | ITopologicalRemoteCacheRunOptions => options.mode === 'topological';

interface IStepCompletedEvent {
  type: 'STEP_COMPLETED',
}

const isStepCompletedEvent = (evt: RunCommandEvent | IStepCompletedEvent): evt is IStepCompletedEvent => {
  return evt.type === 'STEP_COMPLETED';
}

interface ICurrentExecution {
  watch: boolean;
  currentScope$: BehaviorSubject<Array<Workspace>>;
}

interface IImpactedTargets  {
  toKill: Set<IResolvedTarget>;
  toStart: Set<IResolvedTarget>;
  mostEarlyStepImpactedIndex: number | undefined;
  impactedTargets: Set<IResolvedTarget>;
  mostEarlyStepImpacted: IResolvedTarget[] | undefined
}

interface IReschedulingContext {
  removedFromScope: IResolvedTarget[];
  addedInScope: IResolvedTarget[];
  sourceChanged: WatchEvent[];
}

export class Runner {
  //private _watchers = new Map<string, { watcher: Watcher, abort: Subject<void>}>();
  private _logger: EventsLogger | undefined;
  private _currentExecution: ICurrentExecution | undefined;

  constructor(
    private readonly _project: Project,
    private readonly _concurrency: number = getDefaultThreads(),
    readonly logger?: EventsLog,
  ) {
    this._logger = logger?.scope('runner-core/runner');
  }

  /*unwatch(cmd: string): void {
    this._logger?.debug('Un-watching command', cmd);
    this._watchers.get(cmd)?.watcher.unwatch();
    this._watchers.get(cmd)?.abort.next();
  }*/

  private get currentExecution(): ICurrentExecution {
    if (!this._currentExecution) {
      throw new Error('Assertion failed: no current execution');
    }
    return this._currentExecution;
  }

  runCommand(options: RunOptions): Observable<RunCommandEvent> {
    if (this._currentExecution) {
      throw new Error('This runner already have a current execution running');
    }
    const scope = (isTopological(options) ? options.to : options.workspaces) ?? [...this._project.workspaces.values()];
    this._currentExecution = { watch: options.watch ?? false, currentScope$: new BehaviorSubject<Array<Workspace>>(scope)};
    return new Observable((obs) => {
      if (isUsingRemoteCache(options) && options.remoteCache) {
        checkWorkingDirectoryClean(this._project.root);
      }
      this._logger?.info('Resolving for command', options.cmd);
      const targets = new TargetsResolver(this._project, this._logger?.logger);
      targets.resolve(options.cmd, options).then((targets) => {
        this._logger?.info('Targets resolved for command', options.cmd, targets.map(s => s.map(t => t.workspace.name)));
        obs.next({ type: RunCommandEventEnum.TARGETS_RESOLVED, targets: targets.flat() });
        if (!targets.length) {
          this._logger?.info('No eligible targets found for command', options.cmd)
          return obs.complete();
        }
        const scheduler = new Scheduler(targets, options, this._concurrency, this.logger);
        scheduler.execute().subscribe({
          next: (evt) => obs.next(evt),
          error: (err) => obs.error(err),
          complete: () => obs.complete()
        });
      });
    });
  }

  private _areInScope(workspaces: Workspace[]): { inside: Array<Workspace>, outside: Array<Workspace> } {
    const previousScope = this._currentExecution?.currentScope$.getValue();
    if (!previousScope) {
      throw new Error('Error adding/removing targets: no current execution');
    }
    if (!this._currentExecution?.watch) {
      throw new Error('Error adding/removing targets: current execution is not in watch mode');
    }
    const inside: Workspace[] = []
    const outside: Workspace[] = []
    for (const workspace of workspaces) {
      const isAlreadyInScope = previousScope.some(w => w.name === workspace.name);
      if (isAlreadyInScope) inside.push(workspace);
      else outside.push(workspace);
    }
    return { inside, outside };
  }

  addWorkspaces(workspaces: Workspace[]): void {
    const { outside } = this._areInScope(workspaces);
    const toAdd = outside;
    if (toAdd.length) {
      const previousScope = this.currentExecution.currentScope$.getValue();
      const newScope = [...previousScope, ...toAdd];
      this.currentExecution.currentScope$.next(newScope);
    }
  }

  removeWorkspace(workspaces: Workspace[]): void {
    //console.debug('Removing', workspaces.map((w) => w.name));
    const { inside } = this._areInScope(workspaces);
    const toRemove = inside;
    if (toRemove.length) {
      const previousScope = this.currentExecution.currentScope$.getValue();
      const shouldBeKeptInScope = (workspace: Workspace): boolean => {
        return !toRemove.some((w) => w.name === workspace.name);
      }
      const newScope = previousScope.filter(shouldBeKeptInScope);
      this.currentExecution.currentScope$.next(newScope);
    }
  }

  /*private _runAndWatch(options: IParallelRunOptions | ITopologicalRunOptions, _targets: OrderedTargets, obs: Subscriber<RunCommandEvent>): void {
    let targets = _targets;

    // tasks


    this._logger?.info('Running target', options.cmd, 'in watch mode');
    const initialTasksId = uuid();
    const initialTasks$ = this._scheduleTasks(options, targets);
    const activeTasks$ = new Map<string, Observable<RunCommandEvent | IStepCompletedEvent>>([[initialTasksId, initialTasks$]]);
    const activeSubscriptions$ = new Map<string, Subscription>();
    let watcher = new Watcher(targets, options.cmd, options.debounce, this._logger?.logger);
    const shouldAbort$ = new Subject<void>();
    const shouldReschedule$ = new Subject<IReschedulingContext>();
    let sourcesChange$ = watcher.watch();
    const scopeChanged$ = this.currentExecution.currentScope$.pipe(skip(1));
    this._watchers.set(options.cmd, { watcher, abort: shouldAbort$ });
    this._logger?.debug('Watching sources');
    let currentStep: IResolvedTarget[] | undefined;

    // let shouldLetFinishStepAndReschedule = false;
    // let areAllProcessed = false;
    const workspaceWithRunningProcesses = new Set<Workspace>();
    const workspaceProcessed = new Set<Workspace>();
    let resolvedImpactedTargets: IImpactedTargets | undefined;
    const killing$ = new Map<Workspace, Promise<void>>();
    //const killed = new Set<Workspace>();
    const stopWatching$ = new Subject<void>();

    stopWatching$.subscribe(() => {
      watcher.unwatch();
    });

    shouldAbort$.subscribe(() => {
      //console.debug('Aborting current tasks !');
      activeSubscriptions$.forEach((s) => s.unsubscribe());
      activeSubscriptions$.clear();
    })

    const onTasksEventsReceived = (taskId: string): { next: (evt: RunCommandEvent | IStepCompletedEvent) => void; error: (err: unknown) => void; complete: () => void; } => ({
      next: (evt: RunCommandEvent | IStepCompletedEvent): void => {
        switch (evt.type) {
          case RunCommandEventEnum.NODE_STARTED:
            currentStep = targets.find((step) => step.some((target) => target.workspace.name === evt.workspace.name));
            if (currentStep) {
              this._logger?.debug('Current step updated', targets.indexOf(currentStep));
            }
            workspaceWithRunningProcesses.add(evt.workspace);
            this._logger?.debug('Setting node as processing', evt.workspace.name);
            this._logger?.debug({ processing: Array.from(workspaceWithRunningProcesses).map((w) => w.name)});
            break;
          case RunCommandEventEnum.NODE_PROCESSED:
            //console.debug('Processed', evt.workspace.name);
          case RunCommandEventEnum.NODE_ERRORED:
            workspaceWithRunningProcesses.delete(evt.workspace);
            workspaceProcessed.add(evt.workspace);
            this._logger?.debug('Setting node as processed', evt.workspace.name);
            this._logger?.debug({
              processing: Array.from(workspaceWithRunningProcesses).map((w) => w.name),
              processed: Array.from(workspaceProcessed).map((w) => w.name)
            });
            break;
        }
        if (!isStepCompletedEvent(evt)) {
          // If step not finished, forward event (expect killed processes)
          /*if (evt.type === RunCommandEventEnum.NODE_PROCESSED) {
            console.log({
              w: evt.workspace.name,
              killing: [...killing$.keys()].map((w) => w.name),
              killed:  [...killed].map((w) => w.name),
            })
          }*/
          /*bs.next(evt);
          /*if (evt.type === RunCommandEventEnum.NODE_PROCESSED && (killing$.has(evt.workspace) || killed.has(evt.workspace))) {
            this._logger?.debug('Node killed not forwarding processed event', evt.workspace.name);
          } else {
            obs.next(evt);
          }*/
        /*} /*else if (shouldLetFinishStepAndReschedule) {
          // If step finished, and should abort/reschedule after completion, do it
          shouldLetFinishStepAndReschedule = false;
          // should reschedule, after having killed processed
          if (!resolvedImpactedTargets?.mostEarlyStepImpacted) {
            throw new Error('Assertion failed: most early impacted step not resolved');
          }
          const { mostEarlyStepImpacted, impactedTargets } = resolvedImpactedTargets;
          const newTasksId = uuid();
          const newTasks$ = this._rescheduleTasks(options, mostEarlyStepImpacted, impactedTargets, targets);
          activeTasks$.set(newTasksId, newTasks$);
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          executeTasks(newTasksId);
        }*/
/*
      },
      error: (err: unknown): void => {
        obs.error(err);
      },
      complete: (): void => {
        //console.debug('completed');
        activeTasks$.delete(taskId);
        this._logger?.debug('Current tasks executed watching for changes');
        // areAllProcessed = true;
      },
    });

    /*const onSourcesChanged = (changes: Array<WatchEvent>): void => {
      shouldReschedule$.next({
        sourceChanged: changes,
        addedInScope: [],
        removedFromScope: [],
      });
    }

    const resolveImpactedTargets = (changes: WatchEvent[]): IImpactedTargets => {
      this._logger?.debug('Sources changed', changes.map((c) => c.target.workspace.name));
      const toKill = new Set<IResolvedTarget>();
      const toStart = new Set<IResolvedTarget>();
      const impactedTargets = new Set<IResolvedTarget>();
      let mostEarlyStepImpacted: Step | undefined;
      let mostEarlyStepImpactedIndex: number | undefined;
      const impactedTargetsByStep = new Map<number, Array<IResolvedTarget>>();

      for (const change of changes) {
        const target = change.target;
        const workspace = target.workspace;
        const isTarget = targets.flat().some((t) => t.workspace.name === workspace.name);
        if (!isTarget) {
          continue;
        }
        const isProcessing = workspaceWithRunningProcesses.has(change.target.workspace);
        const isProcessed = workspaceProcessed.has(change.target.workspace);

        // Notify subscribers that files have changed
        obs.next({ type: RunCommandEventEnum.SOURCES_CHANGED, ...change});

        // In the first iteration we resolve the most early impacted step
        // And group impacted workspaces by step number
        const impactedStep = targets.find((step) => step.some((t) => t.workspace.name === workspace.name));
        if (impactedStep && (isProcessing || isProcessed)) {
          const impactedStepNumber = targets.indexOf(impactedStep);
          if (!mostEarlyStepImpactedIndex || impactedStepNumber < mostEarlyStepImpactedIndex) {
            mostEarlyStepImpactedIndex = impactedStepNumber;
            mostEarlyStepImpacted = impactedStep;
            this._logger?.debug('Most early step impacted step updated', mostEarlyStepImpactedIndex);
          }
          if (impactedTargetsByStep.has(impactedStepNumber)) {
            impactedTargetsByStep.get(impactedStepNumber)?.push(target);
          } else {
            impactedTargetsByStep.set(impactedStepNumber, [target]);
          }
        }
      }

      const isInCurrentStep = isEqualsCurrentStep(mostEarlyStepImpacted);
      const isStrictlyBeforeCurrentStep = isBeforeCurrentStep(mostEarlyStepImpacted);
      const isAfterCurrentStep = !isInCurrentStep && !isStrictlyBeforeCurrentStep;
      /*console.debug({
        currentStep: currentStep ? targets.indexOf(currentStep) : null,
        mostEarlyStepImpactedIndex, isInCurrentStep,
        isStrictlyBeforeCurrentStep, isAfterCurrentStep,
        shouldReprocess: mostEarlyStepImpactedIndex != null && mostEarlyStepImpacted && !isAfterCurrentStep,
      });*/
      /*if (mostEarlyStepImpactedIndex != null && mostEarlyStepImpacted && !isAfterCurrentStep) {
        this._logger?.debug(options.cmd, 'Impacted step is same than current step. Should abort after current step execution');
        for (const target of currentStep ?? []) {
          const isProcessing = workspaceWithRunningProcesses.has(target.workspace);
          const isProcessed = workspaceProcessed.has(target.workspace);
          const isDaemon = target.workspace.isDaemon(options.cmd);
          const isRunning = isProcessing || isDaemon;
          const isImpacted = changes.some((c) => c.target.workspace.name === target.workspace.name);
          const isTarget = targets.some((step) => step.filter((t) => t.affected && t.hasCommand).some((t) => t.workspace.name === target.workspace.name));
          const shouldKill = isRunning && (isImpacted || isStrictlyBeforeCurrentStep) && isTarget;
          if (shouldKill) {
            toKill.add(target);
          }
          if (isImpacted && (shouldKill || isProcessed)) {
            toStart.add(target);
          }
        }
        impactedTargetsByStep.get(mostEarlyStepImpactedIndex)?.forEach((w) => impactedTargets.add(w));
        this._logger?.debug('to kill', [...toKill].map(t => t.workspace.name));
      }
      return { toKill, mostEarlyStepImpacted, mostEarlyStepImpactedIndex, impactedTargets, toStart }
    }

    const executeTasks = (tasksId: string): void => {
      const tasks$ = activeTasks$.get(tasksId);
      if (!tasks$) {
        throw new Error('No tasks to execute');
      }
        // Clear all re-scheduled workspaces but not others
      // areAllProcessed = false;
      //killed.clear();
      //killing$.clear();
      this._logger?.debug('New current tasks execution');
      this._logger?.debug('Reset impacted targets');
      this._logger?.debug('Reset killed targets');
      this._logger?.debug('Removing impacted targets from processed ', {
        processed: Array.from(workspaceProcessed).map((w) => w.name)
      });
      //console.debug('Executing task', tasksId);
      activeSubscriptions$.set(tasksId ,tasks$.subscribe(onTasksEventsReceived(tasksId)));
    }

    const killWorkspaces = (workspaces: Workspace[]): void => {
      for (const workspace of workspaces) {
        this._logger?.info('Kill impacted processes if running', workspace.name);
        const isDaemon = workspace.isDaemon(options.cmd);
        if (workspaceWithRunningProcesses.has(workspace) || isDaemon) {
          this._logger?.debug('Asked to kill', workspace.name);
          this._logger?.info('Kill impacted processes', workspace.name);
          const kill$ = workspace.kill({ cmd: options.cmd, _workspace: workspace.name }).then(() => {
            this._logger?.debug('Killed', workspace.name);
            workspaceWithRunningProcesses.delete(workspace);
            workspaceProcessed.delete(workspace);
            //console.log('Killed', workspace.name);
            killing$.delete(workspace);
            // killed.add(workspace);
            obs.next({ type: RunCommandEventEnum.NODE_INTERRUPTED, workspace });
          });
          //console.log('Killing', workspace.name);
          killing$.set(workspace, kill$);
        }
      }
    };

    scopeChanged$.subscribe((newScope) => {
      const targetsResolver = new TargetsResolver(this._project, this._logger?.logger);
      const newOptions = { ...options };
      if (isTopological(newOptions)) {
        newOptions.to = [...newScope];
      } else {
        newOptions.workspaces = [...newScope];
      }

      targetsResolver.resolve(newOptions.cmd, newOptions).then((_newTargets) => {
        const previousTargets = targets.flat();
        const newTargets = _newTargets.flat();
        //console.log('Targets resolved', newTargets.map((t) => t.workspace.name));
        obs.next({ type: RunCommandEventEnum.TARGETS_RESOLVED, targets: newTargets });

        const includesWorkspace = (targets: IResolvedTarget[], workspace: Workspace): boolean => {
          return targets.some((t) => t.workspace.name === workspace.name);
        }
        const addedInScope = newTargets.filter((nt) => !includesWorkspace(previousTargets, nt.workspace));
        const removedFromScope = previousTargets.filter((pt) => !includesWorkspace(newTargets, pt.workspace));

        targets = _newTargets;

        stopWatching$.next();
        //console.debug('watching', _newTargets.flat().map((t) => t.workspace.name));
        watcher = new Watcher(_newTargets, options.cmd, options.debounce, this._logger?.logger);
        sourcesChange$ = watcher.watch();
        sourcesChange$.pipe(takeUntil(stopWatching$)).subscribe(onSourcesChanged.bind(this));
        shouldReschedule$.next({
          addedInScope,
          removedFromScope,
          sourceChanged: [],
        })
      });
    });

    shouldReschedule$.subscribe((context) => {
      const { toKill, toStart, mostEarlyStepImpacted, impactedTargets } = resolveImpactedTargets(context.sourceChanged);
      //// If parallel
      if (options.mode === 'parallel') {
        // Kill targets that have been impacted by a source change and targets removed from scope
        //console.debug('Killing', [...toKill, ...context.removedFromScope].map((t) => t.workspace.name));
        killWorkspaces([...toKill, ...context.removedFromScope].map((t) => t.workspace));
        // Restart targets that have been impacted by a source change and start targets newly added in scope
        Promise.all(killing$.values()).then(() => {
          //console.debug('Killed all processes');
          const newTargets = [...toStart, ...context.addedInScope];
          //console.debug('Should run new targets', newTargets.map((t) => t.workspace.name));
          if (newTargets.length) {
            const newTasks$ = this._scheduleTasks(options, [newTargets]);
            const newTasksId = uuid();
            activeTasks$.set(newTasksId, newTasks$);
            executeTasks(newTasksId);
          }
        });
      } else {
        // If topological and before
        if (isBeforeCurrentStep(mostEarlyStepImpacted)) {
          // Abort current execution
          shouldAbort$.next();
          // Kill all running targets in current step and targets removed from scope
          killWorkspaces([...toKill, ...context.removedFromScope].map((t) => t.workspace));
          Promise.all(killing$.values()).then(() => {
            // if added targets
            if (context.addedInScope.length) {
              // Compute new graph with added targets
              const newTasks$ = this._scheduleTasks(options, targets);
              // Re-run everything
              const newTasksId = uuid();
              activeTasks$.set(newTasksId, newTasks$);
              executeTasks(newTasksId);
            } else if (mostEarlyStepImpacted) {
              // Reschedule from most early impacted step and run
              const newTasks$ = this._rescheduleTasks(options, mostEarlyStepImpacted, impactedTargets, targets);
              const newTasksId = uuid();
              activeTasks$.set(newTasksId, newTasks$);
              executeTasks(newTasksId);
            }
          });
        //// If topological and current
        } else if (isEqualsCurrentStep(mostEarlyStepImpacted)) {
          // Kill targets that have been impacted by a source change
          // Kill target removed from scope
          killWorkspaces([...toKill, ...context.removedFromScope].map((t) => t.workspace));
          // Invalidate cache


          Promise.all(killing$.values()).then(() => {
            // if added target
            if (context.addedInScope.length) {
              // Abort current execution
              shouldAbort$.next();
              // Compute new graph with added targets
              const newTasks$ = this._scheduleTasks(options, targets);
              // Re-run everything
              const newTasksId = uuid();
              activeTasks$.set(newTasksId, newTasks$);
              executeTasks(newTasksId);
            } else if (areAllProcessed && mostEarlyStepImpacted) {

              const newTasks$ =  this._rescheduleTasks(options, mostEarlyStepImpacted, impactedTargets, targets);
              const newTasksId = uuid();
              activeTasks$.set(newTasksId, newTasks$);
              executeTasks(newTasksId);
            } else if (mostEarlyStepImpacted) {
              shouldLetFinishStepAndReschedule = true;
            }
          });
        }
      }
    });

    sourcesChange$.pipe(takeUntil(stopWatching$)).subscribe(onSourcesChanged.bind(this));

    executeTasks(initialTasksId);
  }*/
}
