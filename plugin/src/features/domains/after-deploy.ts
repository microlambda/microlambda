import { createBasePathMapping, getApiId, getBasePathMapping } from "../../aws";
import { IDomainConfig } from "../../config";
import { ILogger } from "../../types";

export const afterDeploy = async (
  region: string,
  stackName: string,
  stage: string,
  domain?: IDomainConfig,
  logger?: ILogger
): Promise<void> => {
  // create/update base path mapping
  if (!domain || domain?.domainName === 'null') {
    logger?.info("No custom domain configured");
    return;
  }
  // TODO: Use objects, a lot of params are not easy to handle
  const mapping = await getBasePathMapping(
    region,
    domain.domainName,
    domain.basePath,
    logger
  );
  if (!mapping) {
    const apiId = await getApiId(region, stackName, domain.type);
    await createBasePathMapping(
      region,
      domain.domainName,
      apiId,
      stage,
      domain.basePath,
      logger
    );
  }
};
