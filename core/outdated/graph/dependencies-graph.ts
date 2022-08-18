import { Node } from './';
import { existsSync } from 'fs';
import { join } from 'path';
import { Package } from './';
import { Service } from './';
import { Project } from '@yarnpkg/core';
import { npath } from '@yarnpkg/fslib';
import { getName } from '../yarn/project';
import { IConfig } from '@microlambda/runner-core/lib/config';
import { Logger, Loggers } from '@microlambda/logger';

export const isService = (location: string): boolean => {
  const loc = npath.fromPortablePath(location);
  return existsSync(join(loc, 'serverless.yml')) || existsSync(join(loc, 'serverless.yaml'));
};

export class DependenciesGraph {
  private readonly _config: IConfig;
  private readonly projectRoot: string;
  private readonly nodes: Node[];
  private readonly _logger: Logger | undefined;
  private readonly _project: Project;
  private _log: Loggers | undefined;

  get project(): Project {
    return this._project;
  }

  get logger(): Logger | undefined {
    return this._logger;
  }

  get config(): IConfig {
    return this._config;
  }

  constructor(
    project: Project,
    config: IConfig,
    logger?: Logger,
    defaultPort?: number,
  ) {
    this._logger = logger;
    this._log = logger?.log('graph');
    this._config = config;
    this._project = project;
    this._log?.debug('Building graph with', project);
    this.projectRoot = npath.fromPortablePath(project.cwd);
    const services = project.workspaces.filter((n) => isService(n.cwd));
    const builtNodes: Set<Node> = new Set<Node>();
    this._log?.debug(project.workspaces.map((w) => getName(w)));
    for (const node of project.workspaces) {
      if (project.topLevelWorkspace === node) {
        this._log?.info('Ignoring top-level workspace', getName(project.topLevelWorkspace));
        continue;
      }
      if (!Array.from(builtNodes).some((n) => n.getName() === getName(node))) {
        this._log?.debug('Building node', getName(node));
        this._log?.debug(
          'Already built',
          Array.from(builtNodes).map((b) => b.getName()),
        );
        this._log?.debug('Is service', isService(node.cwd));
        isService(node.cwd)
          ? new Service(this, node, builtNodes, project)
          : new Package(this, node, builtNodes, project);
      }
    }
    this.nodes = Array.from(builtNodes);
    this._log?.debug(
      'Built graph',
      this.nodes.map((n) => n.getName()),
    );
    this._log?.info(`Successfully built ${this.nodes.length} nodes`);
  }

  /**
   * Enables every node that are not already enabled and not excluded by config
   */

  public getProjectRoot(): string {
    return this.projectRoot;
  }

  public getServices(): Service[] {
    return this.nodes.filter((n) => n.isService()) as Service[];
  }
  public getPackages(): Package[] {
    return this.nodes.filter((n) => !n.isService()) as Package[];
  }

  public getNodes(): Node[] {
    return this.nodes;
  }

  public get(name: string): Node | undefined {
    return this.nodes.find((n) => n.getName() === name);
  }

  // TODO: Check if dependencies correctly installed
  /**
  public async install(): Promise<void> {
    await this._project.install({ cache: null, report: null });
  }*/
}
