import { SecretsManager } from 'aws-sdk';
import { logger } from '@dataportal/shared';
import servicesSecrets from '../config/secrets';

export const decryptServiceSecrets = async (serviceName: string): Promise<void> => {
  logger.debug('Fetching and decrypting secrets for', serviceName);
  logger.debug('Is env already decrypted: ', process.env.IS_ENV_DECRYPTED);
  if (serviceName && !process.env.IS_ENV_DECRYPTED) {
    logger.debug(`Decrypting secrets for ${serviceName}`);
    logger.debug('Using region', process.env.AWS_REGION);
    const secretsManager = new SecretsManager({ region: process.env.AWS_REGION });

    for (const secretName of servicesSecrets[serviceName]) {
      try {
        logger.debug(`Decrypting ${secretName} secret`);
        const { SecretString } = await secretsManager.getSecretValue({ SecretId: process.env[secretName] }).promise();
        process.env[secretName] = SecretString;
        logger.debug('Decrypted', secretName);
      } catch (err) {
        logger.error(
          `[Init] An error occurred while decrypting the ${secretName} secret`,
          process.env[secretName],
          err,
        );
      }
    }
    logger.debug('All secrets decrypted');
    process.env.IS_ENV_DECRYPTED = 'true';
  }
};
