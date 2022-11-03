import { Checksums, ISourcesChecksums } from '../checksums';
import { Workspace } from '../workspace';
import chalk from 'chalk';
import { ICommandResult } from '../process';
import { MilaError, MilaErrorCode } from "@microlambda/errors";
import { EventsLogger } from '@microlambda/logger';
import { ITargetConfig } from '@microlambda/config';

export abstract class Cache {
  protected readonly _logger: EventsLogger | undefined;

  protected constructor (
    readonly workspace: Workspace,
    readonly cmd: string,
    readonly args: string[] | string = [],
    readonly env: {[key: string]: string} = {},
    readonly logger?: EventsLogger,
  ) {}

  get config(): ITargetConfig {
    return this.workspace.config[this.cmd];
  }

  private _checksums: ISourcesChecksums | undefined;

  protected abstract _readChecksums(): Promise<ISourcesChecksums>;
  protected abstract _readOutput(): Promise<Array<ICommandResult>>;
  protected abstract _writeChecksums(checksums: ISourcesChecksums): Promise<void>;
  protected abstract _writeOutput(output: Array<ICommandResult>): Promise<void>;
  protected abstract _removeChecksums(): Promise<void>;
  protected abstract _removeOutput(): Promise<void>;

  async read(): Promise<Array<ICommandResult> | null> {
    if (!this.config.src) {
      this._logger?.warn('No sources declared in config, skipping cache');
      return null;
    }
    try {
      this._logger?.debug('Calculating checksums');
      const checksums = new Checksums(this.workspace, this.cmd, this.args, this.env, this.logger?.logger);
      const [currentChecksums, storedChecksum] = await Promise.all([
        checksums.calculate(),
        this._readChecksums(),
      ]);
      this._logger?.debug({currentChecksums, storedChecksum});
      this._checksums = currentChecksums;
      if (!Checksums.compare(currentChecksums, storedChecksum)) {
        this._logger?.debug('IS NOT SAME');
        return null;
      }
      this._logger?.debug('IS SAME');
      return await this._readOutput();
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
      const checksums = new Checksums(this.workspace, this.cmd, this.args, this.env, this.logger?.logger);
      const toWrite = this._checksums ?? await checksums.calculate();
      this._logger?.debug('Writing checksums');
      await Promise.all([
        this._writeChecksums(toWrite),
        this._writeOutput(output),
      ]);
      this._logger?.info('Checksums written !');
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
      await Promise.all([
        this._removeChecksums(),
        this._removeOutput(),
      ]);
    } catch (e) {
      this._logger?.warn('Error invalidating cache. Next command runs could have unexpected result !', e);
    }
  }
}
