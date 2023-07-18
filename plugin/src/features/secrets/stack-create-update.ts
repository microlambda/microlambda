import { aws } from '@microlambda/aws';
import { IBaseLogger, ISecretConfig } from '@microlambda/types';

export const createUpdateSecrets = async (
  region: string,
  secrets: ISecretConfig[],
  logger?: IBaseLogger,
): Promise<Map<ISecretConfig, string | undefined>> => {
  let failures = 0;
  logger?.info('Creating/updating secrets', secrets);
  const secretsArn = new Map();
  await Promise.all(
    secrets.map(async (secret) => {
      try {
        logger?.debug('Creating/updating secret', secret);
        const arn = await aws.secretsManager.putSecret(
          region,
          secret.name,
          secret.value,
          { description: secret.description, kmsKeyId: secret.kmsKeyId },
          logger,
        );
        secretsArn.set(secret, arn);
        logger?.debug('Secret created/updated', secret);
      } catch (e) {
        failures++;
        logger?.error('Failed to create secret', { region, name: secret.name });
        logger?.error(e);
      }
    }),
  );
  if (failures) {
    throw Error('Some secrets has not been created');
  }
  return secretsArn;
};
