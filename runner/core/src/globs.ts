import { EventsLog, EventsLogger } from '@microlambda/logger';
import { Workspace } from './workspace';
import { sync as glob } from 'fast-glob';
import { join } from 'path';
import { MilaError, MilaErrorCode } from '@microlambda/errors';
import { ITargetConfig } from '@microlambda/config';

export class GlobsHelpers {
  private readonly logger: EventsLogger | undefined;
  static readonly scope = 'runner-core/globs';

  constructor(readonly workspace: Workspace, readonly cmd: string, eventsLog?: EventsLog) {
    this.logger = eventsLog?.scope(GlobsHelpers.scope);
  }

  get config(): ITargetConfig | undefined {
    return this.workspace.config[this.cmd];
  }

  get globs() {
    return {
      sources: {
        internals: this.config?.src?.internals || [],
        deps: this.config?.src?.deps || [],
        root: this.config?.src?.root || [],
      },
      artifacts: this.config?.artifacts || [],
    }
  }

  async resolveSources(): Promise<Array<string>> {
    this.logger?.debug('Resolving sources path for command', this.cmd, 'on workspace', this.workspace.name);
    const project = this.workspace.project;
    if (!project) {
      throw new MilaError(MilaErrorCode.PROJECT_NOT_RESOLVED, `Assertion failed: Project not resolved for current workspace ${this.workspace.name}`);
    }
    const projectRoot = project.root;
    const files = new Set<string>();



    const resolveGlobs = (globs: string[], relativeTo: string) => {
      const paths = this._resolveGlobs(globs, relativeTo);
      paths.forEach((p) => files.add(p));
    }

    resolveGlobs(this.globs.sources.internals, this.workspace.root);
    resolveGlobs(this.globs.sources.root, projectRoot);
    for (const dep of this.workspace.ancestors.values()) {
      resolveGlobs(this.globs.sources.deps, dep.root);
    }

    return Array.from(files);
  }

  async resolveArtifacts(): Promise<Array<string>> {
    this.logger?.debug('Resolving artifacts path for command', this.cmd, 'on workspace', this.workspace.name);
    const paths = this._resolveGlobs(this.globs.artifacts, this.workspace.root);
    return Array.from(new Set(paths));
  }

  private _resolveGlobs(globs: string[], relativeTo: string) {
    return globs.map((s) => glob(join(relativeTo, s))).reduce((acc, val) => {
      acc = acc.concat(val);
      return acc;
    }, []);
  }
}
