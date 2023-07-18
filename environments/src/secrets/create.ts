import { Project, Workspace } from '@microlambda/runner-core';
import { resolveTargetsRegions } from '../utils/resolve-regions';
import { IRootConfig } from '@microlambda/config';
import { aws } from '@microlambda/aws';
import { DotenvManager } from '../dotenv-manager';
import { MilaError, MilaErrorCode } from '@microlambda/errors';
import { IUpdateSecretOptions } from './update';

export interface ICreateSecretOptions {
  env?: string;
  service?: string | Workspace;
  secretName: string;
  key: string;
  value: string;
}

export const writeSecrets = async (
  config: IRootConfig,
  secretName: string,
  options: IUpdateSecretOptions,
): Promise<void> => {
  const targetRegions = await resolveTargetsRegions(config, options.env);
  const secretsCreations$: Array<Promise<unknown>> = [];
  for (const region of targetRegions) {
    secretsCreations$.push(aws.secretsManager.putSecret(region, secretName, options.value));
  }
  await Promise.all(secretsCreations$);
};

export const createSecret = async (
  project: Project,
  config: IRootConfig,
  options: ICreateSecretOptions,
): Promise<void> => {
  const dotenvManager = new DotenvManager(project, { env: options.env, service: options.service });
  if (await dotenvManager.hasKey(options.key)) {
    throw new MilaError(
      MilaErrorCode.SECRET_ALREADY_EXISTS,
      `Key ${options.key} is already taken @ ${dotenvManager.path}`,
    );
  }
  await writeSecrets(config, options.secretName, options);
  await dotenvManager.addKey(options.key, `\${secrets:${options.secretName}`);
};
