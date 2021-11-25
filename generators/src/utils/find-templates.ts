import { promises as fs } from 'fs';
import { join } from 'path';

const recursivelyFindTemplates = async (path: string, templates: Map<string, string>): Promise<void> => {
  const children = await fs.readdir(path);
  const directories = new Set<string>();
  await Promise.all(
    children.map(async (child) => {
      const childPath = join(path, child);
      const stat = await fs.lstat(childPath);
      if (stat.isDirectory()) {
        directories.add(join(path, child));
      } else if (stat.isFile() && child.endsWith('.ejs')) {
        const raw = await fs.readFile(childPath);
        templates.set(childPath, raw.toString());
      }
    }),
  );
  if (directories.size) {
    await Promise.all(Array.from(directories).map((d) => recursivelyFindTemplates(d, templates)));
  }
};

export const findTemplates = async (path: string): Promise<Map<string, string>> => {
  const templates = new Map<string, string>();
  await recursivelyFindTemplates(path, templates);
  return templates;
};
