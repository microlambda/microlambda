import { ISecretConfig } from "../../config";
import { ILogger } from "../../types";
import { checkSecretExists, deleteSecret } from "../../aws";

export const deleteSecrets = async (
  region: string,
  secrets: ISecretConfig[],
  logger?: ILogger
): Promise<void> => {
  let failures = 0;
  await Promise.all(
    secrets.map(async (secret) => {
      try {
        logger?.debug("Check if secret exist", { region, name: secret.name });
        const exists = await checkSecretExists(region, secret.name);
        if (exists) {
          logger?.info("Removing secret...", { region, name: secret.name });
          await deleteSecret(region, secret.name);
          logger?.info("Secret removed", { region, name: secret.name });
        } else {
          logger?.info("Secret not found, skipping...", {
            region,
            name: secret.name,
          });
        }
      } catch (e) {
        failures++;
        logger?.error("Failed to delete secret", { region, name: secret.name });
        logger?.error(e);
      }
    })
  );
  if (failures) {
    throw Error("Some secrets has not been deleted");
  }
};