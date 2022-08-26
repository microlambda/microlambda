import { EventsLogger } from '@microlambda/logger';
import { Workspace } from '../workspace';
import { GlobsHelpers } from '../globs';
import { Checksums, IArtifactsChecksums } from '../checksums';
import { ITargetConfig } from '@microlambda/config';
import { MilaError, MilaErrorCode } from '@microlambda/errors';
import { fs as fsUtils } from '@microlambda/utils';

export abstract class Artifacts {

  protected constructor(
    readonly workspace: Workspace,
    readonly cmd: string,
    readonly args: string[] | string = [],
    readonly env: {[key: string]: string} = {},
    protected readonly logger?: EventsLogger,
  ) {}

  protected _currentChecksums: IArtifactsChecksums | undefined;

  get config(): ITargetConfig | undefined {
    return this.workspace.config[this.cmd];
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
    this._currentChecksums = await this._calculateArtifactsChecksums(this.config);
    this.logger?.debug('current');
    this.logger?.debug(this._currentChecksums);
    const stored = await this._read();
    this.logger?.debug('stored');
    this.logger?.debug(stored);
    return Checksums.compare(this._currentChecksums, stored);
  }

  protected abstract _read(): Promise<IArtifactsChecksums>;
  protected  abstract _write(data: IArtifactsChecksums): Promise<void>;

  private async _calculateArtifactsChecksums(config: ITargetConfig): Promise<IArtifactsChecksums> {
    const artifacts = await this._resolveArtifactsPaths();
    const checksums = new Checksums(this.workspace, this.cmd, this.args, this.env, this.logger?.logger);
    return {
      cmd: config.cmd,
      args: this.args,
      globs: config.artifacts || [],
      env: this.env,
      checksums: await checksums.computeHash(artifacts)
    };
  }

  /**
   * Remove artifacts for a given command. This is useful when --force is used
   * we clean previous artifacts
   */
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
    if (!this.config) {
      throw new MilaError(MilaErrorCode.NO_CONFIG_FOR_TARGET, `No config found for target ${this.cmd}`)
    }
    if (!this.config?.artifacts) {
      this.logger?.info('No artifact to upload');
      return;
    }
    try {
      const toWrite = this._currentChecksums ?? await this._calculateArtifactsChecksums(this.config);
      this.logger?.debug('Writing artifact checksums');
      await this._write(toWrite);
    } catch (e) {
      this.logger?.warn('Error writing artifacts checksums', e);
    }
  }

  protected _serialize(data: IArtifactsChecksums): string {
    return JSON.stringify(data, null, 2);
  }

  protected async _resolveArtifactsPaths(): Promise<Array<string>> {
    this.logger?.debug('Resolving artifacts for workspace', this.workspace.name);
    const globs = new GlobsHelpers(this.workspace, this.cmd, this.logger?.logger);
    const artifacts = await globs.resolveArtifacts();
    this.logger?.debug('Artifacts resolved for workspace', this.workspace.name, artifacts);
    return artifacts;
  }
}
