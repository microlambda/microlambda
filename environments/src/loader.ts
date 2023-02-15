import { Project, Workspace } from '@microlambda/runner-core';
import dotenv from 'dotenv';
import { fs } from '@microlambda/utils';
import { aws } from '@microlambda/aws';
import { IBaseLogger } from '@microlambda/types';
import { ConfigReader } from '@microlambda/config';
import { MilaError, MilaErrorCode } from '@microlambda/errors';
import { join } from 'path';

interface ILoadedEnvironmentVariables {
  key: string;
  value: string;
  from: string;
  secret?: {
    region: string;
    name: string;
    version?: string;
  };
}

type ILoadedEnv = Array<ILoadedEnvironmentVariables>;

export class EnvironmentLoader {

  readonly region: string;

  constructor(readonly project: Project, private readonly _logger?: IBaseLogger) {
    const config = new ConfigReader(this.project.root);
    this.region = config.rootConfig.defaultRegion;
  }

  async loadGlobal(env: string): Promise<ILoadedEnv> {
    this._logger?.info('Loading root .env');
    const sharedEnv = await this._loadAndInterpolateSecrets(join(this.project.root, '.env'));
    this._logger?.info(`Loading root .env.${env}`);
    const specificEnv = await this._loadAndInterpolateSecrets(join(this.project.root, `.env.${env}`));
    return [ ...sharedEnv, ...specificEnv ];
  }

  async loadServiceScoped(env: string, service: string | Workspace): Promise<ILoadedEnv> {
    const workspace = typeof service === 'string' ? this.project.workspaces.get(service) : service;
    if (!workspace) {
      throw new MilaError(MilaErrorCode.UNABLE_TO_LOAD_WORKSPACE, `Workspace not found: ${service}`);
    }
    this._logger?.info('Loading root .env');
    const sharedEnv = await this._loadAndInterpolateSecrets(join(workspace.root, '.env'));
    this._logger?.info(`Loading root .env.${env}`);
    const specificEnv = await this._loadAndInterpolateSecrets(join(workspace.root, `.env.${env}`));
    return [ ...sharedEnv, ...specificEnv ];
  }

  private async _loadDotEnv(path: string): Promise<Record<string, string>> {
    if (await fs.exists(path)) {
      return dotenv.parse(path);
    }
    this._logger?.info('Dotenv file not found, skipping', path);
    return {};
  }

  private async _loadAndInterpolateSecrets(path: string): Promise<ILoadedEnv> {
    const envVars = await this._loadDotEnv(path);
    const resolvedEnv: ILoadedEnv = [];
    for(const [key, value] of Object.entries(envVars)) {
      const isSecret = value.match(/^\${ssm:(.+)}$/);
      if (isSecret) {
        try {
          const hasVersion = isSecret[1].match(/^(.+):([0-9]+)$/);
          const name = hasVersion ? hasVersion[1] : isSecret[1];
          const version = hasVersion ? hasVersion[2] : undefined;
          const secretValue = await aws.secretsManager.getSecretValue(this.region, name, version, this._logger);
          resolvedEnv.push({ key, value: secretValue ?? '', from: path, secret: { region: this.region, name, version } });
        } catch (e) {
          this._logger?.error('Error interpolating secret', value);
          this._logger?.error(e);
          throw new MilaError(MilaErrorCode.UNABLE_TO_LOAD_SECRET_VALUE, `Error interpolating secret ${value} (from ${path})`, e);
        }
      } else {
        resolvedEnv.push({ key, value, from: path });
      }
    }
    return resolvedEnv;
  }
}
