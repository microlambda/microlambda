import { Project, Workspace } from '@microlambda/runner-core';
import { IStateConfig } from '@microlambda/config';
import { DotenvManager } from '../dotenv-manager';
import { checkIsParameter } from './update';
import { resolveTargetsRegions } from '../utils/resolve-regions';
import { aws } from '@microlambda/aws';

export interface IDeleteParameterOptions {
  env?: string;
  service?: string | Workspace;
  key: string;
}

export const removeParameter = async (
  project: Project,
  config: IStateConfig,
  options: IDeleteParameterOptions,
): Promise<void> => {
  const dotenvManager = new DotenvManager(project, { env: options.env, service: options.service });
  const parameterName = await checkIsParameter(project, options);
  const targetRegions = await resolveTargetsRegions(config, options.env);
  const parametersDeletion$: Array<Promise<unknown>> = [];
  for (const region of targetRegions) {
    parametersDeletion$.push(aws.ssm.deleteParameter(region, parameterName));
  }
  await Promise.all(parametersDeletion$);
  await dotenvManager.removeKey(options.key);
};
