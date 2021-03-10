import { ISecretConfig } from "../../config";
import { putSecret } from "../../aws";
import { ILogger } from "../../types";

export const createUpdateSecrets = async (
  region: string,
  secrets: ISecretConfig[],
  logger?: ILogger
): Promise<void> => {
  let failures = 0;
  logger?.info("Creating/updating secrets", secrets);
  await Promise.all(
    secrets.map(async (secret) => {
      try {
        logger?.debug("Creating/updating secret", secret);
        await putSecret(
          region,
          secret.name,
          secret.value,
          { description: secret.description, kmsKeyId: secret.kmsKeyId },
          logger
        );
        logger?.debug("Secret created/updated", secret);
      } catch (e) {
        failures++;
        logger?.error("Failed to create secret", { region, name: secret.name });
        logger?.error(e);
      }
    })
  );
  if (failures) {
    throw Error("Some secrets has not been created");
  }
};
