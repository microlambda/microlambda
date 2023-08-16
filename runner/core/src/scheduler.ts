/* eslint-disable no-console */
import {concat, Observable, of, Subject, Subscriber} from "rxjs";
import {IProcessResult, IResolvedTarget, RunCommandEvent, RunCommandEventEnum, Step} from "./process";
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
  toStart: Set<IResolvedTarget>;
  toRestart: Set<IResolvedTarget>;
  mostEarlyStepImpactedIndex: number | undefined;
  impactedTargets: Set<IResolvedTarget>;
  mostEarlyStepImpacted: IResolvedTarget[] | undefined
}

interface IReschedulingContext {
  removedFromScope: IResolvedTarget[];
  addedInScope: IResolvedTarget[];
  sourceChanged: WatchEvent[];
}

type FailedExecution =  { status: 'ko', error: unknown, target: IResolvedTarget};
type SucceededExecution = {status: 'ok', result: IProcessResult, target: IResolvedTarget };
type CaughtProcessExecution =  SucceededExecution | FailedExecution;

export class Scheduler {
  private _tasks$: ITask[] = [];
  private _targets: OrderedTargets = [];

  private _obs: Subscriber<RunCommandEvent> | undefined;
  private _logger: EventsLogger | undefined;
  private _runningTasks = 0;
  private _completedTasks = 0;
  private _currentTaskIndex = -1;
  private _currentStepIndex = -1;
  private _currentStep: {
    queued: Set<IResolvedTarget>,
    processing: Set<IResolvedTarget>,
    processed: Set<IResolvedTarget>,
    errored: Set<IResolvedTarget>,
  } = {
    queued: new Set(),
    processing: new Set(),
    processed: new Set(),
    errored: new Set(),
  };

  private _watcher: Watcher | undefined;
  private _sourcesChanged$: Observable<Array<WatchEvent>> | undefined;
  private _scopeChanged$ = new Subject<void>();
  private _pendingInvalidations = new Set<string>();
  private _alreadyInvalidated = new Set<string>();

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
          if (!initialTargets.length) {
            this._logger?.info('No eligible targets found for command', this._options.cmd)
            return obs.complete();
          }
          this._targets = initialTargets;
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
    console.debug('Sources changed', changes.map((c) => c.target.workspace.name));
    this._reschedule({
      removedFromScope: [],
      addedInScope: [],
      sourceChanged: changes,
    });
  }

  scopeChanged(newScope: Workspace[]): void {
    const targetsResolver = new TargetsResolver(this._project, this._logger?.logger);
    const newOptions = { ...this._options };
    if (isTopological(newOptions)) {
      newOptions.to = [...newScope];
    } else {
      newOptions.workspaces = [...newScope];
    }

    targetsResolver.resolve(newOptions.cmd, newOptions).then((_newTargets) => {
      const previousTargets = this._targets.flat();
      const newTargets = _newTargets.flat();

      const addedInScope = newTargets.filter((nt) => !TargetsResolver.includesWorkspace(previousTargets, nt.workspace));
      const removedFromScope = previousTargets.filter((pt) => !TargetsResolver.includesWorkspace(newTargets, pt.workspace));

      if (!addedInScope.length && !removedFromScope.length) {
        console.debug('Nothing to do');
        return;
      }

      //console.log('Targets resolved', newTargets.map((t) => t.workspace.name));
      this.obs.next({ type: RunCommandEventEnum.TARGETS_RESOLVED, targets: newTargets });

      this._options = newOptions;
      this._targets = _newTargets;
      this._scopeChanged$.next();
      this._resetWatcher();
      this._reschedule({
        addedInScope,
        removedFromScope,
        sourceChanged: [],
      })
    });
  }

  private _reschedule(context: IReschedulingContext): void {
    const { toKill, toStart, toRestart } = this._resolveImpactedTargets(context.sourceChanged);
    // Match by workspace name in case of shallow copy
    const includes = (set: Set<IResolvedTarget>, target: IResolvedTarget): boolean => {
      return [...set].some((t) => t.workspace.name === target.workspace.name);
    }
    context.addedInScope.forEach((added) => {
      if (!includes(toStart, added) && !includes(toRestart, added) && !this._isQueued(added) && this._isScheduled(added)) {
        toStart.add(added);
      }
    });
    context.removedFromScope.forEach((removed) => {
      if (!includes(toKill, removed) && !includes(toRestart, removed) && this._isRunning(removed)) {
        toKill.add(removed);
      }
    });
    console.debug('to kill', [...toKill].map((t) => t.workspace.name));
    console.debug('to start', [...toStart].map((t) => t.workspace.name));
    console.debug('to restart', [...toRestart].map((t) => t.workspace.name));
    this._restartTargets({ toKill, toStart, toRestart });
  }

  private _updateCurrentStep(idx: number): void {
    this._currentStepIndex = idx;
    const currentStep = this._targets.at(this._currentStepIndex);
    if (!currentStep) {
      console.debug('Last step reached')
      return;
    }
    this._currentStep.queued.clear();
    this._currentStep.processing.clear();
    this._currentStep.processed.clear();
    this._currentStep.errored.clear();
    for (const target of currentStep) {
      this._currentStep.queued.add(target);
    }
  }

  private _resolveImpactedTargets(changes: WatchEvent[]): IImpactedTargets {
    this._logger?.debug('Sources changed', changes.map((c) => c.target.workspace.name));
    const toKill = new Set<IResolvedTarget>();
    const toStart = new Set<IResolvedTarget>();
    const impactedTargets = new Set<IResolvedTarget>();
    let mostEarlyStepImpacted: Step | undefined;
    let mostEarlyStepImpactedIndex: number | undefined;
    const impactedTargetsByStep = new Map<number, Array<IResolvedTarget>>();
    if (!changes.length) {
      return {
        toKill,
        toStart,
        toRestart: new Set<IResolvedTarget>(),
        mostEarlyStepImpacted: undefined,
        mostEarlyStepImpactedIndex: undefined,
        impactedTargets,
      }
    }
    const isBeforeCurrentStep = (impactedStep: IResolvedTarget[] | undefined): boolean => {
      if(!this._currentStep || !impactedStep) {
        return false;
      }
      return this._targets.indexOf(impactedStep) < this._currentStepIndex;
    }
    const isEqualsCurrentStep = (impactedStep: IResolvedTarget[] | undefined): boolean => {
      if(!this._currentStep || !impactedStep) {
        return false;
      }
      return this._targets.indexOf(impactedStep) === this._currentStepIndex;
    }

    for (const change of changes) {
      const target = change.target;
      const workspace = target.workspace;
      const isTarget = this._targets.flat().some((t) => t.workspace.name === workspace.name);
      if (!isTarget) {
        continue;
      }
      // const isRunning = Array.from(this._currentStep.processing).some((t) => t.workspace.name === target.workspace.name);

      // Notify subscribers that files have changed
      this.obs.next({ type: RunCommandEventEnum.SOURCES_CHANGED, ...change});

      // In the first iteration we resolve the most early impacted step
      // And group impacted workspaces by step number
      const impactedStep = this._targets.find((step) => step.some((t) => t.workspace.name === workspace.name));
      if (impactedStep) {
        const impactedStepNumber = this._targets.indexOf(impactedStep);
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
    console.debug({
      isInCurrentStep,
      isStrictlyBeforeCurrentStep,
      isAfterCurrentStep,
    });
    if (mostEarlyStepImpactedIndex != null && mostEarlyStepImpacted && !isAfterCurrentStep) {
      this._logger?.debug(this._options.cmd, 'Impacted step is same than current step. Should abort after current step execution');
      const currentStep = this._targets.at(this._currentStepIndex);
      for (const target of currentStep ?? []) {
        const isQueued = this._isQueued(target);
        const isRunning = this._isRunning(target);

        const isImpacted = changes.some((c) => c.target.workspace.name === target.workspace.name);
        const isScheduled = this._isScheduled(target);
        const shouldKill = isRunning && (isImpacted || isStrictlyBeforeCurrentStep) && isScheduled;
        const shouldStart = isScheduled && isImpacted && !isQueued;

        console.debug({
          target: target.workspace.name,
          isRunning,
          isImpacted,
          isScheduled,
          shouldKill,
          shouldStart,
        })

        if (shouldKill) {
          toKill.add(target);
        }
        if (shouldStart) {
          toStart.add(target);
        }
      }
      impactedTargetsByStep.get(mostEarlyStepImpactedIndex)?.forEach((w) => impactedTargets.add(w));
    }
    const toRestart = new Set([...toKill].filter((t) => toStart.has(t)));
    return {
      toKill: new Set([...toKill].filter(x => !toRestart.has(x))),
      toStart: new Set([...toStart].filter(x => !toRestart.has(x))),
      toRestart,
      mostEarlyStepImpacted,
      mostEarlyStepImpactedIndex,
      impactedTargets,
    }
  }

  private _isScheduled(target: IResolvedTarget): boolean {
    return this._targets.some((step) => step.filter((t) => t.affected && t.hasCommand).some((t) => t.workspace.name === target.workspace.name));
  }

  private _isQueued(target: IResolvedTarget): boolean {
    return Array.from(this._currentStep.queued).some((t) => t.workspace.name === target.workspace.name);
  }

  private _isRunning(target: IResolvedTarget): boolean {
    const isErrored = Array.from(this._currentStep.errored).some((t) => t.workspace.name === target.workspace.name);
    const isProcessing = Array.from(this._currentStep.processing).some((t) => t.workspace.name === target.workspace.name);
    const isSucceeded = Array.from(this._currentStep.processed).some((t) => t.workspace.name === target.workspace.name);
    const isProcessed = isSucceeded || isErrored;
    const isDaemon = target.workspace.isDaemon(this._options.cmd);
    return isProcessing || (isProcessed && isDaemon);
  }

  private _restartTargets(actions: {toStart: Set<IResolvedTarget>, toKill: Set<IResolvedTarget>, toRestart: Set<IResolvedTarget> }): void {
    const { toStart, toKill, toRestart } = actions;
    const allTargets = new Set([...toStart, ...toKill, ...toRestart]);
    for (const target of allTargets) {
      const workspace = target.workspace;
      let action: 'kill' | 'start' | 'restart' | undefined;
      if ([...toKill].some((t) => t.workspace.name === target.workspace.name)) {
        action = 'kill';
      } else       if ([...toStart].some((t) => t.workspace.name === target.workspace.name)) {
        action = 'start';
      } else       if ([...toRestart].some((t) => t.workspace.name === target.workspace.name)) {
        action = 'restart';
      }
      const startTarget = (): void => {
        console.debug('Asked to start', workspace.name);
        const areAllProcessed = !this._hasNextTask();
        console.debug({areAllProcessed, currentIndex: this._currentTaskIndex});

        this._tasks$.splice(this._currentTaskIndex + 1, 0, {
          type: 'run',
          target,
          operation$: this._runForWorkspace(target)
        });
        if (areAllProcessed) {
          this._executeNextTask();
        }
      }
      const killTarget = (): Promise<void> => workspace.kill({ cmd: this._options.cmd, _workspace: workspace.name }).then((killedPids) => {
        console.debug('Killed', this._options.cmd, workspace.name, 'pids', killedPids);
        if (killedPids.length) {
          this.obs.next({ type: RunCommandEventEnum.NODE_INTERRUPTED, target });
        }
      });
      if (action === 'start') {
        startTarget();
      } else if (action) {
        killTarget().then(() => {
          if (action === 'restart') {
            startTarget();
          }
        });
      }
    }
  }

  private _scheduleTasks(): void {
    this._tasks$ = this._targets.flat().map((target) => ({
      target,
      type: 'run',
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
      console.debug('Maximum concurrency reached, waiting for a task to finish');
      return false;
    }

    // Check of next task can be done without breaking topological constraint
    const nextTaskIndex = this._currentTaskIndex + 1;
    console.debug('all', this._tasks$.map((t) =>[t.type, t.target.workspace.name]));
    console.debug('cursor:', this._currentTaskIndex)
    const nextTask = this._tasks$.at(nextTaskIndex);
    if (!nextTask) {
      console.debug('No more task');
      return false;
    }
    console.debug('should run next tasks ?', nextTask.type, nextTask.target.workspace.name);
    const shouldWaitPreviousTasksToComplete = (): boolean => {
      if (nextTask.type !== 'run') {
        return false;
      }
      console.debug('should run', nextTask.target.workspace.name, '?');
      const nextTargetStep = this._targets.find((step) => step.find((t) => t.workspace.name === nextTask.target.workspace.name));
      if (!nextTargetStep) {
        throw new Error('Assertion failed: task not found in targets');
      }
      const nextTargetStepIndex = this._targets.indexOf(nextTargetStep);
      console.debug('next task step #', nextTargetStepIndex);
      console.debug('current step #', this._currentStepIndex);
      if (nextTargetStepIndex > this._currentStepIndex) {
        const hasQueued = this._currentStep.queued.size > 0;
        const hasErrored = this._currentStep.errored.size > 0;
        const hasProcessing = this._currentStep.processing.size > 0;
        const hasPendingInvalidation = this._pendingInvalidations.has(nextTask.target.workspace.name);
        if (hasErrored  && this._options.mode === 'topological' && !this._options.watch && !this._pendingInvalidations.size) {
          this.obs.error();
        }
        return hasQueued || hasErrored || hasProcessing || hasPendingInvalidation;
      } else {
        return false;
      }
    }

    return !shouldWaitPreviousTasksToComplete();
  }

  private _executeNextTask(): void {
    if (this._shouldExecuteNextTask()) {
      this._currentTaskIndex++;
      const nextTask = this._tasks$.at(this._currentTaskIndex);
      console.debug('Current task', this._currentTaskIndex, this._tasks$.at(this._currentTaskIndex)?.type, this._tasks$.at(this._currentTaskIndex)?.target.workspace.name);
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
      this._currentStep.queued.delete(task.target);
      this._currentStep.processing.add(task.target);
    }
    this._runningTasks++;
    console.debug('Running task',  task.target.workspace.name);
    console.debug('Current concurrency', this._runningTasks);
    task.operation$.subscribe({
      next: this._onRunCommandEventReceived.bind(this),
      error: (err) => {
        this._logger?.info('Fatal: Error received', { cmd: this._options.cmd, err });
        this.obs.error(err);
      },
      complete: () => {
        this._completedTasks++;
        console.debug('Task completed', task.target.workspace.name, this._completedTasks, '/', this._tasks$.length);
        this._runningTasks--;
        console.debug('Current concurrency', this._runningTasks);
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
      this._currentStep.processing.delete(evt.target);
      this._currentStep.processed.add(evt.target);
      console.debug('Task run', evt.target.workspace.name, 'done. New cache written. Removing from invalidated');
      this._alreadyInvalidated.delete(evt.target.workspace.name);
    }
    if (evt.type === RunCommandEventEnum.NODE_ERRORED) {
      this._currentStep.processing.delete(evt.target);
      this._currentStep.errored.add(evt.target);
    }
    if (evt.type === RunCommandEventEnum.ERROR_INVALIDATING_CACHE) {
      this.obs.error();
    }
    if (evt.type === RunCommandEventEnum.NODE_ERRORED || evt.type === RunCommandEventEnum.NODE_PROCESSED) {
      this._resolveInvalidations(evt.target, evt);
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
    if (target.affected && target.hasCommand) {
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
      this._logger?.info('Execution success, sending node processed event', { workspace: workspace.name, cmd: options.cmd });
      return { type: RunCommandEventEnum.NODE_PROCESSED, result, target };
    } else {
      this._logger?.info('Execution errored in parallel mode, sending node errored event and continuing', { workspace: workspace.name, cmd: options.cmd });
      return { type: RunCommandEventEnum.NODE_ERRORED, error: execution.error, target };
    }
  }

  private _resolveInvalidations(target: IResolvedTarget, evt: RunCommandEvent): void {
    // When execution step is completed or errored, perform required cache invalidations
    // Invalidate cache of every errored nodes
    console.info('Resolving invalidations', target.workspace.name, evt.type);

    const potentialInvalidations: Map<string, IResolvedTarget> = new Map();
    const addToInvalidations = (t: IResolvedTarget): void => {
      if (!potentialInvalidations.has(t.workspace.name)) {
        potentialInvalidations.set(t.workspace.name, t);
      }
    }
    const haveSourceChanged = evt.type === RunCommandEventEnum.SOURCES_CHANGED;
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
          subsequentStep.forEach((subsequentTarget) => addToInvalidations(subsequentTarget));
        }
      }
    }

    console.debug('Potential invalidations', potentialInvalidations.keys());

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
      console.debug('Is already planned', isAlreadyPlanned(invalidatedName));
      console.debug('Is already invalidated', this._alreadyInvalidated.has(invalidatedName));
      if (!isAlreadyPlanned(invalidatedName) && !invalidations$.has(invalidatedName) && !this._alreadyInvalidated.has(invalidatedName)) {
        console.debug('Invalidating', invalidatedName);
        invalidations$.set(invalidatedName, {
          type: 'invalidate',
          target: invalidated,
          operation$: this._invalidateCache(invalidated),
        });
      }
    }

    this._tasks$.splice(this._currentTaskIndex + 1, 0, ...invalidations$.values());
    console.debug(this._tasks$.map((t) => [t.type, t.target.workspace.name]));
    console.debug('cursor:', this._currentTaskIndex);
  }

  private _invalidateCache(target: IResolvedTarget): Observable<RunCommandEvent> {
    return new Observable<RunCommandEvent>((obs) => {
      this._pendingInvalidations.add(target.workspace.name);
      target.workspace.invalidateCache(this._options.cmd, this._options)
        .then(() => obs.next({ type: RunCommandEventEnum.CACHE_INVALIDATED, target }))
        .catch((error) => obs.next({ type: RunCommandEventEnum.ERROR_INVALIDATING_CACHE, target, error}))
        .finally(() => {
          this._alreadyInvalidated.add(target.workspace.name);
          this._pendingInvalidations.delete(target.workspace.name);
          obs.complete()
        });
    });
  }
}
