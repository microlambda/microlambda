import { fromFile } from 'hasha';
import { MilaError, MilaErrorCode } from "@microlambda/errors";
import { fs as fsUtils } from '@microlambda/utils';
import { GlobsHelpers } from './globs';
import { EventsLog } from '@microlambda/logger';
import { Workspace } from './workspace';
import { ICommandConfig, ITargetConfig } from '@microlambda/config';
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

export class Checksums {
  constructor (
    readonly workspace: Workspace,
    readonly cmd: string,
    readonly args: string[] | string = [],
    readonly env: {[key: string]: string} = {},
    readonly eventsLog?: EventsLog,
  ) {}

  get config(): ITargetConfig | undefined {
    return this.workspace.config[this.cmd];
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
      cmd: config.cmd,
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
