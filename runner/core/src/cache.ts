import { promises as fs } from 'fs';
import { Checksum } from './checksum';
import { Workspace } from './workspace';
import { join } from 'path';
import { F_OK } from 'constants';
import chalk from 'chalk';
import { isEqual } from 'lodash';
import { ICommandResult } from './process';
import { MilaError, MilaErrorCode } from "@microlambda/errors";
import { EventsLog, EventsLogger } from '@microlambda/logger';
import { ITargetConfig } from '@microlambda/config';

export interface ICacheOptions {
  dir?: string;
}

export class Cache {
  private readonly _cacheFolder: string;
  private readonly _logger: EventsLogger | undefined;
  static readonly scope = '@microlambda/runner-core/cache';

  constructor (
    private readonly _workspace: Workspace,
    private readonly _cmd: string,
    private readonly _args: string[] | string = [],
    private readonly _env: {[key: string]: string} = {},
    private readonly _options: ICacheOptions = {},
    private readonly _eventsLog?: EventsLog,
  ) {
    this._cacheFolder = join(this._workspace.root, '.caches', this._options.dir || this._cmd);
    this._logger = this._eventsLog?.scope(Cache.scope);
  }

  get args(): string[] | string { return this._args };
  get env(): {[key: string]: string} { return this._env };

  get cacheFolder(): string {
    return this._cacheFolder;
  }

  get outputPath(): string {
    return join(this.cacheFolder, 'output.json');
  }

  get config(): ITargetConfig {
    return this.workspace.config[this._cmd];
  }

  get workspace(): Workspace {
    return this._workspace;
  }

  private _checksums: Record<string, string> | undefined;

  async read(): Promise<Array<ICommandResult> | null> {
    if (!this.config.src) {
      return null;
    }
    try {
      const checksums = new Checksum(this);
      const [currentChecksums, storedChecksum] = await Promise.all([
        checksums.calculate(),
        checksums.read(),
      ]);
      this._checksums = currentChecksums;
      if (!isEqual(currentChecksums, storedChecksum)) {
        return null;
      }
      const output = await fs.readFile(this.outputPath);
      return JSON.parse(output.toString());
    } catch (e) {
      if ((e as MilaError).code === MilaErrorCode.NO_FILES_TO_CACHE) {
        this._logger?.warn(chalk.yellow(`Patterns ${this.config.src.join('|')} has no match: ignoring cache`, e));
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
      const checksums = new Checksum(this)
      const toWrite = this._checksums ?? await checksums.calculate();
      await this._createCacheDirectory();
      await Promise.all([
        fs.writeFile(checksums.checksumPath, JSON.stringify(toWrite)),
        fs.writeFile(this.outputPath, JSON.stringify(output)),
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
      const checksums = new Checksum(this);
      const exists = async (path: string): Promise<boolean> => {
        try {
          await fs.access(path, F_OK);
          return true;
        } catch (e) {
          if ((e as { code: string }).code === 'ENOENT') {
            return false;
          }
          throw e;
        }
      };
      const removeIfExists = async (path: string): Promise<void> => {
        if (await exists(path)) {
          await fs.unlink(path);
        }
      };
      await Promise.all([
        removeIfExists(checksums.checksumPath),
        removeIfExists(this.outputPath),
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
