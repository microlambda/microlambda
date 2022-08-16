// Class
import { Workspace } from './workspace';
import { join } from 'path';
import { sync as glob } from 'fast-glob';
import { RunOptions, Runner } from './runner';
import { Publish } from './publish';
import { ReleaseType } from 'semver';
import { CentipodError, CentipodErrorCode } from './error';
import { Observable } from 'rxjs';
import { RunCommandEvent } from './process';
import { AbstractLogsHandler } from "./logs-handler";
import { IAbstractLogger } from "./logger";

export class Project extends Workspace {
  // Attributes
  protected readonly _workspaces = new Map<string, Workspace>();
  readonly project = this;
  // Getters
  get workspaces(): Map<string, Workspace> { return this._workspaces }

  // Statics
  static async loadProject(root: string, logger?: IAbstractLogger): Promise<Project> {
    const prj = new Project(await this.loadPackage(root), root, await this.loadConfig(root));
    await prj.loadWorkspaces(logger);
    return prj;
  }

  // Methods
  async loadWorkspaces(logger?: IAbstractLogger): Promise<void> {
    // Load workspaces
    if (this.pkg.workspaces && this.pkg.workspaces.length > 0) {
      const patterns = this.pkg.workspaces.map(wks => glob(join(this.root, wks, 'package.json'))).reduce((acc, val) => acc = acc.concat(val), []);
      for await (let root of patterns) {
        root = root.replace(/[\\/]package\.json$/, '');
        try {
          // Store it
          const wks = await Workspace.loadWorkspace(root, this, logger);
          this._workspaces.set(wks.name, wks);

        } catch (error) {
          throw new CentipodError(CentipodErrorCode.UNABLE_TO_LOAD_WORKSPACE, `Unable to load workspace at ${root}: ${error}`);
        }
      }
    }
  }

  getWorkspace(name: string): Workspace | null {
    return this._workspaces.get(name) || null;
  }

  get leaves(): Map<string, Workspace>  {
    const leaves = new Map<string, Workspace>();
    for (const workspace of this.workspaces.values()) {
      const isLeaf = !workspace.descendants.size;
      if (isLeaf) leaves.set(workspace.name, workspace);
    }
    return leaves;
  }

  get roots(): Map<string, Workspace>  {
    const roots = new Map<string, Workspace>();
    for (const workspace of this.workspaces.values()) {
      const isRoot = !workspace.ancestors.size;
      if (isRoot) roots.set(workspace.name, workspace);
    }
    return roots;
  }

  getTopologicallySortedWorkspaces(to?: Workspace[]): Workspace[] {
    const sortedWorkspaces: Set<Workspace> = new Set<Workspace>();
    const visitWorkspace = (workspace: Workspace, depth = 0): void => {
      for (const dep of workspace.dependencies()) {
        visitWorkspace(dep, depth + 1);
      }
      sortedWorkspaces.add(workspace);
    };
    if (to) {
      for (const target of to) {
        visitWorkspace(target);
      }
    } else {
      for (const root of this.roots.values()) {
        visitWorkspace(root);
      }
    }
    return [...sortedWorkspaces];
  }

  registerLogsHandler(handler: new (workspace: Workspace) => AbstractLogsHandler<unknown>): void {
    for (const workspace of this._workspaces.values()) {
      workspace.addLogsHandler(new handler(workspace));
    }
  }

  runCommand(cmd: string, options: RunOptions): Observable<RunCommandEvent> {
    const runner = new Runner(this);
    return runner.runCommand(cmd, options);
  }

  async publishAll(bump?: ReleaseType, identifier?: string): Promise<Publish> {
    const publisher = new Publish(this);
    await publisher.determineActions(undefined, bump, identifier);
    return publisher;
  }
}
