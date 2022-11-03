import { EventsLog, EventsLogger } from '@microlambda/logger';
import { Workspace } from '../workspace';
import { IArtifactsChecksums } from '../checksums';
import { promises as fs } from 'fs';
import { join } from 'path';
import { Artifacts } from './artifacts';
import { LocalCache } from '../cache/local-cache';

export class LocalArtifacts extends Artifacts {

  protected readonly logger: EventsLogger | undefined;
  static readonly scope = 'runner-core/artifacts-local';

  constructor(
    readonly workspace: Workspace,
    readonly cmd: string,
    readonly args: string[] | string = [],
    readonly env: {[key: string]: string} = {},
    readonly eventsLog?: EventsLog,
  ) {
    super(workspace, cmd, args, env, eventsLog?.scope(LocalArtifacts.scope));
  }

  get cachePath(): string {
    return join(LocalCache.cacheFolder(this.workspace, this.cmd), 'artifacts.json');
  }

  async _write(data: IArtifactsChecksums): Promise<void> {
    await fs.writeFile(this.cachePath, this._serialize(data));
  }

  protected async _read(): Promise<IArtifactsChecksums> {
    try {
      const checksums = await fs.readFile(this.cachePath);
      return JSON.parse(checksums.toString());
    } catch (e) {
      return {} as IArtifactsChecksums;
    }
  }
}
