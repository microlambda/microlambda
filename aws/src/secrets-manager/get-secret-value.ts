import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { IBaseLogger } from '@microlambda/types';
import { maxAttempts } from '../max-attempts';

/**
 * Get a secret value
 * @param region - the region where the secret is located
 * @param name - the secret's name
 * @param version
 * @param logger - A logger instance to print logs
 */
export const getSecretValue = async (
  region: string,
  name: string,
  version?: string,
  logger?: IBaseLogger,
): Promise<string | undefined> => {
  const secretManager = new SecretsManagerClient({
    region,
    maxAttempts: maxAttempts({ apiRateLimit: 50 }, logger),
  });
  const getValue = new GetSecretValueCommand({
    SecretId: name,
    VersionId: version,
  });
  return (await secretManager.send(getValue)).SecretString;
};
