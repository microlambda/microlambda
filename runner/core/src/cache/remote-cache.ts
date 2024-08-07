import { ISourcesChecksums } from '../checksums';
import { Workspace } from '../workspace';
import { ICommandResult } from '../process';
import {EventsLog, EventsLogger} from '@microlambda/logger';
import { aws } from '@microlambda/aws';
import { Cache } from './cache';
import { currentSha1 } from '../remote-cache-utils';
import {git} from "../git";
import {ICmdExecution, State} from "@microlambda/remote-state";

export class RemoteCache extends Cache {
  static readonly scope = '@microlambda/runner-core/remote-cache';
  private readonly _state: State;

  readonly date: Date;
  constructor (
    readonly awsRegion: string,
    readonly bucket: string,
    readonly table: string,
    readonly workspace: Workspace,
    readonly cmd: string,
    readonly affected?: string,
    readonly args: string[] | string = [],
    readonly env: {[key: string]: string} = {},
    readonly eventsLog?: EventsLog,
    private readonly _cachePrefix?: string,
  ) {
    super(workspace, cmd, args, env, eventsLog?.scope('cache'));
    this._state = new State(this.table, this.awsRegion);
    this.date = new Date();
  }

  static cachePrefix(workspace: Workspace, cmd: string): string {
    return `caches/${workspace.name}/${cmd}`;
  }

  get cachePrefix(): string {
    return this._cachePrefix || RemoteCache.cachePrefix(this.workspace, this.cmd);
  }

  get currentChecksumsKey(): string {
    return `${this.cachePrefix}/${currentSha1(this.workspace.project?.root)}/${this.date.toISOString()}/checksums.json`;
  }

  get currentOutputKey(): string {
    return `${this.cachePrefix}/${currentSha1(this.workspace.project?.root)}/${this.date.toISOString()}/outputs.json`;
  }

  private async _getStoredExecution(): Promise<ICmdExecution | undefined> {
    this.logger?.debug('Last stored execution');
    if (!this.affected) {
      this.logger?.debug('No --affected reference')
      return undefined;
    }
    if (this.affected.match(/^[0-9a-f]{40}$/)) {
      this.logger?.debug('Matches commit sha1');
      return this._state.getExecution({
        args: this.args,
        cmd: this.cmd,
        env: this.env,
        workspace: this.workspace.name,
        sha1: this.affected
      });
    } else {
      this.logger?.debug('Matches branch name');
      const latestExecutionOnBranch = await this._state.getLatestBranchExecution({
        args: this.args,
        cmd: this.cmd,
        env: this.env,
        workspace: this.workspace.name,
        branch: this.affected
      });
      this.logger?.debug('Last exec on branch', latestExecutionOnBranch);
      if (!latestExecutionOnBranch) {
        return undefined;
      }
      return this._state.getExecution({
        args: this.args,
        cmd: this.cmd,
        env: this.env,
        workspace: this.workspace.name,
        sha1: latestExecutionOnBranch.sha1,
      });
    }
  }

  protected async _readChecksums(): Promise<ISourcesChecksums> {
    try {
      const execution = await this._getStoredExecution();
      this.logger?.debug({execution});
      if (!execution) {
        return {} as ISourcesChecksums;
      }
      this.logger?.debug('Reading checksums from S3', execution.bucket, execution.checksums, execution.region);
      const raw = await aws.s3.downloadBuffer(execution.bucket, execution.checksums, execution.region);
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
      const execution = await this._getStoredExecution();
      if (!execution) {
        throw new Error('Not matching execution');
      }
      const buffer = await aws.s3.downloadBuffer(execution.bucket, execution.outputs, execution.region);
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
    return;
  }
  protected async _removeOutput(): Promise<void> {
    /* nothing to do */
    return;
  }

  protected async _invalidateState(): Promise<void> {
    const currentBranch = git.getCurrentBranch();
    const currentSha = currentSha1();
    const operations$: Array<Promise<unknown>> = [
      this._state.removeExecution({
        sha1: currentSha,
        cmd: this.cmd,
        args: this.args,
        env: this.env,
        workspace: this.workspace.name,
      }),
    ];
    if (currentBranch) {
      operations$.push(this._state.removeBranchExecution({
        branch: currentBranch,
        sha1: currentSha,
        cmd: this.cmd,
        args: this.args,
        env: this.env,
        workspace: this.workspace.name,
      }))
    }
    await Promise.all(operations$);
  }

  protected async _updateState(): Promise<void> {
    const currentBranch = git.getCurrentBranch();
    const currentSha = currentSha1();
    if (currentBranch) {
      await this._state.setLatestBranchExecution({
        branch: currentBranch,
        sha1: currentSha,
        cmd: this.cmd,
        args: this.args,
        env: this.env,
        workspace: this.workspace.name,
      });
    }
    await this._state.setExecution({
      sha1: currentSha,
      cmd: this.cmd,
      args: this.args,
      env: this.env,
      bucket: this.bucket,
      region: this.awsRegion,
      checksums: this.currentChecksumsKey,
      outputs: this.currentOutputKey,
      workspace: this.workspace.name,
    });
  }
}
