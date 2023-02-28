import { Project, Workspace } from '@microlambda/runner-core';
import { resolveTargetsRegions } from '../utils/resolve-regions';
import { IRootConfig } from '@microlambda/config';
import { aws } from '@microlambda/aws';
import { DotenvManager } from '../dotenv-manager';
import { MilaError, MilaErrorCode } from '@microlambda/errors';
import { IUpdateParameterOptions } from './update';

export interface ICreateParameterOptions {
  env?: string;
  service?: string | Workspace;
  parameterName: string;
  key: string;
  value: string;
}

export const writeParameters = async (config: IRootConfig, parameterName: string, options: IUpdateParameterOptions): Promise<void> => {
  const targetRegions = await resolveTargetsRegions(config, options.env);
  const parametersCreation$: Array<Promise<unknown>> = [];
  for (const region of targetRegions) {
    parametersCreation$.push(aws.ssm.putParameter(region, parameterName, options.value));
  }
  await Promise.all(parametersCreation$);
}

export const createParameter = async (project: Project, config: IRootConfig, options: ICreateParameterOptions): Promise<void> => {
  const dotenvManager = new DotenvManager(project, { env: options.env, service: options.service });
  if (await dotenvManager.hasKey(options.key)) {
    throw new MilaError(MilaErrorCode.SSM_PARAMETER_ALREADY_EXISTS, `Key ${options.key} is already taken @ ${dotenvManager.path}`);
  }
  await writeParameters(config, options.parameterName, options);
  await dotenvManager.addKey(options.key, `\${ssm:${options.parameterName}`);
}
