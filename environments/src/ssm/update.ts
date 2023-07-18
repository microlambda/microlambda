import { Project, Workspace } from '@microlambda/runner-core';
import { IRootConfig } from '@microlambda/config';
import { DotenvManager } from '../dotenv-manager';
import { MilaError, MilaErrorCode } from '@microlambda/errors';
import { writeParameters } from './create';
import { IDeleteParameterOptions } from './delete';

export interface IUpdateParameterOptions {
  env?: string;
  service?: string | Workspace;
  key: string;
  value: string;
}

export const checkIsParameter = async (project: Project, options: IDeleteParameterOptions): Promise<string> => {
  const dotenvManager = new DotenvManager(project, { env: options.env, service: options.service });
  const currentValue = await dotenvManager.getKey(options.key);
  const isParameter = currentValue?.match(/^\${ssm:(.+)}$/);
  if (!isParameter) {
    throw new MilaError(
      MilaErrorCode.NOT_A_SSM_PARAMETER,
      `The key ${options.key} @ ${dotenvManager.path} does not exist or is not a SSM parameter`,
    );
  }
  return isParameter[1];
};

export const createParameter = async (
  project: Project,
  config: IRootConfig,
  options: IUpdateParameterOptions,
): Promise<void> => {
  const parameterName = await checkIsParameter(project, options);
  await writeParameters(config, parameterName, options);
};
