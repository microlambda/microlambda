import { promises as fs } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';
import { RawYaml } from './raw-yaml.type';

const recursivelyFindBlueprints = async (path: string, blueprints: Map<string, RawYaml>): Promise<void> => {
  const children = await fs.readdir(path);
  const directories = new Set<string>();
  await Promise.all(
    children.map(async (child) => {
      const childPath = join(path, child);
      const stat = await fs.lstat(childPath);
      if (stat.isDirectory()) {
        directories.add(join(path, child));
      } else if (stat.isFile() && child === 'blueprint.yml') {
        const raw = await fs.readFile(childPath);
        const yaml = load(raw.toString()) as RawYaml;
        if (yaml.name) {
          blueprints.set(path, yaml);
        }
      }
    }),
  );
  if (directories.size) {
    await Promise.all(Array.from(directories).map((d) => recursivelyFindBlueprints(d, blueprints)));
  }
};

export const findBlueprints = async (path: string): Promise<Map<string, RawYaml>> => {
  const blueprints = new Map();
  await recursivelyFindBlueprints(path, blueprints);
  return blueprints;
};
