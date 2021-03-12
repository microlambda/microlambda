import {
  deleteCustomDomain,
  deleteLatencyRecords,
  getCustomDomain,
} from "../../aws";
import { ILogger } from "../../types";

export const afterRemove = async (
  region: string,
  domain: string | undefined,
  logger: ILogger
): Promise<void> => {
  if (!domain) {
    logger?.info("No custom domain configured");
    return;
  }
  // delete DNS records
  await deleteLatencyRecords(region, domain, logger);
  // delete custom domains
  const customDomain = await getCustomDomain(region, domain, logger);
  if (customDomain) {
    logger?.info("Removing custom domain");
    await deleteCustomDomain(region, domain, logger);
  } else {
    logger?.info("No custom domain to remove");
  }
};
