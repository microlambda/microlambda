import { aws } from "@microlambda/aws";
import { IBaseLogger, IDomainConfig } from "@microlambda/types";

export const beforeRemove = async (
  region: string,
  domain?: IDomainConfig,
  logger?: IBaseLogger
): Promise<void> => {
  // delete base path mapping if exists
  if (!domain || domain.domainName === 'null') {
    logger?.info("No custom domain configured");
    return;
  }
  const domainExists = await aws.apiGateway.getCustomDomain(region, domain.domainName, logger);
  if (!domainExists) {
    logger?.info("No related domain found. Skipping...");
    return;
  }
  const mapping = await  aws.apiGateway.getBasePathMapping(
    region,
    domain.domainName,
    domain.basePath,
    logger
  );
  if (mapping) {
    await  aws.apiGateway.deleteBasePathMapping(
      region,
      domain.domainName,
      domain.basePath,
      logger
    );
  } else {
    logger?.info("No API mapping to remove");
  }
};
