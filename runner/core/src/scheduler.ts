import {concat, Observable, of, Subject, Subscriber} from "rxjs";
import {
  IProcessResult,
  IResolvedTarget,
  isNodeErroredEvent,
  isNodeSucceededEvent,
  ISourceChangedEvent,
  isSourceChangedEvent,
  RunCommandEvent,
  RunCommandEventEnum,
  Step
} from "./process";
import {OrderedTargets, TargetsResolver} from "./targets";
import {isTopological, RunOptions} from "./runner";
import {catchError, map, takeUntil} from "rxjs/operators";
import {EventsLog, EventsLogger} from "@microlambda/logger";
import {Workspace} from "./workspace";
import {Watcher, WatchEvent} from "./watcher";
import {Project} from "./project";

interface ITask {
  type: 'kill' | 'invalidate' | 'run';
  target: IResolvedTarget;
  operation$: Observable<RunCommandEvent>;
}

interface IImpactedTargets  {
  toKill: Set<IResolvedTarget>;
  toStart: Array<IResolvedTarget>;
  mostEarlyStepImpactedIndex: number | undefined;
  mostEarlyStepImpacted: IResolvedTarget[] | undefined;
  toInvalidate: ISourceChangedEvent[];
}

interface IReschedulingContext {
  removedFromScope: IResolvedTarget[];
  addedInScope: IResolvedTarget[];
  sourceChanged: WatchEvent[];
  previousTargets: OrderedTargets;
}

type FailedExecution =  { status: 'ko', error: unknown, target: IResolvedTarget};
type SucceededExecution = {status: 'ok', result: IProcessResult, target: IResolvedTarget };
type CaughtProcessExecution =  SucceededExecution | FailedExecution;

/**
 * @class Scheduler
 * Run a "target" (i.e. one or many commands) across workspaces.
 */
export class Scheduler {
  private _tasks$: ITask[] = [];
  private _targets: OrderedTargets = [];

  private _obs: Subscriber<RunCommandEvent> | undefined;
  private _logger: EventsLogger | undefined;
  private _runningTasks = 0;
  private _completedTasks = 0;
  private _currentTaskIndex = -1;
  private _currentStepIndex = -1;
  private _currentStep = new Map<string, 'queued' | 'processed' | 'processing' | 'errored'>();

  private _watcher: Watcher | undefined;
  private _sourcesChanged$: Observable<Array<WatchEvent>> | undefined;
  private _scopeChanged$ = new Subject<void>();
  private _pendingInvalidations = new Set<string>();
  private _alreadyInvalidated = new Set<string>();
  private _killing$ = new Map<string, Promise<void>>();
  private _reschedulingFromStep: number | undefined;
  private _reschedulingAll = false;
  private _execution: Observable<RunCommandEvent> | undefined;

  private get obs(): Subscriber<RunCommandEvent> {
    if (!this._obs) {
      throw new Error('Assertion failed: no execution in progress');
    }
    return  this._obs;
  }

  constructor(
    private readonly _project: Project,
    private _options: RunOptions,
    readonly concurrency: number,
    readonly logger?: EventsLog,
  ) {
    this._logger = logger?.scope('runner-core/scheduler');
  }

  get execution(): Observable<RunCommandEvent> | undefined {
    return this._execution;
  }

  execute(): Observable<RunCommandEvent> {
    if (!this._execution) {
      this._execution = new Observable((obs) => {
        this._obs = obs;
        const targets = new TargetsResolver(this._project, this._logger?.logger);
        targets.resolve(this._options.cmd, this._options).then((initialTargets) => {
          this._logger?.info('Targets resolved for command', this._options.cmd, initialTargets.map(s => s.map(t => t.workspace.name)));
          obs.next({ type: RunCommandEventEnum.TARGETS_RESOLVED, targets: initialTargets.flat() });
          if (!initialTargets.length && !this._options.watch) {
            this._logger?.info('No eligible targets found for command', this._options.cmd)
            return obs.complete();
          }
          this._targets = this._options.reverse ? initialTargets.reverse() : initialTargets;
          this._logger?.debug('targets', this._targets.map((t) => t.map((w) => w.workspace.name)));
          this._scheduleTasks();
          this._updateCurrentStep(0);
          this._executeNextTask();
          this._resetWatcher();
        });
      });
    }
    return this._execution;
  }

  private _resetWatcher(): void {
    if (this._options.watch) {
      this._watcher?.unwatch();
      const watcher = new Watcher(this._targets, this._options.cmd, this._options.debounce, this._logger?.logger);
      this._watcher = watcher;
      this._sourcesChanged$ = watcher.watch();
      this._sourcesChanged$.pipe(takeUntil(this._scopeChanged$)).subscribe({
        next: (fsEvents) => this._sourcesChanged(fsEvents),
      });
    }
  }

  private _sourcesChanged(changes: WatchEvent[]): void {
    this._logger?.debug(`[${this._options.cmd}]`,'Sources changed', changes.map((c) => c.target.workspace.name));
    this._reschedule({
      removedFromScope: [],
      addedInScope: [],
      sourceChanged: changes,
      previousTargets: this._targets,
    });
  }

  scopeChanged(newScope: Workspace[]): void {
    this._logger?.debug(`[${this._options.cmd}]`,'Scope changed', newScope.map((t) => t.name));
    const targetsResolver = new TargetsResolver(this._project, this._logger?.logger);
    const newOptions = { ...this._options };
    if (isTopological(newOptions)) {
      newOptions.to = [...newScope];
    } else {
      newOptions.workspaces = [...newScope];
    }

    targetsResolver.resolve(newOptions.cmd, newOptions).then((_newTargets) => {
      this._logger?.debug('Target resolved', newOptions.cmd, _newTargets.map((s) => s.map((t) => t.workspace.name)));
      const previousTargets = this._targets;
      const newTargets = _newTargets.flat();

      const addedInScope = newTargets.filter((nt) => !TargetsResolver.includesWorkspace(previousTargets.flat(), nt.workspace));
      const removedFromScope = previousTargets.flat().filter((pt) => !TargetsResolver.includesWorkspace(newTargets, pt.workspace));

      if (!addedInScope.length && !removedFromScope.length) {
        this._logger?.debug(`[${this._options.cmd}]`,'Nothing to do');
        return;
      }

      //this._logger?.log('Targets resolved', newTargets.map((t) => t.workspace.name));
      this.obs.next({ type: RunCommandEventEnum.TARGETS_RESOLVED, targets: newTargets });

      this._options = newOptions;
      this._targets = this._options.reverse ? _newTargets.reverse() : _newTargets;
      this._scopeChanged$.next();
      this._logger?.debug(`[${this._options.cmd}]`,'Reset watcher');
      this._resetWatcher();
      this._reschedule({
        addedInScope,
        removedFromScope,
        sourceChanged: [],
        previousTargets,
      })
    });
  }

  private _reschedule(context: IReschedulingContext): void {
    this._logger?.debug(`[${this._options.cmd}]`,'Perform reschedule', { reschedulingAll: this._reschedulingAll, reschedulingFromStep: this._reschedulingFromStep });
    const hasScopeChanged = context.removedFromScope.length || context.addedInScope.length;
    if (this._options.mode === 'topological' && hasScopeChanged) {
      return this._doCompleteReschedule(context.sourceChanged, context.previousTargets);
    } else if (hasScopeChanged || context.sourceChanged.length) {
      this._doPartialReschedule(context);
    }
  }

  private _updateCurrentStep(idx: number, queue?: IResolvedTarget[]): void {
    this._logger?.debug(`[${this._options.cmd}]`,'Updating current step', idx);
    this._currentStepIndex = idx;
    const currentStep = this._targets.at(this._currentStepIndex);
    if (!currentStep) {
      this._logger?.debug(`[${this._options.cmd}]`,'Last step reached')
      return;
    }
    this._currentStep.clear();
    for (const target of queue ?? currentStep) {
      this._currentStep.set(target.workspace.name, 'queued');
    }
  }

  private _resolveImpactedTargets(changes: WatchEvent[]): IImpactedTargets {
    const toKill = new Set<IResolvedTarget>();
    const toStart = new Array<IResolvedTarget>();

    if (!changes.length) {
      return {
        toKill,
        toStart,
        mostEarlyStepImpacted: undefined,
        mostEarlyStepImpactedIndex: undefined,
        toInvalidate: [],
      }
    }

    this._logger?.debug(`[${this._options.cmd}]`,'Sources changed', changes.map((c) => c.target.workspace.name));
    const { mostEarlyStepImpacted, mostEarlyStepImpactedIndex } = this._findMostEarlyImpactedStep(changes);

    const isInCurrentStep = this._isEqualsCurrentStep(mostEarlyStepImpacted);
    const isStrictlyBeforeCurrentStep = this._isBeforeCurrentStep(mostEarlyStepImpacted);
    const isAfterCurrentStep = !isInCurrentStep && !isStrictlyBeforeCurrentStep;
    const currentStep = this._targets.at(this._currentStepIndex);
    this._logger?.debug(`[${this._options.cmd}]`,{
      isInCurrentStep,
      isStrictlyBeforeCurrentStep,
      isAfterCurrentStep,
      currentStep: currentStep?.map((t) => t.workspace.name),
      mostEarlyStepImpactedIndex,
    });
    const scheduleStart = (target: IResolvedTarget): void => {
      if (!toStart.some((t) => t.workspace.name === target.workspace.name)) {
        toStart.push(target);
      }
    }

    if (mostEarlyStepImpactedIndex != null && isInCurrentStep) {
      for (const target of currentStep ?? []) {
        const isQueued = this._isQueued(target);
        const isRunning = this._isRunning(target);
        const isImpacted = this._isImpacted(changes, target);
        const isScheduled = this._isScheduled(target);

        const shouldKill = isRunning && isImpacted && isScheduled;
        const shouldStart = !isQueued && isImpacted && isScheduled;

        this._logger?.debug(`[${this._options.cmd}]`,{w: target.workspace.name, isQueued, isRunning, isImpacted, isScheduled, shouldStart, shouldKill});

        if (shouldKill) {
          toKill.add(target);
        }
        if (shouldStart) {
          scheduleStart(target);
        }
      }
    } else if(isStrictlyBeforeCurrentStep && currentStep && mostEarlyStepImpactedIndex != null) {
      // KIll everyone in current step
      this._logger?.debug(`[${this._options.cmd}]`,'Before current step')
      for (const target of currentStep) {
        if (this._isRunning(target)) {
          toKill.add(target);
        }
      }
      // Start impacted targets in most early impacted step
      // And start every target between most early + 1 and current
      for (let stepIdx = mostEarlyStepImpactedIndex; stepIdx <= this._currentStepIndex; ++stepIdx) {
        const isMostEarlyImpactedStep = stepIdx === mostEarlyStepImpactedIndex;
        for (const target of this._targets[stepIdx]) {
          const isImpacted = this._isImpacted(changes, target);
          const isScheduled = this._isScheduled(target);
          const shouldStart = isScheduled && (!isMostEarlyImpactedStep || isImpacted);
          if (shouldStart) {
            scheduleStart(target);
          }
        }
      }
    }
    return {
      toKill,
      toStart,
      mostEarlyStepImpacted,
      mostEarlyStepImpactedIndex,
      toInvalidate: changes.map((change) => ({ type: RunCommandEventEnum.SOURCES_CHANGED, ...change})),
    }
  }

  private _findMostEarlyImpactedStep(
    changes: Array<WatchEvent>,
  ): { mostEarlyStepImpacted: Step | undefined, mostEarlyStepImpactedIndex: number | undefined } {
    let mostEarlyStepImpacted: Step | undefined;
    let mostEarlyStepImpactedIndex: number | undefined = undefined;
    for (const change of changes) {
      const target = change.target;
      const workspace = target.workspace;
      const isTarget = this._targets.flat().some((t) => t.workspace.name === workspace.name);
      if (!isTarget) {
        continue;
      }
      // Notify subscribers that files have changed
      this.obs.next({ type: RunCommandEventEnum.SOURCES_CHANGED, ...change});

      // In the first iteration we resolve the most early impacted step
      // And group impacted workspaces by step number
      const impactedStep = this._targets.find((step) => step.some((t) => t.workspace.name === workspace.name));
      if (impactedStep) {
        const impactedStepNumber = this._targets.indexOf(impactedStep);
        if (mostEarlyStepImpactedIndex === undefined || impactedStepNumber < mostEarlyStepImpactedIndex) {
          mostEarlyStepImpactedIndex = impactedStepNumber;
          mostEarlyStepImpacted = impactedStep;
          this._logger?.debug(`[${this._options.cmd}]`,'Most early step impacted step updated', mostEarlyStepImpactedIndex);
        }
      }
    }
    return { mostEarlyStepImpacted, mostEarlyStepImpactedIndex };
  }

  private _isBeforeCurrentStep(impactedStep: IResolvedTarget[] | undefined): boolean {
    if(!this._currentStep || !impactedStep) {
      return false;
    }
    return this._targets.indexOf(impactedStep) < this._currentStepIndex;
  }

  private _isEqualsCurrentStep(impactedStep: IResolvedTarget[] | undefined): boolean {
    if(!this._currentStep || !impactedStep) {
      return false;
    }
    return this._targets.indexOf(impactedStep) === this._currentStepIndex;
  }

  private _isScheduled(target: IResolvedTarget): boolean {
    return this._targets.some((step) => step.filter((t) => t.hasCommand).some((t) => t.workspace.name === target.workspace.name));
  }

  private _isQueued(target: IResolvedTarget): boolean {
    return this._currentStep.get(target.workspace.name) === 'queued';
  }

  private _isImpacted(changes: WatchEvent[], target: IResolvedTarget): boolean {
    return changes.some((c) => c.target.workspace.name === target.workspace.name);
  }

  private _isRunning(target: IResolvedTarget): boolean {
    const isErrored = this._currentStep.get(target.workspace.name) === 'errored';
    const isProcessing = this._currentStep.get(target.workspace.name) === 'processing';
    const isSucceeded = this._currentStep.get(target.workspace.name) === 'processed';
    const isProcessed = isSucceeded || isErrored;
    const isDaemon = target.workspace.isDaemon(this._options.cmd);
    return isProcessing || (isProcessed && isDaemon);
  }

  private _doPartialReschedule(context: IReschedulingContext): void {
    if (this._reschedulingAll) {
      this._logger?.debug(`[${this._options.cmd}]`,'Already performing a complete reschedule');
      return;
    }
    const impacted = this._resolveImpactedTargets(context.sourceChanged);
    const { toKill, toStart, mostEarlyStepImpactedIndex } = impacted;
    if (this._reschedulingFromStep && mostEarlyStepImpactedIndex && this._reschedulingFromStep < mostEarlyStepImpactedIndex) {
      this._logger?.debug(`[${this._options.cmd}]`,'Already performing a partial reschedule from a previous step', this._reschedulingFromStep);
      return;
    }
    this._logger?.debug(`[${this._options.cmd}]`,'Perform partial reschedule', { reschedulingAll: this._reschedulingAll, reschedulingFromStep: this._reschedulingFromStep });
    // Match by workspace name in case of shallow copy
    const includes = (set: Set<IResolvedTarget> | Array<IResolvedTarget>, target: IResolvedTarget): boolean => {
      return [...set].some((t) => t.workspace.name === target.workspace.name);
    }
    context.removedFromScope.forEach((removed) => {
      if (!includes(toKill, removed) && this._isRunning(removed)) {
        toKill.add(removed);
      }
    });
    context.addedInScope.forEach((added) => {
      if (!includes(toStart, added) && !this._isQueued(added) && this._isScheduled(added)) {
        toStart.push(added);
      }
    });
    this._logger?.debug(`[${this._options.cmd}]`,'to kill', [...toKill].map((t) => t.workspace.name));
    this._logger?.debug(`[${this._options.cmd}]`,'to start', [...toStart].map((t) => t.workspace.name));
    const shouldRescheduleFromCurrentStep = mostEarlyStepImpactedIndex == null || mostEarlyStepImpactedIndex === this._currentStepIndex;
    if (shouldRescheduleFromCurrentStep) {
      this._reschedulingFromStep = this._currentStepIndex;
      this._rescheduleFromCurrentStep(impacted);
    } else if (toKill.size || toStart.length) {
      this._reschedulingFromStep = mostEarlyStepImpactedIndex;
      this._rescheduleFromPreviousStep(impacted);
    }
  }

  private _doCompleteReschedule(changes: WatchEvent[], previousTargets: OrderedTargets): void {
    this._reschedulingAll = true;
    this._logger?.debug(`[${this._options.cmd}]`,'Perform complete reschedule', { reschedulingAll: this._reschedulingAll, reschedulingFromStep: this._reschedulingFromStep });
    // Send source changed events
    const sourceChangedEvents: RunCommandEvent[] = changes.map((c) => ({ type: RunCommandEventEnum.SOURCES_CHANGED, ...c }));
    sourceChangedEvents.forEach((evt) => this.obs.next(evt));
    // Kill all running targets
    const currentStep = previousTargets.at(this._currentStepIndex);
    const toKill = new Set<IResolvedTarget>();
    for (const target of currentStep ?? []) {
      if (this._isRunning(target)) {
        toKill.add(target);
      }
    }
    Promise.all([...toKill].map((t) => this._killTarget(t))).then(() => {
      this._reschedulingAll = false;
      this._logger?.debug(`[${this._options.cmd}]`,'Done complete rescheduling', { reschedulingAll: this._reschedulingAll, reschedulingFromStep: this._reschedulingFromStep });
      this._updateCurrentStep(0);
      const invalidations$ = this._resolveInvalidations(sourceChangedEvents).values();
      const run$ = this._getInitialSchedule();
      this._tasks$.splice(this._currentTaskIndex + 1, this._tasks$.length - this._currentTaskIndex - 1);
      this._tasks$.push(...[...invalidations$, ...run$]);
      this._executeNextTask();
      this._logger?.debug(this._tasks$.map((t) => [t.type, t.target.workspace.name]), this._currentTaskIndex);
    });
  }

  private get _isReschedulingFromCurrentStep(): boolean {
    return this._reschedulingFromStep === this._currentStepIndex && !this._reschedulingAll;
  }

  private _rescheduleFromCurrentStep(actions: IImpactedTargets): void {
    const { toStart, toKill } = actions;
    this._logger?.debug(`[${this._options.cmd}]`,'Rescheduling from current step', { reschedulingAll: this._reschedulingAll, reschedulingFromStep: this._reschedulingFromStep });
    const invalidations = this._resolveInvalidations(actions.toInvalidate);
    const actions$: Array<Promise<void>> = [];
    for (const target of new Set([...toStart, ...toKill])) {
      if (!this._isReschedulingFromCurrentStep) {
        this._logger?.debug(`[${this._options.cmd}]`,'Rescheduling from current step aborted by previous step rescheduling')
        break;
      }
      const shouldStart = toStart.some((t) => t.workspace.name === target.workspace.name);
      const shouldKill = [...toKill].some((t) => t.workspace.name === target.workspace.name);
      if (shouldStart && !shouldKill) {
        this._startTargets([target], [...invalidations.values()]);
        invalidations.clear();
      } else {
        actions$.push(this._killTarget(target).then(() => {
          if (shouldStart && this._isReschedulingFromCurrentStep) {
            this._startTargets([target], [...invalidations.values()]);
            invalidations.clear();
          }
        }));
      }
    }
    Promise.all(actions$).finally(() => {
      this._logger?.debug(`[${this._options.cmd}]`,'Rescheduling from current step done');
      this._reschedulingFromStep = undefined;
    });
  }

  private _rescheduleFromPreviousStep(actions: IImpactedTargets): void {
    const { toStart, toKill, mostEarlyStepImpactedIndex } = actions;
    this._logger?.debug(`[${this._options.cmd}]`,'Rescheduling from previous step', { mostEarlyStepImpactedIndex, reschedulingFromStep: this._reschedulingFromStep });
    this._logger?.debug(`[${this._options.cmd}]`,'Current tasks state', this._tasks$.map((t => [t.type, t.target.workspace.name])));
    const subsequentTasks = this._tasks$.slice(this._currentTaskIndex + 1);
    this._tasks$.splice(this._currentTaskIndex + 1, this._tasks$.length - this._currentTaskIndex - 1);
    this._logger?.debug(`[${this._options.cmd}]`,'Subsequent tasks', subsequentTasks.map((t => [t.type, t.target.workspace.name])));
    this._logger?.debug(`[${this._options.cmd}]`,'New tasks state', this._tasks$.map((t => [t.type, t.target.workspace.name])));
    this._logger?.debug(`[${this._options.cmd}]`,'cursor:', this._currentTaskIndex);
    this._logger?.debug(`[${this._options.cmd}]`,'Kill all impacted target in current step');
    Promise.all([...toKill].map((target) => this._killTarget(target))).then(() => {
      if (this._reschedulingAll) {
        this._logger?.debug(`[${this._options.cmd}]`,'Already rescheduling all, not restarting target from step', mostEarlyStepImpactedIndex);
        return;
      }
      if (mostEarlyStepImpactedIndex == null) {
        throw new Error('Fatal: cannot reschedule as most early impacted step has not been resolved');
      }
      const queue = toStart.filter((targetToStart) => {
        const mostEarlyImpactedStep = this._targets.at(mostEarlyStepImpactedIndex);
        return mostEarlyImpactedStep?.some((t) => t.workspace.name === targetToStart.workspace.name);
      });
      this._logger?.debug(`[${this._options.cmd}]`,'to invalidate', actions.toInvalidate.map((e) => e.target.workspace.name));
      const invalidations = this._resolveInvalidations(actions.toInvalidate);
      this._updateCurrentStep(mostEarlyStepImpactedIndex, queue);
      this._startTargets(toStart, [...invalidations.values()], subsequentTasks);
    }).finally(() => {
      this._logger?.debug(`[${this._options.cmd}]`,'Rescheduling from current previous step done');
      this._reschedulingFromStep = undefined
    });
  }

  private _startTargets(targets: IResolvedTarget[], invalidations$?: ITask[], subsequentTasks?: ITask[]): void {
    this._logger?.debug(`[${this._options.cmd}]`,'Asked to start', targets.map((t) => t.workspace.name));
    this._logger?.debug(`[${this._options.cmd}]`,'Invalidations', invalidations$?.map((t) => t.target.workspace.name));
    const areAllProcessed = !this._hasNextTask();
    this._logger?.debug(`[${this._options.cmd}]`,{areAllProcessed, currentIndex: this._currentTaskIndex, concurrency: this.concurrency, running: this._runningTasks});
    const toRun$ = [...targets].map((target) => ({
      type: 'run' as const,
      target,
      operation$: this._runForWorkspace(target)
    }));
    const actions$: ITask[] = [...(invalidations$ ?? []), ...toRun$,]
    this._tasks$.splice(this._currentTaskIndex + 1, 0, ...actions$);
    if (subsequentTasks) {
      this._tasks$.push(...subsequentTasks);
    }
    if (areAllProcessed || this._runningTasks < this.concurrency) {
      this._executeNextTask();
    }
  }

  private async _killTarget(target: IResolvedTarget): Promise<void> {
    const workspace = target.workspace;
    this._logger?.debug(`[${this._options.cmd}]`,'Asked to kill', workspace.name);
    const existingKilling$ = this._killing$.get(workspace.name);
    if (existingKilling$) {
      this._logger?.debug(`[${this._options.cmd}]`,'Already killing', workspace.name);
      return existingKilling$;
    }
    const pids = workspace.getPids(this._options.cmd);
    this.obs.next({ type: RunCommandEventEnum.NODE_INTERRUPTING, target, pids });
    const releasePorts = this._options.watch ? this._options.releasePorts?.get(workspace.name)?.filter((port) => Number.isInteger(port)) : undefined;
    const kill$ = workspace.kill({ cmd: this._options.cmd, _workspace: workspace.name, releasePorts })
      .then((killedPids) => {
        this._logger?.debug(`[${this._options.cmd}]`,'Killed', this._options.cmd, workspace.name, 'pids', killedPids);
        if (killedPids.length) {
          this.obs.next({ type: RunCommandEventEnum.NODE_INTERRUPTED, target, pids: killedPids });
        }
      })
      .finally(() => this._killing$.delete(workspace.name));
    this._killing$.set(workspace.name, kill$);
    return kill$;
  }

  private _scheduleTasks(): void {
    this._tasks$ = this._getInitialSchedule();
    this._logger?.debug('Initial schedule', this._tasks$.map((t) => [t.type, t.target.workspace.name]));
  }

  private _getInitialSchedule(): ITask[] {
    return this._targets.flat().map((target) => ({
      target,
      type: 'run' as const,
      operation$: this._runForWorkspace(target),
    }));
  }

  private _hasNextTask(): boolean {
    // Reached end of task FIFO queue
    const nextTask = this._tasks$.at(this._currentTaskIndex + 1);
    return !!nextTask;
  }

  private _shouldExecuteNextTask(): boolean {
    // Maximum concurrency already reached
    if (this._runningTasks >= this.concurrency) {
      this._logger?.debug(`[${this._options.cmd}]`,'Maximum concurrency reached, waiting for a task to finish');
      return false;
    }

    // Check if next task can be done without breaking topological constraint
    const nextTaskIndex = this._currentTaskIndex + 1;
    this._logger?.debug(`[${this._options.cmd}]`,'all', this._tasks$.map((t) =>[t.type, t.target.workspace.name]));
    this._logger?.debug(`[${this._options.cmd}]`,'cursor:', this._currentTaskIndex)
    const nextTask = this._tasks$.at(nextTaskIndex);
    if (!nextTask) {
      this._logger?.debug(`[${this._options.cmd}]`,'No more task');
      return false;
    }
    this._logger?.debug(`[${this._options.cmd}]`,'should run next tasks ?', nextTask.type, nextTask.target.workspace.name);
    if (this._pendingInvalidations.has(nextTask.target.workspace.name)) {
      this._logger?.debug(`[${this._options.cmd}]`,'Pending invalidation waiting for it to complete');
      return false;
    }
    const shouldWaitPreviousTasksToComplete = (): boolean => {
      if (nextTask.type !== 'run') {
        return false;
      }
      this._logger?.debug(`[${this._options.cmd}]`,'should run', nextTask.target.workspace.name, '?');
      const nextTargetStep = this._targets.find((step) => step.find((t) => t.workspace.name === nextTask.target.workspace.name));
      if (!nextTargetStep) {
        // This should not happen, that means a rescheduling is in progress waiting
        return true;
      }
      const nextTargetStepIndex = this._targets.indexOf(nextTargetStep);
      this._logger?.debug(`[${this._options.cmd}]`,'next task step #', nextTargetStepIndex);
      this._logger?.debug(`[${this._options.cmd}]`,'current step #', this._currentStepIndex);
      if (nextTargetStepIndex > this._currentStepIndex) {
        const hasQueued = [...this._currentStep.values()].some((s) => s === 'queued');
        const hasErrored = [...this._currentStep.values()].some((s) => s === 'errored');
        const hasProcessing = [...this._currentStep.values()].some((s) => s === 'processing');
        const hasPendingInvalidation = this._pendingInvalidations.has(nextTask.target.workspace.name);
        if (hasErrored  && this._options.mode === 'topological' && !this._options.watch && !this._pendingInvalidations.size) {
          this.obs.error();
        }
        this._logger?.debug(`[${this._options.cmd}]`,{hasQueued, hasErrored, hasProcessing, hasPendingInvalidation});
        return hasQueued || hasErrored || hasProcessing || hasPendingInvalidation;
      } else {
        return false;
      }
    }

    return !shouldWaitPreviousTasksToComplete();
  }

  private _executeNextTask(): void {
    this._logger?.debug(`[${this._options.cmd}]`,'Executing next task if possible');
    if (this._shouldExecuteNextTask()) {
      this._currentTaskIndex++;
      const nextTask = this._tasks$.at(this._currentTaskIndex);
      this._logger?.debug(`[${this._options.cmd}]`,'Current task', this._currentTaskIndex, this._tasks$.at(this._currentTaskIndex)?.type, this._tasks$.at(this._currentTaskIndex)?.target.workspace.name);
      if (nextTask) {
        this._executeTask(nextTask);
        if (this._hasNextTask()) {
          this._executeNextTask();
        }
      }
    }
  }

  private _executeTask(task: ITask): void {
    if (task.type === 'run') {
      const currentStep = this._targets.find((group) => group.find((target) => target.workspace.name === task.target.workspace.name));
      if (!currentStep) {
        throw new Error('Assertion failed: cannot update current step index');
      }
      const currentStepIndex = this._targets.indexOf(currentStep);
      if (currentStepIndex > this._currentStepIndex) {
        this._updateCurrentStep(currentStepIndex);
      }
      this._currentStep.set(task.target.workspace.name, 'processing');
    }
    this._logger?.debug(`[${this._options.cmd}]`,'Running task', task.type, task.target.workspace.name);
    if (task.type === 'run') {
      this._runningTasks++;
      this._logger?.debug(`[${this._options.cmd}]`,'Current concurrency', this._runningTasks);
    }
    task.operation$.subscribe({
      next: this._onRunCommandEventReceived.bind(this),
      error: (err) => {
        this._logger?.info('Fatal: Error received', { cmd: this._options.cmd, err });
        this.obs.error(err);
      },
      complete: () => {
        this._completedTasks++;
        this._logger?.debug(`[${this._options.cmd}]`,'Task completed', task.target.workspace.name, this._completedTasks, '/', this._tasks$.length);
        if (task.type === 'run') {
          this._runningTasks--;
          this._logger?.debug(`[${this._options.cmd}]`,'Current concurrency', this._runningTasks);
        }
        if (this._hasNextTask()) {
          this._executeNextTask();
        }
        if (this._completedTasks === this._tasks$.length) {
          return this._completeExecution();
        }
      },
    });
  }

  private _onRunCommandEventReceived(evt: RunCommandEvent): void {
    this._logger?.info('Forwarding run command event', { cmd: this._options.cmd, type: evt.type, workspace: (evt as {target: { workspace: { name: string }}})?.target?.workspace?.name });
    this.obs.next(evt);
    if (evt.type === RunCommandEventEnum.NODE_PROCESSED) {
      this._currentStep.set(evt.target.workspace.name, 'processed');
      this._logger?.debug(`[${this._options.cmd}]`,'Task run', evt.target.workspace.name, 'done. New cache written. Removing from invalidated');
      this._alreadyInvalidated.delete(evt.target.workspace.name);
    }
    if (evt.type === RunCommandEventEnum.NODE_SKIPPED) {
      this._currentStep.set(evt.target.workspace.name, 'processed');
    }
    if (evt.type === RunCommandEventEnum.NODE_ERRORED) {
      this._currentStep.set(evt.target.workspace.name, 'errored');
    }
    if (evt.type === RunCommandEventEnum.ERROR_INVALIDATING_CACHE) {
      this.obs.error();
    }
    if (evt.type === RunCommandEventEnum.NODE_ERRORED || evt.type === RunCommandEventEnum.NODE_PROCESSED) {
      this._scheduleInvalidations([evt]);
    }
  }

  private _completeExecution(): void {
    if (!this._options.watch) {
      return this.obs.complete();
    }
  }

  private _runForWorkspace(
    target: IResolvedTarget,
  ): Observable<RunCommandEvent> {
    if (target.hasCommand) {
      this._logger?.debug(`[${this._options.cmd}]`,'Started', this._options.cmd, target.workspace.name)
      const started$: Observable<RunCommandEvent>  = of({ type: RunCommandEventEnum.NODE_STARTED, target });
      const execute$: Observable<RunCommandEvent> = this._executeCommandCatchingErrors(target).pipe(
        map((result) => this._mapToRunCommandEvents(result, target)),
      );
      return concat(
        started$,
        execute$,
      );
    }
    return of({ type: RunCommandEventEnum.NODE_SKIPPED, target });
  }

  private _executeCommandCatchingErrors(
    target: IResolvedTarget,
  ) : Observable<CaughtProcessExecution>{
    const options = this._options;
    this._logger?.info('Preparing command', {cmd: options.cmd, workspace: target.workspace.name});
    const command$ = target.workspace.run(options, target.workspace.name);
    return command$.pipe(
      map((result) => ({ status: 'ok' as const, result, target })),
      catchError((error) => of({ status: 'ko' as const, error, target })),
    );
  }

  private _mapToRunCommandEvents(
    execution: CaughtProcessExecution,
    target: IResolvedTarget,
  ): RunCommandEvent {
    const options = this._options;
    const workspace = target.workspace;
    this._logger?.info('Mapping events for', { workspace: workspace.name, cmd: options.cmd });
    if (execution.status === 'ok') {
      const result = execution.result;
      this._logger?.info('Execution success, sending node processed event', { workspace: workspace.name, cmd: options.cmd, took: execution.result.overall, fromCache: execution.result.fromCache });
      return { type: RunCommandEventEnum.NODE_PROCESSED, result, target };
    } else {
      this._logger?.info('Execution errored in parallel mode, sending node errored event and continuing', { workspace: workspace.name, cmd: options.cmd });
      return { type: RunCommandEventEnum.NODE_ERRORED, error: execution.error, target };
    }
  }

  private _scheduleInvalidations(events: Array<RunCommandEvent>, insertAt?: number): void {
    const invalidations$ = this._resolveInvalidations(events);
    const index = (insertAt ?? this._currentTaskIndex) + 1;
    this._tasks$.splice(index, 0, ...invalidations$.values());
    this._logger?.debug(`[${this._options.cmd}]`,this._tasks$.map((t) => [t.type, t.target.workspace.name]));
    this._logger?.debug(`[${this._options.cmd}]`,'cursor:', this._currentTaskIndex);
  }

  private _resolveInvalidations(events: Array<RunCommandEvent>): Map<string, ITask> {
    // When execution step is completed or errored, perform required cache invalidations
    // Invalidate cache of every errored nodes
    const potentialInvalidations: Map<string, IResolvedTarget> = new Map();

    for (const evt of events) {

      const isEligibleEvent = isNodeSucceededEvent(evt) || isNodeErroredEvent(evt) || isSourceChangedEvent(evt)
      if (!isEligibleEvent) {
        continue;
      }
      const { target } = evt;
      this._logger?.info('Resolving invalidations', target.workspace.name, evt.type);

      const addToInvalidations = (t: IResolvedTarget): void => {
        if (!potentialInvalidations.has(t.workspace.name)) {
          potentialInvalidations.set(t.workspace.name, t);
        }
      }
      const haveSourceChanged = evt.type === RunCommandEventEnum.SOURCES_CHANGED && evt.target.hasCommand;
      const isErrored = evt.type === RunCommandEventEnum.NODE_ERRORED;
      const isNotFromCache = evt.type === RunCommandEventEnum.NODE_PROCESSED && !evt.result.fromCache;
      if (haveSourceChanged || isErrored) {
        addToInvalidations(target);
      }
      if (this._options.mode === 'topological' && (haveSourceChanged || isErrored || isNotFromCache)) {
        const step = this._targets.find((s) => s.find((t) => t.workspace.name === target.workspace.name));
        if (step) {
          const nextStep = this._targets.indexOf(step) + 1;
          for (let idx = nextStep; idx < this._targets.length; ++idx) {
            const subsequentStep = this._targets[idx];
            subsequentStep.forEach((subsequentTarget) => {
              const hasSubsequentTargetCurrentTargetAsProdDep =
                  !!subsequentTarget.workspace.pkg.dependencies && Object.keys(subsequentTarget.workspace.pkg.dependencies).includes(target.workspace.name);
              const hasSubsequentTargetCurrentTargetAsDevDep =
                  !!subsequentTarget.workspace.pkg.devDependencies && Object.keys(subsequentTarget.workspace.pkg.devDependencies).includes(target.workspace.name);

              const hasToInvalidate = hasSubsequentTargetCurrentTargetAsProdDep || hasSubsequentTargetCurrentTargetAsDevDep;
              if (hasToInvalidate) {
                addToInvalidations(subsequentTarget)
              }
            });
          }
        }
      }
    }
    this._logger?.debug(`[${this._options.cmd}]`,'Potential invalidations', potentialInvalidations.keys());


    const invalidations$: Map<string, ITask> = new Map();
    const isAlreadyPlanned = (workspaceName: string): boolean => {
      for (let idx = this._currentTaskIndex; idx < this._tasks$.length; ++idx) {
        const task = this._tasks$[idx];
        if (task.type === 'invalidate' && task.target.workspace.name === workspaceName) {
          return true;
        }
        if (task.type === 'run' && task.target.workspace.name === workspaceName) {
          return false;
        }
      }
      return false;
    }

    for (const [invalidatedName, invalidated] of potentialInvalidations.entries()) {
      this._logger?.debug(`[${this._options.cmd}]`,'Is already planned', isAlreadyPlanned(invalidatedName));
      this._logger?.debug(`[${this._options.cmd}]`,'Is already invalidated', this._alreadyInvalidated.has(invalidatedName));
      if (!isAlreadyPlanned(invalidatedName) && !invalidations$.has(invalidatedName) && !this._alreadyInvalidated.has(invalidatedName)) {
        this._logger?.debug(`[${this._options.cmd}]`,'Invalidating', invalidatedName);
        invalidations$.set(invalidatedName, {
          type: 'invalidate',
          target: invalidated,
          operation$: this._invalidateCache(invalidated),
        });
      }
    }
    return invalidations$;
  }

  private _invalidateCache(target: IResolvedTarget): Observable<RunCommandEvent> {
    return new Observable<RunCommandEvent>((obs) => {
      this._pendingInvalidations.add(target.workspace.name);
      target.workspace.invalidateCache(this._options.cmd, this._options)
        .then(() => {
          this._logger?.debug(`[${this._options.cmd}]`,'invalidated');
          obs.next({type: RunCommandEventEnum.CACHE_INVALIDATED, target});
        })
        .catch((error) => obs.next({ type: RunCommandEventEnum.ERROR_INVALIDATING_CACHE, target, error}))
        .finally(() => {
          this._alreadyInvalidated.add(target.workspace.name);
          this._pendingInvalidations.delete(target.workspace.name);
          this._logger?.debug(`[${this._options.cmd}]`,'invalidation completed');
          obs.complete()
        });
    });
  }
}
