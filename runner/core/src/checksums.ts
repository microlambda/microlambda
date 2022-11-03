import { fromFile } from 'hasha';
import { MilaError, MilaErrorCode } from "@microlambda/errors";
import { fs as fsUtils } from '@microlambda/utils';
import { GlobsHelpers } from './globs';
import { EventsLog } from '@microlambda/logger';
import { Workspace } from './workspace';
import { ICommandConfig, isScriptTarget, ITargetConfig } from '@microlambda/config';
import { isEqual } from 'lodash';

interface ICommonChecksums {
  cmd: string[] | string | ICommandConfig | ICommandConfig[];
  args: string[] | string;
  env: Record<string, string>;
  checksums: Record<string, string>;
}

export interface ISourcesChecksums extends ICommonChecksums {
  globs: {
    internals: string[];
    deps: string[];
    root: string[];
  };
}

export interface IArtifactsChecksums extends ICommonChecksums{
  globs: string[];
}

type IChecksums = ISourcesChecksums | IArtifactsChecksums;

export const resolveCommands = (config: ITargetConfig, workspace: Workspace): Array<ICommandConfig> => {
  if (isScriptTarget(config)) {
    const result: ICommandConfig = { run: workspace.resolveScript(config.script)! };
    if (config.daemon) {
      result.daemon = config.daemon;
    }
    if (config.daemon) {
      result.env = config.env;
    }
    return [result];
  }
  const reformatCommand = (cmd: string | ICommandConfig): ICommandConfig => {
    if (typeof cmd === 'string') {
      return { run: cmd }
    }
    return cmd;
  }
  if (Array.isArray(config.cmd)) {
    return config.cmd.map((reformatCommand));
  }
  return [reformatCommand(config.cmd)];
}

export class Checksums {
  constructor (
    readonly workspace: Workspace,
    readonly cmd: string | ITargetConfig,
    readonly args: string[] | string = [],
    readonly env: {[key: string]: string} = {},
    readonly eventsLog?: EventsLog,
  ) {}

  get config(): ITargetConfig | undefined {
    return typeof this.cmd === 'string' ? this.workspace.config[this.cmd] : this.cmd;
  }

  static compare(current: IChecksums, stored: IChecksums): boolean {
    return isEqual(current, stored);
  }

  async calculate(): Promise<ISourcesChecksums> {
    const config = this.config;
    if (!config?.src) {
      throw new MilaError(MilaErrorCode.CACHE_DISABLED, 'Asked to compute checksums whereas cache is disabled by config');
    }
    const globs = new GlobsHelpers(this.workspace, this.cmd, this.eventsLog);
    const src = await globs.resolveSources();
    if (!src.length) {
      throw new MilaError(MilaErrorCode.NO_FILES_TO_CACHE, 'No path to cache');
    }
    const checksums = await this.computeHash(src);
    return {
      cmd: resolveCommands(config, this.workspace),
      globs: globs.globs.sources,
      args: this.args,
      env: this.env,
      checksums,
    };
  }

  async computeHash(paths: string[]): Promise<Record<string, string>> {
    const checksums: Record<string, string> = {};
    const chunks: string[][] = [];
    const CHUNK_SIZE = 100;
    for (let i = 0; i < paths.length; i += CHUNK_SIZE) {
      const chunk = paths.slice(i, i + CHUNK_SIZE);
      chunks.push(chunk);
    }

    for (const chunk of chunks) {
      await Promise.all(chunk.map(async (path) => {
        const exists = await fsUtils.exists(path);
        if (exists) {
          checksums[path] = await fromFile(path, { algorithm: 'sha256' });
        }
      }));
    }
    return checksums;
  }
}
