import { Project, Workspace } from '@microlambda/runner-core';
import { aws } from '@microlambda/aws';
import { IBaseLogger } from '@microlambda/types';
import { ConfigReader } from '@microlambda/config';
import { MilaError, MilaErrorCode } from '@microlambda/errors';
import { DotenvManager } from './dotenv-manager';
import chalk from 'chalk';
import * as process from "process";

export interface ILoadedEnvironmentVariable {
  key: string;
  value?: string;
  from: string;
  raw?: string;
  overwritten?: boolean;
}

export enum SSMResolverMode {
  ERROR,
  WARN,
  IGNORE,
}

type ILoadedEnv = Array<ILoadedEnvironmentVariable>;

export class EnvironmentLoader {
  readonly region: string;
  static readonly ssmParameterPattern = /^\$\{ssm:(.+)}$/;
  static readonly secretPattern = /^\$\{secret:(.+)}$/;

  constructor(readonly project: Project, private readonly _logger?: IBaseLogger) {
    const config = new ConfigReader(this.project.root);
    this.region = process.env.AWS_REGION || config.rootConfig.defaultRegion;
    this._logger?.info('[env] Resolving Secrets and SSM parameters in', this.region, 'region');
  }

  async loadAll(options: {
    env: string;
    service: string | Workspace;
    shouldInterpolate: boolean;
    overwrite: boolean;
    ssmMode?: SSMResolverMode;
    inject: boolean;
  }): Promise<Array<ILoadedEnvironmentVariable>> {
    this._logger?.debug('existing env', process.env);
    const { env, shouldInterpolate, ssmMode, service } = options;
    const rootEnv = await this._loadFile({ ssmMode, shouldInterpolate });
    const stageEnv = await this._loadFile({ env, ssmMode, shouldInterpolate });
    const serviceEnv = await this._loadFile({ service, ssmMode, shouldInterpolate });
    const serviceStageEnv = await this._loadFile({ env, service, ssmMode, shouldInterpolate });
    this._logger?.debug({
      rootEnv,
      stageEnv,
      serviceEnv,
      serviceStageEnv,
    })
    const markAsOverwritten = (
      vars: ILoadedEnvironmentVariable[],
      overwrittenBy: ILoadedEnvironmentVariable[],
    ): void => {
      const nameThatTakePrecedence = new Set([...overwrittenBy.map((v) => v.key)]);
      for (const variable of vars) {
        if (nameThatTakePrecedence.has(variable.key)) {
          this._logger?.debug('Overwritten:', variable.key, variable.from);
          variable.overwritten = true;
        }
      }
    };

    markAsOverwritten(rootEnv, [...stageEnv, ...serviceEnv, ...serviceStageEnv]);
    markAsOverwritten(stageEnv, [...serviceEnv, ...serviceStageEnv]);
    markAsOverwritten(serviceEnv, serviceStageEnv);

    this._logger?.info('Loading root .env');
    rootEnv.forEach((v) => this._printVariable(v));
    this._logger?.info(`Loading root .env.${env}`);
    stageEnv.forEach((v) => this._printVariable(v));
    this._logger?.info('Loading service .env');
    serviceEnv.forEach((v) => this._printVariable(v));
    this._logger?.info(`Loading service .env.${env}`);
    serviceStageEnv.forEach((v) => this._printVariable(v));

    const shouldInject = (variable: ILoadedEnvironmentVariable): boolean => {
      this._logger?.debug('should inject', variable.key, variable.from);
      if (variable.overwritten) {
        this._logger?.debug('no overwritten');
        return false;
      }
      if (options.overwrite) {
        this._logger?.debug('yes (force)')
        return true;
      }
      const isAlreadyExisting = !!process.env[variable.key];
      this._logger?.debug('is existing', process.env[variable.key], !!process.env[variable.key]);
      this._logger?.debug('has value', !!variable.value);
      this._logger?.debug('result',  !!variable.value && !isAlreadyExisting);
      return !!variable.value && !isAlreadyExisting;
    };

    const result: ILoadedEnvironmentVariable[] = [];

    for (const variable of [...rootEnv, ...stageEnv, ...serviceEnv, ...serviceStageEnv]) {
      if (shouldInject(variable) && variable.value) {
        result.push(variable);
        if (options.inject) {
          process.env[variable.key] = variable.value;
        }
      }
    }
    this._logger?.debug({result});
    return result;
  }

  async createRegionalReplicate(
    env: string,
    targetRegion: string,
  ): Promise<{
    success: Set<ILoadedEnvironmentVariable>;
    failures: Map<ILoadedEnvironmentVariable, unknown>;
  }> {
    return this._manageRegionalReplicate(env, targetRegion, 'create');
  }

  async destroyRegionalReplicate(
    env: string,
    targetRegion: string,
  ): Promise<{
    success: Set<ILoadedEnvironmentVariable>;
    failures: Map<ILoadedEnvironmentVariable, unknown>;
  }> {
    return this._manageRegionalReplicate(env, targetRegion, 'create');
  }

  private async _manageRegionalReplicate(
    env: string,
    targetRegion: string,
    mode: 'create' | 'destroy',
  ): Promise<{
    success: Set<ILoadedEnvironmentVariable>;
    failures: Map<ILoadedEnvironmentVariable, unknown>;
  }> {
    const success = new Set<ILoadedEnvironmentVariable>();
    const failures = new Map<ILoadedEnvironmentVariable, unknown>();
    const resolveOperationsFromFile = async (env: string, service?: Workspace): Promise<Array<Promise<void>>> => {
      const operations$: Array<Promise<void>> = [];
      const loadedEnv = await this._loadFile({ service, env, shouldInterpolate: true });
      for (const envVar of loadedEnv) {
        const isParameter = envVar.raw?.match(EnvironmentLoader.ssmParameterPattern);
        const isSecret = envVar.raw?.match(EnvironmentLoader.secretPattern);
        let operation$: Promise<unknown> | undefined;
        if (isParameter && envVar.value) {
          if (mode === 'create') {
            operation$ = aws.ssm.putParameter(targetRegion, isParameter[1], envVar.value);
          } else {
            operation$ = aws.ssm.deleteParameter(targetRegion, isParameter[1]);
          }
        } else if (isSecret && envVar.value) {
          const { name } = this._resolveSecretNameAndVersion(isSecret);
          if (mode === 'create') {
            operation$ = aws.secretsManager.putSecret(targetRegion, name, envVar.value);
          } else {
            operation$ = aws.secretsManager.deleteSecret(targetRegion, name);
          }
        }
        if (operation$) {
          operations$.push(
            operation$
              .then(() => {
                success.add(envVar);
              })
              .catch((err) => {
                failures.set(envVar, err);
              }),
          );
        }
      }
      return operations$;
    };
    const analyzeFiles$: Array<Promise<Array<Promise<void>>>> = [];
    analyzeFiles$.push(resolveOperationsFromFile(env));
    for (const service of this.project.workspaces.values()) {
      analyzeFiles$.push(resolveOperationsFromFile(env, service));
    }
    const allOperations$ = (await Promise.all(analyzeFiles$)).reduce((acc, val) => acc.concat(val), []);
    await Promise.all(allOperations$);
    return { success, failures };
  }

  private _printVariable(v: ILoadedEnvironmentVariable): void {
    this._logger?.info(`  - ${v.key}=${v.value}${v.overwritten ? chalk.magenta(' [overwitten]') : ''}`);
  }

  private async _loadFile(options: {
    env?: string;
    service?: string | Workspace;
    shouldInterpolate?: boolean;
    ssmMode?: SSMResolverMode;
  }): Promise<ILoadedEnv> {
    const { env, service, shouldInterpolate, ssmMode } = options;
    const dotenvManager = new DotenvManager(this.project, { env, service });
    const envVars = await dotenvManager.load();
    const resolvedEnv: ILoadedEnv = [];
    for (const [key, value] of Object.entries(envVars)) {
      if (!shouldInterpolate) {
        resolvedEnv.push({ key, value, from: dotenvManager.path });
      } else {
        resolvedEnv.push(await this._interpolate(key, value, dotenvManager.path, ssmMode ?? SSMResolverMode.ERROR));
      }
    }
    return resolvedEnv;
  }

  private async _interpolate(
    key: string,
    value: string,
    from: string,
    ssmMode: SSMResolverMode,
  ): Promise<{ key: string; value?: string; from: string; raw?: string }> {
    const isSsmParameter = value.match(EnvironmentLoader.ssmParameterPattern);
    const isSecret = value.match(EnvironmentLoader.secretPattern);
    if (isSsmParameter) {
      return this._interpolateSsm(key, value, from, isSsmParameter, ssmMode);
    } else if (isSecret) {
      return this._interpolateSecret(key, value, from, isSecret, ssmMode);
    } else {
      return { key, value, from };
    }
  }

  private async _interpolateSsm(
    key: string,
    value: string,
    from: string,
    isSsmParameter: RegExpMatchArray,
    ssmMode: SSMResolverMode,
  ): Promise<{ key: string; value?: string; from: string; raw: string }> {
    try {
      const name = isSsmParameter[1];
      const parameterValue = await aws.ssm.getParameterValue(this.region, name, this._logger);
      return { key, value: parameterValue, from: from, raw: value };
    } catch (e) {
      switch (ssmMode) {
        case SSMResolverMode.ERROR:
          this._logger?.error('Error interpolating SSM parameter', value);
          this._logger?.error(e);
          throw new MilaError(
            MilaErrorCode.UNABLE_TO_LOAD_SECRET_VALUE,
            `Error interpolating SSM parameter ${value} (from ${from})`,
            e,
          );
        case SSMResolverMode.WARN:
          this._logger?.warn('Error interpolating SSM parameter', value);
          return { key, value: undefined, from: from, raw: value };
        case SSMResolverMode.IGNORE:
          return { key, value: undefined, from: from, raw: value };
      }
    }
  }

  private async _interpolateSecret(
    key: string,
    value: string,
    from: string,
    isSecret: RegExpMatchArray,
    ssmMode: SSMResolverMode,
  ): Promise<{ key: string; value?: string; from: string; raw: string }> {
    try {
      const { name, version } = this._resolveSecretNameAndVersion(isSecret);
      const parameterValue = await aws.secretsManager.getSecretValue(this.region, name, version, this._logger);
      return { key, value: parameterValue, from: from, raw: value };
    } catch (e) {
      switch (ssmMode) {
        case SSMResolverMode.ERROR:
          this._logger?.error('Error interpolating secret', value);
          this._logger?.error(e);
          throw new MilaError(
            MilaErrorCode.UNABLE_TO_LOAD_SECRET_VALUE,
            `Error interpolating secret ${value} (from ${from})`,
            e,
          );
        case SSMResolverMode.WARN:
          this._logger?.warn('Error interpolating secret', value);
          return { key, value: undefined, from: from, raw: value };
        case SSMResolverMode.IGNORE:
          return { key, value: undefined, from: from, raw: value };
      }
    }
  }

  private _resolveSecretNameAndVersion(isSecret: RegExpMatchArray): { name: string; version?: string } {
    let version: string | undefined;
    let name = isSecret[1];
    const hasVersion = isSecret[1].match(/^(.+):(.+)$/);
    if (hasVersion) {
      name = hasVersion[1];
      version = hasVersion[2];
    }
    return { name, version };
  }
}
