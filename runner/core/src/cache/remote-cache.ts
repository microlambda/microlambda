import { ISourcesChecksums } from '../checksums';
import { Workspace } from '../workspace';
import { ICommandResult } from '../process';
import { EventsLog } from '@microlambda/logger';
import { aws } from '@microlambda/aws';
import { Cache } from './cache';
import { currentSha1 } from '../remote-cache-utils';
import { MilaError, MilaErrorCode } from '@microlambda/errors';

export class RemoteCache extends Cache {
  static readonly scope = '@microlambda/runner-core/remote-cache';

  constructor (
    readonly awsRegion: string,
    readonly bucket: string,
    readonly workspace: Workspace,
    readonly cmd: string,
    readonly sha1?: string,
    readonly args: string[] | string = [],
    readonly env: {[key: string]: string} = {},
    readonly eventsLog?: EventsLog,
    private readonly _cachePrefix?: string,
  ) {
    super(workspace, cmd, args, env, eventsLog?.scope(RemoteCache.scope));
  }

  static cachePrefix(workspace: Workspace, cmd: string): string {
    return `caches/${workspace.name}/${cmd}`;
  }

  get cachePrefix(): string {
    return this._cachePrefix || RemoteCache.cachePrefix(this.workspace, this.cmd);
  }

  get currentChecksumsKey(): string {
    return `${this.cachePrefix}/${currentSha1(this.workspace.project?.root)}/checksums.json`;
  }

  get storedChecksumsKey(): string {
    if (!this.sha1) {
      throw new MilaError(MilaErrorCode.BAD_REVISION, 'Cannot compare checksums to previous execution, no relative sha1 were given');
    }
    return `${this.cachePrefix}/${this.sha1}/checksums.json`;
  }

  get storedOutputKey(): string {
    if (!this.sha1) {
      throw new MilaError(MilaErrorCode.BAD_REVISION, 'Cannot compare checksums to previous execution, no relative sha1 were given');
    }
    return `${this.cachePrefix}/${this.sha1}/outputs.json`;
  }

  get currentOutputKey(): string {
    return `${this.cachePrefix}/${currentSha1(this.workspace.project?.root)}/outputs.json`;
  }

  protected async _readChecksums(): Promise<ISourcesChecksums> {
    try {
      this.logger?.debug('Reading checksums from S3', this.bucket, this.storedChecksumsKey, this.awsRegion);
      const raw = await aws.s3.downloadBuffer(this.bucket, this.storedChecksumsKey, this.awsRegion);
      this.logger?.debug('S3 raw response', raw);
      if (!raw) {
        return {} as ISourcesChecksums;
      }
      return JSON.parse(raw.toString('utf-8'));
    } catch (e) {
      this.logger?.warn('Error reading checksums from AWS', e);
      return {} as ISourcesChecksums;
    }
  }
  protected async _readOutput(): Promise<ICommandResult[]> {
    let raw: string | undefined;
    try {
      const buffer = await aws.s3.downloadBuffer(this.bucket, this.storedOutputKey, this.awsRegion);
      raw = buffer?.toString('utf-8');
    } catch (e) {
      this.logger?.warn('Error reading output from AWS', e);
      throw e;
    }
    if (!raw) {
      throw new Error('Empty outputs');
    }
    try {
      return JSON.parse(raw);
    } catch(e) {
      this.logger?.warn('Error parsing output from AWS', e);
      throw e;
    }
  }

  protected async _writeChecksums(checksums: ISourcesChecksums): Promise<void> {
    await aws.s3.putObject(this.bucket, this.currentChecksumsKey, JSON.stringify(checksums, null, 2), this.awsRegion)
  }

  protected async _writeOutput(output: ICommandResult[]): Promise<void> {
    await aws.s3.putObject(this.bucket, this.currentOutputKey, JSON.stringify(output, null, 2), this.awsRegion);
  }

  protected async _removeChecksums(): Promise<void> {
    /* nothing to do */
  }
  protected async _removeOutput(): Promise<void> {
    /* nothing to do */
  }
}
