import { dirname, join } from 'path';
import { existsSync, readJSONSync } from 'fs-extra';
import { regions } from './regions';
import { rootConfigSchema } from './schemas/root-config';
import { packageConfigSchema } from './schemas/package-config';
import { IRootConfig } from './types/root-config';
import { IPackageConfig, ITargetsConfig } from './types/package-config';
import { MilaError, MilaErrorCode } from '@microlambda/errors';
import { promises as fs } from 'fs';
import { EventsLog } from '@microlambda/logger';

export class ConfigReader {
  public static readonly regions = regions;
  public static readonly schemas = {
    root: rootConfigSchema,
    package: packageConfigSchema,
  };

  private readonly _logger;
  static readonly scope = 'config/reader';

  constructor(readonly projectRoot: string, readonly eventsLog?: EventsLog) {
    this._logger = eventsLog?.scope(ConfigReader.scope);
  }

  private _configs: {
    root?: IRootConfig;
    packages: Map<string, { regions?: string[]; targets: ITargetsConfig }>;
  } = {
    packages: new Map(),
  };

  get rootConfig(): IRootConfig {
    if (this._configs.root) {
      return this._configs.root;
    }
    this._logger?.debug('Project root resolved', this.projectRoot);
    const configPath = join(this.projectRoot, 'mila.json');
    this._logger?.debug('Reading config at', this.projectRoot);
    if (!existsSync(configPath)) {
      this._logger?.error('Root configuration file not found', this.projectRoot);
      throw new MilaError(MilaErrorCode.ROOT_CONFIG_NOT_FOUND, `Root configuration file not found at ${configPath}`);
    }
    let raw: unknown;
    try {
      this._logger?.debug('Parsing root config', configPath);
      raw = readJSONSync(configPath);
    } catch (e) {
      this._logger?.error('Error parsing root config', configPath, e);
      throw new MilaError(MilaErrorCode.ILL_FORMED_ROOT_CONFIG, `Error parsing root configuration ${configPath}`, e);
    }
    this._logger?.debug('Validating root config', raw);
    const { error, value } = ConfigReader.schemas.root.validate(raw);
    if (error) {
      this._logger?.error('Invalid root config');
      throw new MilaError(MilaErrorCode.INVALID_ROOT_CONFIG, `Invalid root configuration ${configPath}`, error);
    }
    this._logger?.debug('Root config valid');
    this._configs.root = value;
    return value;
  }

  async loadPackageConfig(
    packageName: string,
    packageRoot: string,
  ): Promise<{ regions?: string[]; targets: ITargetsConfig }> {
    this._logger?.debug('Loading package config', packageName, packageRoot);
    const alreadyLoaded = this._configs.packages.get(packageName);
    if (alreadyLoaded) {
      this._logger?.debug('Config already loaded');
      return alreadyLoaded;
    }
    const path = join(packageRoot, 'mila.json');
    const targets = await this._loadPackageConfig(path);
    const rootConfig: IPackageConfig = (await this._readPackageConfigFile(path)) as IPackageConfig;
    const loaded = { targets, regions: rootConfig.regions };
    this._logger?.debug('Config file loaded', packageName, loaded);
    this._configs.packages.set(packageName, loaded);
    return loaded;
  }

  private async _loadPackageConfig(path: string): Promise<ITargetsConfig> {
    const raw = await this._readPackageConfigFile(path);
    this._logger?.debug('Raw config file read', raw);
    const { error, value } = ConfigReader.schemas.package.validate(raw);
    if (error) {
      this._logger?.error('Invalid config file', path, error);
      throw new MilaError(MilaErrorCode.INVALID_PACKAGE_CONFIG, `Invalid package configuration ${path}`, error);
    }
    const config = value;
    const targets = config.targets || {};
    this._logger?.debug('Resolved targets', targets);
    if (config.extends) {
      this._logger?.debug('Config extends', config.extends);
      const extending = join(dirname(path), ...config.extends.split('/'));
      this._logger?.debug('Config extends (resolved)', extending);
      if (extending === path) {
        this._logger?.error('Config trying to extends itself', extending);
        throw new MilaError(MilaErrorCode.INVALID_PACKAGE_CONFIG, `Package config ${path} is trying to extend itself`);
      }
      if (!existsSync(extending)) {
        this._logger?.error('Config trying to extends a file that does not exist', extending);
        throw new MilaError(
          MilaErrorCode.INVALID_PACKAGE_CONFIG,
          `Package config ${path} is trying to extend a config ${extending} that does not exists`,
        );
      }
      const parentConfig = await this._loadPackageConfig(extending);
      this._logger?.debug('Parent targets resolved', parentConfig);
      return { ...parentConfig, ...targets };
    } else {
      this._logger?.debug('Targets resolved');
      return targets;
    }
  }

  private async _readPackageConfigFile(path: string): Promise<unknown> {
    try {
      this._logger?.debug('Reading config file at', path);
      const data = await fs.readFile(path, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      this._logger?.warn('This package has no config file', path);
      if ((e as { code: string }).code === 'ENOENT') {
        return {};
      }
      this._logger?.error('Error parsing config file', path, e);
      throw new MilaError(MilaErrorCode.ILL_FORMED_PACKAGE_CONFIG, `Error parsing package configuration ${path}`, e);
    }
  }
}
