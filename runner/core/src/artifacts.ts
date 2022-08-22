import { EventsLog, EventsLogger } from '@microlambda/logger';
import { Workspace } from './workspace';
import { GlobsHelpers } from './globs';
import { fs as fsUtils } from '@microlambda/utils';
import { Checksums, IArtifactsChecksums } from './checksums';
import { Cache } from './cache';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ITargetConfig } from '@microlambda/config';
import { MilaError, MilaErrorCode } from '@microlambda/errors';

export class Artifacts {

  private readonly logger: EventsLogger | undefined;
  static readonly scope = 'runner-core/artifacts';

  constructor(
    readonly workspace: Workspace,
    readonly cmd: string,
    readonly args: string[] | string = [],
    readonly env: {[key: string]: string} = {},
    readonly eventsLog?: EventsLog,
  ) {
    this.logger = eventsLog?.scope(Artifacts.scope);
  }

  private _currentChecksums: IArtifactsChecksums | undefined;

  get config(): ITargetConfig | undefined {
    return this.workspace.config[this.cmd];
  }

  get cacheFolder(): string {
    return Cache.cacheFolder(this.workspace, this.cmd);
  }

  get cachePath(): string {
    return join(this.cacheFolder, 'artifacts.json');
  }

  /**
   * When sources for a given command has not changed, verify that the produced artifacts
   * are up-to-date with checksums.
   * If not, the command should be re-run by the Runner
   */
  async checkArtifacts(): Promise<boolean> {
    if (!this.config) {
      throw new MilaError(MilaErrorCode.NO_CONFIG_FOR_TARGET, `No config found for target ${this.cmd}`)
    }
    if (!this.config.artifacts) {
      return true;
    }
    const artifacts = await this._resolveArtifactsPaths();
    const checksums = new Checksums(this.workspace, this.cmd, this.args, this.env, this.eventsLog);
    this._currentChecksums = {
      cmd: this.config.cmd,
      args: this.args,
      globs: this.config.artifacts || [],
      env: this.env,
      checksums: await checksums.computeHash(artifacts)
    };
    const stored = await this._read();
    return Checksums.compare(this._currentChecksums, stored);
  }

  /**
   * Remove artifacts for a given command. This is useful when --force is used
   * we clean previous artifacts
   */
  async removeArtifacts(): Promise<void> {
    if (!this.config?.artifacts) {
      return;
    }
    const artifacts = await this._resolveArtifactsPaths();
    await Promise.all(artifacts.map((file) => fsUtils.removeIfExists(file)));
  }

  async write(): Promise<void> {
    if (!this.config?.artifacts) {
      return;
    }
    try {
      const toWrite = this._currentChecksums ?? await new Checksums(this.workspace, this.cmd, this.args, this.env, this.eventsLog).calculate();
      await fs.writeFile(this.cachePath, JSON.stringify(toWrite, null, 2))
    } catch (e) {
      this.logger?.warn('Error writing artifacts checksums', e);
    }
  }

  private async _read(): Promise<IArtifactsChecksums> {
    try {
      const checksums = await fs.readFile(this.cachePath);
      return JSON.parse(checksums.toString());
    } catch (e) {
      return {} as IArtifactsChecksums;
    }
  }

  private async _resolveArtifactsPaths(): Promise<Array<string>> {
    this.logger?.debug('Resolving artifacts for workspace', this.workspace.name);
    const globs = new GlobsHelpers(this.workspace, this.cmd, this.eventsLog);
    const artifacts = await globs.resolveArtifacts();
    this.logger?.debug('Artifacts resolved for workspace', this.workspace.name, artifacts);
    return artifacts;
  }
}
