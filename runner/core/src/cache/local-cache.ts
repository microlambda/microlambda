import { promises as fs } from 'fs';
import { ISourcesChecksums } from '../checksums';
import { Workspace } from '../workspace';
import { join } from 'path';
import { F_OK } from 'constants';
import { ICommandResult } from '../process';
import { EventsLog } from '@microlambda/logger';
import { fs as fsUtils } from '@microlambda/utils';
import { Cache } from './cache';

export class LocalCache extends Cache {

  static readonly scope = '@microlambda/runner-core/cache';

  constructor (
    readonly workspace: Workspace,
    readonly cmd: string,
    readonly args: string[] | string = [],
    readonly env: {[key: string]: string} = {},
    readonly eventsLog?: EventsLog,
  ) {
    super(workspace, cmd, args, env, eventsLog?.scope(LocalCache.scope));
  }

  private _creatingCacheDirectory: Promise<void> | undefined;

  static cacheFolder(workspace: Workspace, cmd: string): string {
    return join(workspace.root, '.caches', cmd);
  }

  get cacheFolder(): string {
    return LocalCache.cacheFolder(this.workspace, this.cmd);
  }

  get outputPath(): string {
    return join(this.cacheFolder, 'output.json');
  }

  get checksumsPath(): string {
    return join(this.cacheFolder, 'checksums.json');
  }

  protected async _readChecksums(): Promise<ISourcesChecksums> {
    try {
      const checksums = await fs.readFile(this.checksumsPath);
      return JSON.parse(checksums.toString());
    } catch (e) {
      return {} as ISourcesChecksums;
    }
  }
  protected async _readOutput(): Promise<ICommandResult[]> {
    const raw = await fs.readFile(this.outputPath);
    return JSON.parse(raw.toString());
  }
  protected async _writeChecksums(checksums: ISourcesChecksums): Promise<void> {
    await this._ensureCacheDirectoryExists();
    await fs.writeFile(this.checksumsPath, JSON.stringify(checksums, null, 2));
  }

  protected async _writeOutput(output: ICommandResult[]): Promise<void> {
    await this._ensureCacheDirectoryExists();
    await fs.writeFile(this.outputPath, JSON.stringify(output, null, 2));
  }

  protected async _removeChecksums(): Promise<void> {
    await fsUtils.removeIfExists(this.checksumsPath);
  }
  protected async _removeOutput(): Promise<void> {
    await fsUtils.removeIfExists(this.outputPath);
  }

  private async _ensureCacheDirectoryExists(): Promise<void> {
    if (this._creatingCacheDirectory) {
      await this._creatingCacheDirectory;
    } else {
      await this._createCacheDirectory();
    }
  }

  private async _createCacheDirectory(): Promise<void> {
    try {
      await fs.access(this.cacheFolder, F_OK);
    } catch (e) {
      await fs.mkdir(this.cacheFolder, { recursive: true });
    }
  }
}
