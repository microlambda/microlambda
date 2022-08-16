import {dirname, join} from "path";
import { existsSync, promises as fs } from "fs";

export interface ILogsCondition {
  type: 'success' | 'failure';
  stdio: 'stdout' | 'stderr' | 'all';
  matcher: 'contains' | 'regex';
  value: string;
  timeout?: number
}

export interface ICommandConfig {
  run: string;
  env?: {[key: string]: string};
  daemon?: false | Array<ILogsCondition> | ILogsCondition;
}

export interface IConfigEntry {
  cmd: string | string[] | ICommandConfig | Array<ICommandConfig>;
  src?: string[];
  artifacts?: string[];
}

export interface IConfig {
  [cmd: string]: IConfigEntry;
}

export interface IConfigFile {
  targets?: {
    [cmd: string]: IConfigEntry;
  }
  extends?: string;
}

export const readConfigFile = async (path: string): Promise<unknown> => {
  try {
    const data = await fs.readFile(path, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    if ((e as { code: string }).code === 'ENOENT') {
      return {};
    }
    throw e;
  }
}

export const loadConfig = async (path: string): Promise<IConfig> => {
  const raw = await readConfigFile(path);
  // TODO: Validate
  const config = raw as IConfigFile;
  const targets = config.targets || {};
  if (config.extends) {
    const extending = join(dirname(path), ...config.extends.split('/'));
    if (extending === path) {
      // TODO: Throw properly
      // Throw also if not exists
      throw new Error('Cannot extend himself');
    }
    if (!existsSync(extending)) {
      throw new Error('Extending config that does not exists');
    }
    const parentConfig = await loadConfig(extending);
    return { ...parentConfig, ...targets}
  } else {
    return targets;
  }
}
