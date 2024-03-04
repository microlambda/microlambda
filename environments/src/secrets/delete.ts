import { Project, Workspace } from '@microlambda/runner-core';
import { IStateConfig } from '@microlambda/config';
import { DotenvManager } from '../dotenv-manager';
import { checkIsSecret } from './update';
import { resolveTargetsRegions } from '../utils/resolve-regions';
import { aws } from '@microlambda/aws';

export interface IDeleteSecretOptions {
  env?: string;
  service?: string | Workspace;
  key: string;
}

export const removeSecret = async (
  project: Project,
  config: IStateConfig,
  options: IDeleteSecretOptions,
): Promise<void> => {
  const dotenvManager = new DotenvManager(project, { env: options.env, service: options.service });
  const secretName = await checkIsSecret(project, options);
  const targetRegions = await resolveTargetsRegions(config, options.env);
  const secretsDeletion$: Array<Promise<unknown>> = [];
  for (const region of targetRegions) {
    secretsDeletion$.push(aws.secretsManager.deleteSecret(region, secretName));
  }
  await Promise.all(secretsDeletion$);
  await dotenvManager.removeKey(options.key);
};
