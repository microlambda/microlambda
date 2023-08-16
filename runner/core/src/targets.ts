import { IResolvedTarget } from './process';
import { Workspace } from './workspace';
import { isTopological, ITopologicalRemoteCacheRunOptions, ITopologicalRunOptions, RunOptions } from './runner';
import { Project } from './project';
import { EventsLog, EventsLogger } from '@microlambda/logger';

export type OrderedTargets = IResolvedTarget[][];

export class TargetsResolver {

  static readonly scope = 'runner-core/targets';

  constructor(
    private readonly _project: Project,
    logger?: EventsLog,
  ) {
    this._logger = logger?.scope(TargetsResolver.scope);
  }

  static includesWorkspace(targets: IResolvedTarget[], workspace: Workspace): boolean {
    return targets.some((t) => t.workspace.name === workspace.name);
  }

  private _logger: EventsLogger | undefined;

  // FIXME: Could be sync
  async resolve(cmd: string, options: RunOptions): Promise<OrderedTargets> {
    if (isTopological(options)) {
      return this._recursivelyResolveTargets(cmd, options);
    }
    const workspaces = options.workspaces || Array.from(this._project.workspaces.values());
    return [this._findTargets(workspaces, cmd)];
  }

  private _findTargets(eligible: Workspace[], cmd: string): Array<IResolvedTarget> {
    return eligible.map((workspace) => {
      const hasCommand = workspace.hasCommand(cmd);
      return { workspace, affected: true, hasCommand};
    });
  }

  private _recursivelyResolveTargets(cmd: string, options: ITopologicalRunOptions | ITopologicalRemoteCacheRunOptions): OrderedTargets {
    this._logger?.silly('Recursively resolving targets');
    const targets = this._findTargets(Array.from(this._project.getTopologicallySortedWorkspaces(options.to)), cmd);
    // Find targets we will not run command on as it is either unaffected or it has not the command
    const inactiveTargets = targets.filter((t) => !t.hasCommand || !t.affected);
    // We also store the names for better performance in further recursion
    const inactiveTargetsNames = new Set(inactiveTargets.map((t) => t.workspace.name));

    // We put the inactive targets at the beginning by convention
    const orderedTargets: OrderedTargets = inactiveTargets.length ? [inactiveTargets] : [];

    // The recursion will determine which targets can be processed in parallel, depending on their position in the graph
    // At each recursion step, we find which targets can be processed safely and remove them
    const processed = new Set<string>();
    this._logger?.debug('Inactive targets', inactiveTargetsNames);
    this._logger?.debug('Ordering targets');
    const orderTargets = (targets: Set<IResolvedTarget>): void => {
      // Exit condition : When the set is empty, every target is processed
      if (!targets.size) {
        return;
      }
      const step: IResolvedTarget[] = [];
      for (const target of targets) {
        this._logger?.silly('Analyzing target', target.workspace.name);
        // A target can be processed if it is a leaf or all its dependencies has already processed or ignored
        const isLeaf = this._project.leaves.has(target.workspace.name);
        const hasEveryDependenciesProcessed = Array.from(target.workspace.descendants.keys()).every((dep) => inactiveTargetsNames.has(dep) || processed.has(dep));
        this._logger?.silly({ isLeaf, hasEveryDependenciesProcessed });
        if (isLeaf || hasEveryDependenciesProcessed) {
          step.push(target);
        }
      }
      orderedTargets.push(step);
      step.forEach((target) => {
        processed.add(target.workspace.name);
        targets.delete(target);
      });
      orderTargets(targets);
    }

    // We initialize the recursion on active targets
    const activeTargets = new Set(targets.filter((t) => !inactiveTargetsNames.has(t.workspace.name)));
    orderTargets(activeTargets);
    this._logger?.silly('Ordered Targets', orderedTargets.map((step) => step.map((t) => t.workspace.name)));
    return orderedTargets;
  }
}
