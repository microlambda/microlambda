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
  const domainExists = await getCustomDomain(region, domain, logger);
  if (!domainExists) {
    logger?.info("No related domain found. Skipping...");
    return;
  }
  // delete DNS records
  await deleteLatencyRecords(region, domain, logger);
  // delete custom domains
  await deleteCustomDomain(region, domain, logger);
};
