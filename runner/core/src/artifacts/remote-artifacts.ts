import { EventsLog } from '@microlambda/logger';
import { Workspace } from '../workspace';
import { IArtifactsChecksums } from '../checksums';
import { ITargetConfig } from '@microlambda/config';
import { RemoteCache } from '../cache/remote-cache';
import { Artifacts } from './artifacts';
import { aws } from '@microlambda/aws';
import { execSync } from 'child_process';

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

  get currentSha1(): string {
    return execSync('git rev-parse HEAD').toString().trim();
  }

  get currentArtifactsKey(): string {
    return `${RemoteCache.cacheKey(this.workspace, this.cmd, this.sha1)}/artifacts.json`;
  }

  protected async _write(data: IArtifactsChecksums): Promise<void> {
    await aws.s3.putObject(this.bucket, this.artifactsKey, this._serialize(data), this.awsRegion);
  }

  protected async _read(): Promise<IArtifactsChecksums> {
    try {
      const checksums = await aws.s3.downloadStream(this.bucket, this.artifactsKey, this.awsRegion);
      return checksums ? JSON.parse(checksums.toString('utf-8')) : {};
    } catch (e) {
      return {} as IArtifactsChecksums;
    }
  }
}
