import { promises as fs } from 'fs';
import { sync as glob } from 'fast-glob';
import { join } from 'path';
import { fromFile } from 'hasha';
import { Cache } from "./cache";
import { MilaError, MilaErrorCode } from "@microlambda/errors";

export class Checksum {
  constructor (
    private readonly _cache: Cache,
  ) {}

  get checksumPath(): string {
    return join(this._cache.cacheFolder, 'checksums.json');
  }

  async read(): Promise<Record<string, string>> {
    try {
      const checksums = await fs.readFile(this.checksumPath);
      return JSON.parse(checksums.toString());
    } catch (e) {
      return {};
    }
  }

  async calculate(): Promise<Record<string, string>> {
    const config = this._cache.config;
    if (!config.src) {
      throw new MilaError(MilaErrorCode.CACHE_DISABLED, 'Asked to compute checksums whereas cache is disabled by config');
    }
    const src = config.src.map((s) => glob(join(this._cache.workspace.root, s))).reduce((acc, val) => acc = acc.concat(val), []);
    if (!src.length) {
      throw new MilaError(MilaErrorCode.NO_FILES_TO_CACHE, 'No path to cache');
    }
    const _cmd = (Array.isArray(config.cmd) ? config.cmd : [config.cmd]).map((c) => typeof c === 'string' ? c : c.run);
    const checksums: Record<string, string> = {
      cmd: _cmd.join(','),
      globs: config.src.join(','),
      args: JSON.stringify(this._cache.args),
      env: JSON.stringify(this._cache.env),
    };
    await Promise.all(src.map(async (path) => {
      // TODO: Batch to avoid EMFILE
      checksums[path] = await fromFile(path, { algorithm: 'sha256' });
    }));
    return checksums;
  }
}
