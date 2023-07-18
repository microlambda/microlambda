import { DeleteSecretCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { IBaseLogger } from '@microlambda/types';
import { maxAttempts } from '../max-attempts';

/**
 * Delete a secret in a given region by a given name or ARN
 * @param region - the secret in which the secret should be deleted
 * @param name - the secret's name, alternatively the full ARN can be given
 * @param logger - A logger instance to print logs
 */
export const deleteSecret = async (region: string, name: string, logger?: IBaseLogger): Promise<void> => {
  const secretManager = new SecretsManagerClient({
    region,
    maxAttempts: maxAttempts({ apiRateLimit: 50 }, logger),
  });
  logger?.debug('DeleteSecretCommand', { SecretId: name });
  await secretManager.send(new DeleteSecretCommand({ SecretId: name }));
};
