import { EventsLog } from '@microlambda/logger';
import { Workspace } from '../workspace';
import { IArtifactsChecksums } from '../checksums';
import { ITargetConfig } from '@microlambda/config';
import { RemoteCache } from '../cache/remote-cache';
import { Artifacts } from './artifacts';
import { aws } from '@microlambda/aws';
import { currentSha1 } from '../remote-cache-utils';
import { PassThrough } from 'stream';
import { compress, extract } from '../archive';
import { MilaError, MilaErrorCode } from '@microlambda/errors';

export class RemoteArtifacts extends Artifacts {

  static readonly scope = 'runner-core/artifacts-remote';

  constructor(
    readonly awsRegion: string,
    readonly bucket: string,
    readonly workspace: Workspace,
    readonly cmd: string,
    readonly sha1?: string,
    readonly args: string[] | string = [],
    readonly env: {[key: string]: string} = {},
    readonly eventsLog?: EventsLog,
  ) {
    super(workspace, cmd, args, env, eventsLog?.scope(RemoteArtifacts.scope));
  }

  get config(): ITargetConfig | undefined {
    return this.workspace.config[this.cmd];
  }

  get currentArtifactsChecksumsKey(): string {
    return `${RemoteCache.cacheKey(this.workspace, this.cmd, currentSha1())}/artifacts.json`;
  }

  get storedArtifactsChecksumsKey(): string {
    if (!this.sha1) {
      throw new MilaError(MilaErrorCode.BAD_REVISION, 'Cannot retrieve artifacts checksums from previous execution, no relative sha1 were given');
    }
    return `${RemoteCache.cacheKey(this.workspace, this.cmd, this.sha1)}/artifacts.json`;
  }

  get currentArtifactsZipKey(): string {
    return `${RemoteCache.cacheKey(this.workspace, this.cmd, currentSha1())}/artifacts.zip`;
  }

  get storedArtifactsZipKey(): string {
    if (!this.sha1) {
      throw new MilaError(MilaErrorCode.BAD_REVISION, 'Cannot retrieve artifacts from previous execution, no relative sha1 were given');
    }
    return `${RemoteCache.cacheKey(this.workspace, this.cmd, this.sha1)}/artifacts.zip`;
  }

  async downloadArtifacts(): Promise<void> {
    try {
      const downloadStream = await aws.s3.downloadStream(this.bucket, this.storedArtifactsChecksumsKey, this.awsRegion);
      await extract(downloadStream, this.workspace.root);
    } catch (e) {
      this.logger?.error('Error downloading artifacts', this.bucket, this.currentArtifactsZipKey);
      this.logger?.error(e);
      throw new MilaError(MilaErrorCode.ERROR_DOWNLOADING_ARTIFACTS, 'Cannot retrieve artifacts from previous execution. Error downloading from S3', e);
    }
  }

  async uploadArtifacts(): Promise<void> {
    const artifacts = await this._resolveArtifactsPaths();
    const archiveStream = await compress(artifacts, this.workspace.root);
    try {
      const passThroughStream = new PassThrough();
      archiveStream.on('end', () => passThroughStream.end());
      archiveStream.pipe(passThroughStream);
      await aws.s3.uploadStream(this.bucket, this.currentArtifactsZipKey, passThroughStream, this.awsRegion);
    } catch (e) {
      this.logger?.error('Error uploading artifacts', this.bucket, this.currentArtifactsZipKey);
      this.logger?.error(e);
    }
  }

  protected async _write(data: IArtifactsChecksums): Promise<void> {
    await aws.s3.putObject(this.bucket, this.currentArtifactsChecksumsKey, this._serialize(data), this.awsRegion);
  }

  protected async _read(): Promise<IArtifactsChecksums> {
    try {
      const checksums = await aws.s3.downloadBuffer(this.bucket, this.storedArtifactsChecksumsKey, this.awsRegion);
      return checksums ? JSON.parse(checksums.toString('utf-8')) : {};
    } catch (e) {
      return {} as IArtifactsChecksums;
    }
  }
}
