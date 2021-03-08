import {
  SecretsManagerClient,
  ListSecretsCommand,
} from "@aws-sdk/client-secrets-manager";
import { IPluginLogger } from "../utils/logger";

/**
 * Check if a secret with a given name exists in a given region
 * @param region - the region where the secret is located
 * @param name - the secret's name
 */
export const checkSecretExists = async (
  region: string,
  name: string,
  logger?: IPluginLogger
): Promise<boolean> => {
  const secretManager = new SecretsManagerClient({ region, maxAttempts: 5 });
  let nextToken: string | undefined;
  let found = false;
  let page = 0;
  logger?.debug("Checking if secret exist");
  do {
    page++;
    logger?.debug("Listing secrets", { page });
    logger?.debug("ListSecretsCommand", { NextToken: nextToken });
    const getPage = new ListSecretsCommand({
      NextToken: nextToken,
    });
    try {
      const result = await secretManager.send(getPage);
      logger?.debug("Found results", result.SecretList?.length);
      nextToken = result.NextToken;
      logger?.debug("Next token updated", { nextToken });
      found =
        !!result.SecretList &&
        result.SecretList.some((secret) => secret.Name === name);
      logger?.debug("Secret found ?", found);
      logger?.debug("Has next page ?", nextToken != null);
    } catch (e) {
      logger?.error("Error listing secrets", e);
      throw e;
    }
  } while (nextToken != null && !found);
  return found;
};
