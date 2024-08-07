import { Project, Workspace } from '@microlambda/runner-core';
import { IStateConfig } from '@microlambda/config';
import { DotenvManager } from '../dotenv-manager';
import { MilaError, MilaErrorCode } from '@microlambda/errors';
import { writeSecrets } from './create';
import { IDeleteSecretOptions } from './delete';

export interface IUpdateSecretOptions {
  env?: string;
  service?: string | Workspace;
  key: string;
  value: string;
  versioned?: boolean;
}

export const checkIsSecret = async (project: Project, options: IDeleteSecretOptions): Promise<string> => {
  const dotenvManager = new DotenvManager(project, { env: options.env, service: options.service });
  const currentValue = await dotenvManager.getKey(options.key);
  const isSecret = currentValue?.match(/^\${secret:(.+)}$/);
  if (!isSecret) {
    throw new MilaError(
      MilaErrorCode.NOT_A_SECRET,
      `The key ${options.key} @ ${dotenvManager.path} does not exist or is not a secret`,
    );
  }
  return isSecret[1];
};

export const updateSecret = async (
  project: Project,
  config: IStateConfig,
  options: IUpdateSecretOptions,
): Promise<void> => {
  const secretName = await checkIsSecret(project, options);
  await writeSecrets(config, secretName, options);
};
