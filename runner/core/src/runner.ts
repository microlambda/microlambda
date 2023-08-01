import {concat, from, Observable, of, Subject, Subscriber} from "rxjs";
import { catchError, concatAll, concatMap, map, mergeAll, takeUntil } from "rxjs/operators";
import {
  IErrorInvalidatingCacheEvent,
  IProcessResult,
  IResolvedTarget,
  IRunCommandErrorEvent,
  RunCommandEvent,
  RunCommandEventEnum, Step
} from "./process";
import { Project } from "./project";
import { Workspace } from "./workspace";
import { OrderedTargets, TargetsResolver } from "./targets";
import { Watcher } from "./watcher";
import { EventsLog, EventsLogger } from '@microlambda/logger';
import { checkWorkingDirectoryClean } from './remote-cache-utils';
import { getDefaultThreads } from '@microlambda/utils';

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

type FailedExecution =  { status: 'ko', error: unknown, target: IResolvedTarget};
type SucceededExecution = {status: 'ok', result: IProcessResult, target: IResolvedTarget };
type CaughtProcessExecution =  SucceededExecution | FailedExecution;

const isFailedExecution = (execution: CaughtProcessExecution): execution is FailedExecution => { return execution.status === 'ko' }

const isRunCommandErroredEvent = (error: unknown): error is RunCommandEvent => {
  const _error = error as (IRunCommandErrorEvent | IErrorInvalidatingCacheEvent);
  return (_error.type === RunCommandEventEnum.ERROR_INVALIDATING_CACHE || _error.type === RunCommandEventEnum.NODE_ERRORED) && !!_error.workspace;
}

export type RunOptions = IParallelRunOptions | ITopologicalRunOptions | IParallelRemoteCacheRunOptions | ITopologicalRemoteCacheRunOptions;

export const isTopological = (options: RunOptions): options is ITopologicalRunOptions | ITopologicalRemoteCacheRunOptions => options.mode === 'topological';

interface IStepCompletedEvent {
  type: 'STEP_COMPLETED',
}

const isStepCompletedEvent = (evt: RunCommandEvent | IStepCompletedEvent): evt is IStepCompletedEvent => {
  return evt.type === 'STEP_COMPLETED';
}

export class Runner {
  private _watchers = new Map<string, { watcher: Watcher, abort: Subject<void>}>();
  private _logger: EventsLogger | undefined;

  constructor(
    private readonly _project: Project,
    private readonly _concurrency: number = getDefaultThreads(),
    readonly logger?: EventsLog,
  ) {
    this._logger = logger?.scope('runner-core/runner');
  }

  private _scheduleTasks(options: RunOptions, targets: OrderedTargets): Observable<RunCommandEvent | IStepCompletedEvent> {
    this._logger?.debug('Schedule tasks', { cmd: options.cmd });
    const steps$ = targets.map((step) => this._runStep(options, step, targets));
    return from(steps$).pipe(concatAll());
  }

  private _rescheduleTasks(
    options: RunOptions,
    fromStep: IResolvedTarget[],
    impactedTargets: Set<Workspace>,
    targets: OrderedTargets,
  ): Observable<RunCommandEvent | IStepCompletedEvent> {
    this._logger?.debug('Rescheduling from step', targets.indexOf(fromStep));
    this._logger?.debug('Rescheduling', options.cmd, targets
      .filter((step) => {
        return targets.indexOf(step) >= targets.indexOf(fromStep);
      }).map((step) => {
        if (targets.indexOf(step) === targets.indexOf(fromStep)) {
          return step.filter((t) => impactedTargets.has(t.workspace)).map((t) => t.workspace.name);
        }
        return step.map((t) => t.workspace.name);
      }));
    const subsequentSteps$ = targets
      .filter((step) => {
        return targets.indexOf(step) >= targets.indexOf(fromStep);
      })
      .map((step) => {
        this._logger?.debug('Scheduling step', targets.indexOf(step));
        if (targets.indexOf(step) === targets.indexOf(fromStep)) {
          this._logger?.debug('Ignoring non-impacted targets, impacted targets are', Array.from(impactedTargets).map(w => w.name));
          return this._runStep(options, step, targets, impactedTargets);
        }
        return this._runStep(options, step, targets);
      });
    return from(subsequentSteps$).pipe(concatAll());
  }

  unwatch(cmd: string): void {
    this._logger?.debug('Un-watching command', cmd);
    this._watchers.get(cmd)?.watcher.unwatch();
    this._watchers.get(cmd)?.abort.next();
  }

  runCommand(options: RunOptions): Observable<RunCommandEvent> {
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
        if (!options.watch) {
          const tasks$ = this._scheduleTasks(options, targets);
          this._logger?.info('Tasks scheduled for command', options.cmd)
          tasks$.subscribe({
            next: (evt) => {
              if (!isStepCompletedEvent(evt)) {
                obs.next(evt);
              }
            },
            error: (err) => obs.error(err),
            complete: () => obs.complete()
          })
        } else {
          this._runAndWatch(options, targets, obs);
        }
      });
    });
  }

  private _runAndWatch(options: IParallelRunOptions | ITopologicalRunOptions, targets: OrderedTargets, obs: Subscriber<RunCommandEvent>): void {
    this._logger?.info('Running target', options.cmd, 'in watch mode');
    let currentTasks$ = this._scheduleTasks(options, targets);
    const watcher = new Watcher(targets, options.cmd, options.debounce, this._logger?.logger);
    const shouldAbort$ = new Subject<void>();
    const shouldReschedule$ = new Subject<Step>();
    const shouldKill$ = new Subject<Array<Workspace>>();
    const sourcesChange$ = watcher.watch();
    this._watchers.set(options.cmd, { watcher, abort: shouldAbort$ });
    this._logger?.debug('Watching sources');
    let currentStep: IResolvedTarget[] | undefined;
    const isBeforeCurrentStep = (impactedStep: IResolvedTarget[] | undefined): boolean => {
      if(!currentStep || !impactedStep) {
        return false;
      }
      return targets.indexOf(impactedStep) < targets.indexOf(currentStep);
    }
    const isEqualsCurrentStep = (impactedStep: IResolvedTarget[] | undefined): boolean => {
      if(!currentStep || !impactedStep) {
        return false;
      }
      return targets.indexOf(impactedStep) === targets.indexOf(currentStep);
    }
    let shouldLetFinishStepAndAbort = false;
    let areAllProcessed = false;
    const _workspaceWithRunningProcesses = new Set<Workspace>();
    const workspaceProcessed = new Set<Workspace>();
    const impactedTargets = new Set<Workspace>();
    const killing$ = new Map<Workspace, Promise<void>>();
    const killed = new Set<Workspace>();
    let mostEarlyStepImpacted: Step | undefined;
    let mostEarlyStepImpactedIndex: number | undefined;

    const executeCurrentTasks = (): void => {
      // Clear all re-scheduled workspaces but not others
      areAllProcessed = false;
      shouldLetFinishStepAndAbort = false;
      impactedTargets.forEach((w) => {
        workspaceProcessed.delete(w)
      });
      impactedTargets.clear();
      killed.clear();
      killing$.clear();
      this._logger?.debug('New current tasks execution');
      this._logger?.debug('Reset impacted targets');
      this._logger?.debug('Reset killed targets');
      this._logger?.debug('Removing impacted targets from processed ', {
        processed: Array.from(workspaceProcessed).map((w) => w.name)
      });
      console.debug('Executing current task');
      currentTasks$.pipe(takeUntil(shouldAbort$)).subscribe({
        next: (evt) => {
          switch (evt.type) {
            case RunCommandEventEnum.NODE_STARTED:
              currentStep = targets.find((step) => step.some((target) => target.workspace.name === evt.workspace.name));
              if (currentStep) {
                this._logger?.debug('Current step updated', targets.indexOf(currentStep));
              }
              _workspaceWithRunningProcesses.add(evt.workspace);
              this._logger?.debug('Setting node as processing', evt.workspace.name);
              this._logger?.debug({ processing: Array.from(_workspaceWithRunningProcesses).map((w) => w.name)});
              break;
            case RunCommandEventEnum.NODE_PROCESSED:
            case RunCommandEventEnum.NODE_ERRORED:
              _workspaceWithRunningProcesses.delete(evt.workspace);
              workspaceProcessed.add(evt.workspace);
              this._logger?.debug('Setting node as processed', evt.workspace.name);
              this._logger?.debug({
                processing: Array.from(_workspaceWithRunningProcesses).map((w) => w.name),
                processed: Array.from(workspaceProcessed).map((w) => w.name)
              });
              break;
          }
          if (!isStepCompletedEvent(evt)) {
            // If step not finished, forward event (expect killed processes)
            if (evt.type === RunCommandEventEnum.NODE_PROCESSED && killing$.has(evt.workspace)) {
              this._logger?.debug('Node killed not forwarding processed event', evt.workspace.name);
            } else {
              obs.next(evt);
            }
          } else if (shouldLetFinishStepAndAbort) {
            // If step finished, and should abort/reschedule after completion, do it
            shouldLetFinishStepAndAbort = false;
            // should reschedule, after having killed processed
            if (!mostEarlyStepImpacted) {
              throw new Error('Assertion failed: most early impacted step not resolved');
            }
            shouldReschedule$.next(mostEarlyStepImpacted);
          }
        },
        error: (err) => {
          obs.error(err);
        },
        complete: () => {
          this._logger?.debug('Current tasks executed watching for changes');
          areAllProcessed = true;
        },
      });
    }

    shouldReschedule$.subscribe((fromStep) => {
      shouldAbort$.next();
      this._logger?.debug('Interruption has been received in previous step, re-scheduling ');
      Promise.all(killing$.values()).then(() => {
        currentTasks$ = this._rescheduleTasks(options, fromStep, impactedTargets, targets);
        this._logger?.debug('Current tasks updated');
        console.debug('All process killed rescheduling')
        executeCurrentTasks();
      });
    });

    shouldKill$.subscribe((workspaces) => {
      for (const workspace of workspaces) {
        this._logger?.info('Kill impacted processes if running', workspace.name);
        const isDaemon = workspace.isDaemon(options.cmd);
        if (_workspaceWithRunningProcesses.has(workspace) || isDaemon) {
          console.debug('Asked to kill', workspace.name);
          this._logger?.info('Kill impacted processes', workspace.name);
          const kill$ = workspace.kill({ cmd: options.cmd, _workspace: workspace.name }).then(() => {
            console.debug('Killed', workspace.name);
            _workspaceWithRunningProcesses.delete(workspace);
            workspaceProcessed.delete(workspace);
            killed.add(workspace);
            obs.next({ type: RunCommandEventEnum.NODE_INTERRUPTED, workspace });
          });
          killing$.set(workspace, kill$);
        }
      }
      if (!shouldLetFinishStepAndAbort || areAllProcessed) {
        console.debug('Impacted step is not current step, or all node are already processed: rescheduling immediately');
        this._logger?.debug('Impacted step is not current step, or all node are already processed: rescheduling immediately');
        if (!mostEarlyStepImpacted) {
          throw new Error('Assertion failed: most early impacted step not resolved');
        }
        shouldReschedule$.next(mostEarlyStepImpacted);
      }
    });

    sourcesChange$.subscribe((changes) => {
      console.debug('Sources changed', changes.map((c) => c.target.workspace.name));
      const toKill = new Set<Workspace>();
      const impactedTargetsByStep = new Map<number, Array<Workspace>>();

      for (const change of changes) {
        const workspace = change.target.workspace;

        const isProcessing = _workspaceWithRunningProcesses.has(change.target.workspace);
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
            impactedTargetsByStep.get(impactedStepNumber)?.push(workspace);
          } else {
            impactedTargetsByStep.set(impactedStepNumber, [workspace]);
          }
        }
      }

      const isInCurrentStep = isEqualsCurrentStep(mostEarlyStepImpacted);
      const isBeforeCurrentSTep = isBeforeCurrentStep(mostEarlyStepImpacted);
      const isAfterCurrentStep = !isInCurrentStep && !isBeforeCurrentSTep;
      console.debug({mostEarlyStepImpactedIndex, isInCurrentStep, isBeforeCurrentStep })

      if (mostEarlyStepImpactedIndex != null && mostEarlyStepImpacted && !isAfterCurrentStep) {
        this._logger?.debug(options.cmd, 'Impacted step is same than current step. Should abort after current step execution');
        shouldLetFinishStepAndAbort = isEqualsCurrentStep(mostEarlyStepImpacted);
        for (const target of currentStep ?? []) {
          const isProcessing = _workspaceWithRunningProcesses.has(target.workspace);
          const isDaemon = target.workspace.isDaemon(options.cmd);
          const isRunning = isProcessing || isDaemon;
          const isImpacted = changes.some((c) => c.target.workspace.name === target.workspace.name);
          const isTarget = targets.some((step) => step.filter((t) => t.affected && t.hasCommand).some((t) => t.workspace.name === target.workspace.name));
          if (isRunning && (isImpacted || isBeforeCurrentSTep) && isTarget) {
            toKill.add(target.workspace);
          }
        }
        impactedTargetsByStep.get(mostEarlyStepImpactedIndex)?.forEach((w) => impactedTargets.add(w));
        console.debug('to kill', [...toKill].map(w => w.name));
        shouldKill$.next([...toKill]);
      }
    });
    executeCurrentTasks();
  }

  private _runStep(
    options: RunOptions,
    step: IResolvedTarget[],
    targets: OrderedTargets,
    only?: Set<Workspace>,
  ): Observable<RunCommandEvent | IStepCompletedEvent> {
    const executions = new Set<CaughtProcessExecution>();
    this._logger?.info('Preparing step', targets.indexOf(step), { cmd: options.cmd });
    const tasks$ = step
      .filter((w) => !only || only.has(w.workspace))
      .map((w) => this._runForWorkspace(options, executions, w));
    const step$ = from(tasks$).pipe(
      mergeAll(this._concurrency),
    );
    return new Observable<RunCommandEvent | IStepCompletedEvent>((obs) => {
      this._logger?.info('Running step', targets.indexOf(step), { cmd: options.cmd, nodes: step.map((t) => t.workspace.name) });
      const resolveInvalidations$ = (): Observable<RunCommandEvent> => {
        // When execution step is completed or errored, perform required cache invalidations
        // Invalidate cache of every errored nodes
        this._logger?.info('Resolving invalidations');
        const invalidations$: Array<Observable<RunCommandEvent>> = [];
        if (!isUsingRemoteCache(options)) {
          let hasAtLeastOneError = false;
          let isCachedInvalidated = false;
          let current: IResolvedTarget | null = null;
          for (const execution of executions) {
            current = execution.target;
            this._logger?.info('Execution status', { cmd: options.cmd, workspace: execution.target.workspace.name, status: execution.status });
            if (isFailedExecution(execution)) {
              this._logger?.info('Execution failed, invalidating cache', { cmd: options.cmd, workspace: execution.target.workspace.name })
              hasAtLeastOneError = true;
              invalidations$.push(Runner._invalidateLocalCache(execution.target.workspace, options.cmd));
            } else if (!execution.result.fromCache) {
              this._logger?.info('Cache has been invalidated during execution', { cmd: options.cmd, workspace: execution.target.workspace.name });
              isCachedInvalidated = true;
            }
          }
          // In topological mode, if an error happened during the step
          // or a cache has been invalidated all ancestors cache.
          if (options.mode === 'topological' && (hasAtLeastOneError || isCachedInvalidated) && current) {
            invalidations$.push(Runner._invalidateSubsequentWorkspaceLocalCache(targets, current, options.cmd));
          }
        }
        return from(invalidations$).pipe(concatAll())
      }
      step$.subscribe({
        next: (evt) => {
          this._logger?.info('Forwarding run command event', { cmd: options.cmd, type: evt.type, workspace: (evt as { workspace: { name: string }})?.workspace?.name });
          obs.next(evt);
        },
        error: (err) => {
          this._logger?.info('Error received', { cmd: options.cmd, err });
          if (isRunCommandErroredEvent(err)) {
            this._logger?.info('Is node errored event', { cmd: options.cmd });
            obs.next(err);
          }
          this._logger?.warn('Unexpected error received during step execution', { cmd: options.cmd, err });
          resolveInvalidations$().subscribe({
            next: (next) => obs.next(next),
            error: (error) => {
              if (isRunCommandErroredEvent(error)) {
                obs.next(error);
              }
              obs.error(error);
            },
            complete: () => obs.error(err)
          });
        },
        complete: () => {
          this._logger?.info('Step execution completed', { cmd: options.cmd, step: targets.indexOf(step) })
          resolveInvalidations$().subscribe({
            next: (next) => obs.next(next),
            error: (error) => {
              if (isRunCommandErroredEvent(error)) {
                obs.next(error);
              }
              obs.error(error);
            },
            complete: () => {
              obs.next({ type: "STEP_COMPLETED" });
              obs.complete();
            }
          });
        }
      })
    })
  }

  private _runForWorkspace(
    options: RunOptions,
    executions: Set<CaughtProcessExecution>,
    target: IResolvedTarget,
  ): Observable<RunCommandEvent> {
    if (target.affected && target.hasCommand) {
      const started$: Observable<RunCommandEvent>  = of({ type: RunCommandEventEnum.NODE_STARTED, workspace: target.workspace });
      const execute$: Observable<RunCommandEvent> = this._executeCommandCatchingErrors(options, target).pipe(
        concatMap((result) => this._mapToRunCommandEvents(options, executions, result, target)),
      );
      return concat(
        started$,
        execute$,
      );
    }
    return of({ type: RunCommandEventEnum.NODE_SKIPPED, ...target });
  }

  private _executeCommandCatchingErrors(
    options: RunOptions,
    target: IResolvedTarget,
  ) : Observable<CaughtProcessExecution>{
    this._logger?.info('Preparing command', {cmd: options.cmd, workspace: target.workspace.name});
    const command$ = target.workspace.run(options, target.workspace.name);
    return command$.pipe(
      map((result) => ({ status: 'ok' as const, result, target })),
      catchError((error) => of({ status: 'ko' as const, error, target })),
    );
  }

  private _mapToRunCommandEvents(
    options: RunOptions,
    executions: Set<CaughtProcessExecution>,
    execution: CaughtProcessExecution,
    target: IResolvedTarget,
  ): Observable<RunCommandEvent> {
    return new Observable<RunCommandEvent>((obs) => {
      executions.add(execution);
      const workspace = target.workspace;
      this._logger?.info('Mapping events for', { workspace: workspace.name, cmd: options.cmd });
      if (execution.status === 'ok') {
        const result = execution.result;
        this._logger?.info('Execution success, sending node processed event', { workspace: workspace.name, cmd: options.cmd });
        obs.next({ type: RunCommandEventEnum.NODE_PROCESSED, result, workspace: workspace });
        obs.complete();
      } else  if (options.mode === 'topological' && !options.watch) {
        this._logger?.info('Execution errored in topological mode, sending node errored event and aborting', { workspace: workspace.name, cmd: options.cmd });
        obs.error({ type: RunCommandEventEnum.NODE_ERRORED, error: execution.error, workspace });
        obs.complete();
      } else {
        this._logger?.info('Execution errored in parallel mode, sending node errored event and continuing', { workspace: workspace.name, cmd: options.cmd });
        obs.next({ type: RunCommandEventEnum.NODE_ERRORED, error: execution.error, workspace });
        obs.complete();
      }
    });
  }

  private static _invalidateLocalCache(workspace: Workspace, cmd: string): Observable<RunCommandEvent> {
    return new Observable<RunCommandEvent>((obs) => {
      workspace.invalidateLocalCache(cmd)
        .then(() => obs.next({ type: RunCommandEventEnum.CACHE_INVALIDATED, workspace }))
        .catch((error) => obs.error({ type: RunCommandEventEnum.ERROR_INVALIDATING_CACHE, workspace, error}))
        .finally(() => obs.complete());
    });
  }

  private static _invalidateSubsequentWorkspaceLocalCache(targets: IResolvedTarget[][], current: IResolvedTarget, cmd: string): Observable<RunCommandEvent> {
    const invalidate$: Array<Observable<RunCommandEvent>> = [];
    let isAfterCurrent = false;
    for (const step of targets) {
      if (isAfterCurrent) {
        invalidate$.push(...step.map((t) => Runner._invalidateLocalCache(t.workspace, cmd)));
      }
      if (step.includes(current)) {
        isAfterCurrent = true;
      }
    }
    return from(invalidate$).pipe(mergeAll());
  }
}
