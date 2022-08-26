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
      console.debug('Fetching artifact at', `s3://${this.bucket}/${this.storedArtifactsZipKey}`);
      const exists = await aws.s3.objectExists(this.awsRegion, this.bucket, this.storedArtifactsZipKey);
      console.info('Artifacts.zip exists on S3', exists);
      if (exists) {
        const downloadStream = await aws.s3.downloadStream(this.bucket, this.storedArtifactsZipKey, this.awsRegion);
        await extract(downloadStream, this.workspace.root);
        console.debug('Artifacts unzipped');
      }
    } catch (e) {
      console.error('Error downloading/unzipping artifacts');
      this.logger?.error('Error downloading artifacts', this.bucket, this.storedArtifactsZipKey);
      this.logger?.error(e);
    }
  }

  async uploadArtifacts(): Promise<void> {
    try {
      console.debug('Uploading artifact at', `s3://${this.bucket}/${this.currentArtifactsZipKey}`);
      const artifacts = await this._resolveArtifactsPaths();
      const tar = await compress(artifacts, this.workspace.root);
      const { writeStream, done } = await aws.s3.uploadStream(this.bucket, this.currentArtifactsZipKey, this.awsRegion, console);
      await tar.write((stream) => {
        return stream.pipe(writeStream)
      });
      try {
        await done;
        console.debug('done s3');
      } catch (e) {
        console.debug('errs3', e)
      }
      console.debug('Artifact uploaded');
    } catch (e) {
      console.error('Error uploading artifacts', this.bucket, this.currentArtifactsZipKey);
      console.error(e);
      this.logger?.error(e);
    }
  }

  protected async _write(data: IArtifactsChecksums): Promise<void> {
    await aws.s3.putObject(this.bucket, this.currentArtifactsChecksumsKey, this._serialize(data), this.awsRegion);
    console.debug('Checksums written, uploading artifacts');
    await this.uploadArtifacts();
    console.debug('Artifacts and checksums uploaded');
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
