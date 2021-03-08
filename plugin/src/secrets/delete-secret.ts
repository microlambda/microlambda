import {
  DeleteSecretCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { IPluginLogger } from "../utils/logger";

/**
 * Delete a secret in a given region by a given name or ARN
 * @param region - the secret in which the secret should be deleted
 * @param name - the secret's name, alternatively the full ARN can be given
 */
export const deleteSecret = async (
  region: string,
  name: string,
  logger?: IPluginLogger
): Promise<void> => {
  const secretManager = new SecretsManagerClient({ region, maxAttempts: 5 });
  logger?.debug("DeleteSecretCommand", { SecretId: name });
  await secretManager.send(new DeleteSecretCommand({ SecretId: name }));
};
