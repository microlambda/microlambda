import {
  deleteBasePathMapping,
  getBasePathMapping,
  getCustomDomain,
} from "../../aws";
import { IDomainConfig } from "../../config";
import { ILogger } from "../../types";

export const beforeRemove = async (
  region: string,
  domain?: IDomainConfig,
  logger?: ILogger
): Promise<void> => {
  // delete base path mapping if exists
  if (!domain) {
    logger?.info("No custom domain configured");
    return;
  }
  const domainExists = await getCustomDomain(region, domain.domainName, logger);
  if (!domainExists) {
    logger?.info("No related domain found. Skipping...");
    return;
  }
  const mapping = await getBasePathMapping(
    region,
    domain.domainName,
    domain.basePath,
    logger
  );
  if (mapping) {
    await deleteBasePathMapping(
      region,
      domain.domainName,
      domain.basePath,
      logger
    );
  } else {
    logger?.info("No API mapping to remove");
  }
};
