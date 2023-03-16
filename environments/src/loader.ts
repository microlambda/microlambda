import { Project, Workspace } from '@microlambda/runner-core';
import { aws } from '@microlambda/aws';
import { IBaseLogger } from '@microlambda/types';
import { ConfigReader } from '@microlambda/config';
import { MilaError, MilaErrorCode } from '@microlambda/errors';
import { DotenvManager } from './dotenv-manager';

interface ILoadedEnvironmentVariable {
  key: string;
  value: string | undefined;
  from: string;
  ssm?: string;
}

export enum SSMResolverMode {
  ERROR,
  WARN,
  IGNORE,
}

type ILoadedEnv = Array<ILoadedEnvironmentVariable>;

export class EnvironmentLoader {

  readonly region: string;

  constructor(readonly project: Project, private readonly _logger?: IBaseLogger) {
    const config = new ConfigReader(this.project.root);
    this.region = process.env.AWS_REGION || config.rootConfig.defaultRegion;
    this._logger?.info('[env] Resolving SSM parameters in', this.region, 'region');
  }

  async injectEnvironmentVariables(
      env: string, service: string | Workspace,
      overwrite = true,
      ssmMode = SSMResolverMode.ERROR,
    ): Promise<void> {
    const global = await this.loadGlobal(env, ssmMode);
    const serviceScoped = await this.loadServiceScoped(env, service);
    for (const variable of [...global, ...serviceScoped]) {
      if (overwrite || !process.env[variable.key] && variable.value) {
        process.env[variable.key] = variable.value;
      }
    }
  }

  async loadGlobal(env: string, ssmMode = SSMResolverMode.ERROR): Promise<ILoadedEnv> {
    this._logger?.info('Loading root .env');
    const sharedEnv = await this._loadAndInterpolateSecrets(undefined, undefined, ssmMode);
    sharedEnv.forEach((v) => this._printVariable(v));
    this._logger?.info(`Loading root .env.${env}`);
    const specificEnv = await this._loadAndInterpolateSecrets(env, undefined, ssmMode);
    specificEnv.forEach((v) => this._printVariable(v));
    return [ ...sharedEnv, ...specificEnv ];
  }

  private _printVariable(v: ILoadedEnvironmentVariable): void {
    this._logger?.info(`  - ${v.key}=${v.value}`)
  }

  async loadServiceScoped(
      env: string,
      service: string | Workspace,
      ssmMode = SSMResolverMode.ERROR,
    ): Promise<ILoadedEnv> {
    this._logger?.info('Loading service .env');
    const sharedEnv = await this._loadAndInterpolateSecrets(undefined, service, ssmMode);
    sharedEnv.forEach((v) => this._printVariable(v));
    this._logger?.info(`Loading service .env.${env}`);
    const specificEnv = await this._loadAndInterpolateSecrets(env, service, ssmMode);
    specificEnv.forEach((v) => this._printVariable(v));
    return [ ...sharedEnv, ...specificEnv ];
  }

  private async _loadAndInterpolateSecrets(
      env?: string,
      service?: string | Workspace,
      ssmMode = SSMResolverMode.ERROR,
  ): Promise<ILoadedEnv> {
    const dotenvManager = new DotenvManager(this.project, { env, service });
    const envVars = await dotenvManager.load();
    const resolvedEnv: ILoadedEnv = [];
    for(const [key, value] of Object.entries(envVars)) {
      const isSsmParameter = value.match(/^\${ssm:(.+)}$/);
      if (isSsmParameter) {
        try {
          const name = isSsmParameter[1];
          const parameterValue = await aws.ssm.getParameterValue(this.region, name, this._logger);
          resolvedEnv.push({ key, value: parameterValue, from: dotenvManager.path, ssm: value });
        } catch (e) {
          switch (ssmMode) {
            case SSMResolverMode.ERROR:
              this._logger?.error('Error interpolating SSM parameter', value);
              this._logger?.error(e);
              throw new MilaError(MilaErrorCode.UNABLE_TO_LOAD_SECRET_VALUE, `Error interpolating SSM parameter ${value} (from ${dotenvManager.path})`, e);
            case SSMResolverMode.WARN:
              this._logger?.warn('Error interpolating SSM parameter', value);
              resolvedEnv.push({ key, value: undefined, from: dotenvManager.path, ssm: value });
              break;
            case SSMResolverMode.IGNORE:
              resolvedEnv.push({ key, value: undefined, from: dotenvManager.path, ssm: value });
              break;
          }
        }
      } else {
        resolvedEnv.push({ key, value, from: dotenvManager.path });
      }
    }
    return resolvedEnv;
  }
}
