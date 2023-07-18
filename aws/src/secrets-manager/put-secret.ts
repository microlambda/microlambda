import { CreateSecretCommand, SecretsManagerClient, UpdateSecretCommand } from '@aws-sdk/client-secrets-manager';
import { checkSecretExists } from './check-secret-exists';
import { IBaseLogger } from '@microlambda/types';
import { maxAttempts } from '../max-attempts';

/**
 * Create/update a secret in a specific region.
 * If the secret exists, the secret will be updated otherwise t will be created
 * @param region - The region in which the secret should be created
 * @param name - The name of the secret
 * @param value - The secret string value to be ciphered
 * @param options - Optional description and KMS key to use to cipher secret. If no key is given
 * @param logger - A logger instance to print logs
 * the default KMS key for SSM will be used (Amazon auto-creates it if not exist)
 */
export const putSecret = async (
  region: string,
  name: string,
  value: string,
  options?: { description?: string; kmsKeyId?: string },
  logger?: IBaseLogger,
): Promise<string | undefined> => {
  const secretManager = new SecretsManagerClient({
    region,
    maxAttempts: maxAttempts({ apiRateLimit: 5 }, logger),
  });
  const exists = await checkSecretExists(region, name);
  if (!exists) {
    const createParams = {
      Name: name,
      Description: options?.description,
      KmsKeyId: options?.kmsKeyId,
      SecretString: value,
    };
    logger?.debug('Secret does not exist, creating it', {
      region,
      ...createParams,
    });
    const response = await secretManager.send(new CreateSecretCommand(createParams));
    return response.ARN;
  } else {
    const updateParams = {
      SecretId: name,
      Description: options?.description,
      KmsKeyId: options?.kmsKeyId,
      SecretString: value,
    };
    logger?.debug('Secret already exists, updating it', {
      region,
      ...updateParams,
    });
    const response = await secretManager.send(new UpdateSecretCommand(updateParams));
    return response.ARN;
  }
};
