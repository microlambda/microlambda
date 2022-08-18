import joi from 'joi';
import { resolveProjectRoot } from '@microlambda/runner-core';
import { join } from 'path';
import { existsSync, readJSONSync } from 'fs-extra';

export interface IConfig {
  "defaultRegion": string;
  "defaultRuntime": string;
  "state": {
    "checksums": string;
    "table": string;
  },
  "sharedResources"?: {
    "shared"?: string;
    "env"?: string;
  },
  "targets"?: {
    [cmd: string]: {
      "cmd": string | string[],
      "src": string[];
    },
  }
}

export class ConfigReader {
  public static readonly regions = [
    'us-east-1',
    'us-east-2',
    'us-west-1',
    'us-west-2',
    'ca-central-1',
    'eu-west-1',
    'eu-west-2',
    'eu-west-3',
    'eu-central-1',
    'ap-southeast-1',
    'ap-southeast-2',
    'ap-northeast-1',
    'ap-northeast-2',
    'ap-northeast-3',
    'eu-north-1',
    'sa-east-1',
    'cn-north-1',
    'cn-northwest-1',
    'ap-east-1',
    'me-south-1',
    'ap-south-1',
  ];
  public static readonly schema = joi.object().keys({
    defaultRegion: joi.string().valid(...ConfigReader.regions).required(),
    defaultRuntime: joi.string().valid('nodejs12.x', 'nodejs14.x', 'nodejs16.x').required(),
    state: joi.object().keys({
      checksums: joi.string().required(),
      table: joi.string().required(),
    }).required(),
    sharedResources: joi.object().keys({
      shared: joi.string().optional(),
      env: joi.string().optional(),
    }).optional(),
    targets: joi.object().pattern(/[a-zA-Z]+/, joi.object().keys({
      cmd: joi.alternatives(joi.string().required(), joi.array().items(joi.string().required()).required()).required(),
      src: joi.array().items(joi.string().required()).required(),
    }))
  })

  private _config: IConfig | undefined;

  get config(): IConfig {
    if (this._config) {
      return this._config
    }
    const projectRoot = resolveProjectRoot();
    const configPath = join(projectRoot, 'mila.json');
    if (!existsSync(configPath)) {
      // TODO: Unified and better error management
      throw new Error('Config file not found');
    }
    let raw: unknown;
    try {
      raw = readJSONSync(configPath);
    } catch (e) {
      throw new Error('Config file is not valid JSON');
    }
    const { error, value } = ConfigReader.schema.validate(raw);
    if (error) {
      throw new Error('Config file validation error');
    }
    this._config = value;
    return value;
  }
}
