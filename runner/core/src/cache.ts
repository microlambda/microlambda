import { promises as fs } from 'fs';
import { Checksums, ISourcesChecksums } from './checksums';
import { Workspace } from './workspace';
import { join } from 'path';
import { F_OK } from 'constants';
import chalk from 'chalk';
import { ICommandResult } from './process';
import { MilaError, MilaErrorCode } from "@microlambda/errors";
import { EventsLog, EventsLogger } from '@microlambda/logger';
import { ITargetConfig } from '@microlambda/config';
import { fs as fsUtils } from '@microlambda/utils';

export class Cache {
  private readonly _logger: EventsLogger | undefined;
  static readonly scope = '@microlambda/runner-core/cache';

  constructor (
    readonly workspace: Workspace,
    readonly cmd: string,
    readonly args: string[] | string = [],
    readonly env: {[key: string]: string} = {},
    readonly eventsLog?: EventsLog,
  ) {
    this._logger = this.eventsLog?.scope(Cache.scope);
  }

  static cacheFolder(workspace: Workspace, cmd: string) {
    return join(workspace.root, '.caches', cmd);
  }

  get cacheFolder() {
    return Cache.cacheFolder(this.workspace, this.cmd);
  }

  get outputPath(): string {
    return join(this.cacheFolder, 'output.json');
  }

  get config(): ITargetConfig {
    return this.workspace.config[this.cmd];
  }

  private _checksums: ISourcesChecksums | undefined;

  async read(): Promise<Array<ICommandResult> | null> {
    if (!this.config.src) {
      return null;
    }
    try {
      const checksums = new Checksums(this.workspace, this.cmd, this.args, this.env, this.eventsLog);
      const [currentChecksums, storedChecksum] = await Promise.all([
        checksums.calculate(),
        checksums.read(),
      ]);
      this._checksums = currentChecksums;
      if (!Checksums.compare(currentChecksums, storedChecksum)) {
        return null;
      }
      const output = await fs.readFile(this.outputPath);
      return JSON.parse(output.toString());
    } catch (e) {
      if ((e as MilaError).code === MilaErrorCode.NO_FILES_TO_CACHE) {
        this._logger?.warn(chalk.yellow(`Patterns ${JSON.stringify(this.config.src)} has no match: ignoring cache`, e));
        return null;
      }
      this._logger?.warn('Cannot read from cache', e);
      return null;
    }
  }

  async write(output: Array<ICommandResult>): Promise<void> {
    if (!this.config.src) {
      return;
    }
    try {
      const checksums = new Checksums(this.workspace, this.cmd, this.args, this.env, this.eventsLog);
      const toWrite = this._checksums ?? await checksums.calculate();
      await this._createCacheDirectory();
      await Promise.all([
        fs.writeFile(checksums.checksumPath, JSON.stringify(toWrite, null, 2)),
        fs.writeFile(this.outputPath, JSON.stringify(output, null, 2)),
      ]);
    } catch (e) {
      this._logger?.warn('Error writing cache', e);
      await this.invalidate();
    }
  }

  async invalidate(): Promise<void> {
    if (!this.config.src) {
      return;
    }
    try {
      const checksums = new Checksums(this.workspace, this.cmd, this.args, this.env, this.eventsLog);
      await Promise.all([
        fsUtils.removeIfExists(checksums.checksumPath),
        fsUtils.removeIfExists(this.outputPath),
      ]);
    } catch (e) {
      throw new MilaError(MilaErrorCode.INVALIDATING_CACHE_FAILED, 'Fatal: error invalidating cache. Next command runs could have unexpected result !', e);
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
