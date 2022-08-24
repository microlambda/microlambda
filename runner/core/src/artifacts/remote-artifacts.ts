import { EventsLog } from '@microlambda/logger';
import { Workspace } from '../workspace';
import { IArtifactsChecksums } from '../checksums';
import { ITargetConfig } from '@microlambda/config';
import { RemoteCache } from '../cache/remote-cache';
import { Artifacts } from './artifacts';
import { aws } from '@microlambda/aws';
import { currentSha1 } from '../remote-cache-utils';
import { PassThrough } from 'stream';
import archiver from 'archiver';
import { createReadStream } from 'fs';
import { relative } from 'path';
import { MilaError } from '@microlambda/errors';

export class RemoteArtifacts extends Artifacts {

  static readonly scope = 'runner-core/artifacts-remote';

  constructor(
    readonly awsRegion: string,
    readonly bucket: string,
    readonly workspace: Workspace,
    readonly cmd: string,
    readonly sha1: string,
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
    return `${RemoteCache.cacheKey(this.workspace, this.cmd, this.sha1)}/artifacts.json`;
  }

  get currentArtifactsZipKey(): string {
    return `${RemoteCache.cacheKey(this.workspace, this.cmd, currentSha1())}/artifacts.zip`;
  }

  get storedArtifactsZipKey(): string {
    return `${RemoteCache.cacheKey(this.workspace, this.cmd, this.sha1)}/artifacts.zip`;
  }

  async downloadArtifacts(): Promise<void> {

  }

  async uploadArtifacts(): Promise<void> {
    const artifacts = await this._resolveArtifactsPaths();
    const uploadStream = new PassThrough();
    const archive = archiver("zip", {
      zlib: { level: 4 },
    });
    artifacts.map((absolutePath) => {
      archive.append(createReadStream(absolutePath), { name: relative(this.workspace.root, absolutePath) });
    });
    archive.on("warning", (err) => {
      throw new MilaError(MilaError.ERROR_ZIPPING_ARTIFACTS, 'Cannot create zip file for artifacts', err);
    });
    archive.on("error", (err) => {
      throw new MilaError(MilaError.ERROR_ZIPPING_ARTIFACTS, 'Cannot create zip file for artifacts', err);
    });
    archive.on("end", function () {
      console.log("archive end")
    });
    try {
      await aws.s3.uploadStream(this.bucket, this.currentArtifactsZipKey, uploadStream, this.awsRegion);
    } catch (e) {
      this.logger?.error('Error uploading artifacts', this.bucket, this.currentArtifactsZipKey);
    }
  }

  protected async _write(data: IArtifactsChecksums): Promise<void> {
    await aws.s3.putObject(this.bucket, this.currentArtifactsChecksumsKey, this._serialize(data), this.awsRegion);
  }

  protected async _read(): Promise<IArtifactsChecksums> {
    try {
      const checksums = await aws.s3.downloadStream(this.bucket, this.storedArtifactsChecksumsKey, this.awsRegion);
      return checksums ? JSON.parse(checksums.toString('utf-8')) : {};
    } catch (e) {
      return {} as IArtifactsChecksums;
    }
  }
}
