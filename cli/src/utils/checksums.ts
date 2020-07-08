import { LernaNode } from '../lerna';
import { existsSync, mkdirSync, readFile, writeFile } from 'fs';
import { join } from 'path';
import { getTsConfig } from './typescript';
import { fromFile } from 'hasha';
import { log } from './logger';

export interface IChecksums {
  [file: string]: string;
}

export const checksums = (
  node: LernaNode,
): {
  calculate: () => Promise<IChecksums>;
  read: () => Promise<IChecksums>;
  write: (data: IChecksums) => Promise<void>;
  compare: (old: IChecksums, current: IChecksums) => boolean;
} => {
  const projectRoot = node.getGraph().getProjectRoot();
  const hashesDir = join(projectRoot, '.mila', 'hashes');
  const segments = node.getName().split('/');
  const hashPath = join(hashesDir, segments[segments.length - 1]);

  const ensureDestExists = (): void => {
    if (!existsSync(hashesDir)) {
      mkdirSync(hashesDir, { recursive: true });
    }
  };

  return {
    calculate: async (): Promise<IChecksums> => {
      const config = getTsConfig(node.getLocation());
      const sources = config ? config.fileNames : [];
      const hashes: IChecksums = {};
      await Promise.all(
        sources.map(async (src) => {
          hashes[src] = await fromFile(src, { algorithm: 'sha256' });
        }),
      );
      log('checksum').debug(`Calculated checksum for ${node.getName()}`, hashes);
      return hashes;
    },
    read: async (): Promise<IChecksums> => {
      if (!existsSync(hashPath)) {
        return null;
      }
      return new Promise<IChecksums>((resolve, reject) => {
        readFile(hashPath, (err, data) => {
          if (err) {
            log('checksum').debug('cannot read', err);
            return reject(err);
          }
          try {
            const hashes = JSON.parse(data.toString());
            log('checksum').debug(`Read checksum for ${node.getName()}`, hashes);
            return resolve(hashes);
          } catch (e) {
            log('checksum').debug('cannot parse', e);
            return reject(e);
          }
        });
      });
    },
    compare: (old: IChecksums, current: IChecksums): boolean => {
      log('checksum').debug(`Comparing checksums for ${node.getName()}`, { old, current });
      if (!old) {
        return true;
      }
      const keys = {
        old: Object.keys(old),
        current: Object.keys(current),
      };
      if (keys.old.length !== keys.current.length) {
        log('checksum').debug('Different # keys');
        return true;
      }
      for (const key of keys.current) {
        if (!keys.old.includes(key)) {
          log('checksum').debug('New key');
          return true;
        }
        if (old[key] !== current[key]) {
          log('checksum').debug('New value');
          return true;
        }
      }
      log('checksum').debug('Same hashes');
      return false;
    },
    write: async (data: IChecksums): Promise<void> => {
      ensureDestExists();
      return new Promise((resolve, reject) => {
        writeFile(hashPath, JSON.stringify(data), { encoding: 'utf-8', flag: 'w' }, (err) => {
          if (err) {
            log('checksum').error(err);
            return reject(err);
          }
          return resolve();
        });
      });
    },
  };
};
