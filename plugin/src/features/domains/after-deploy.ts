import { aws } from '@microlambda/aws';
import { IDomainConfig, IBaseLogger } from '@microlambda/types';

export const afterDeploy = async (
  region: string,
  stackName: string,
  stage: string,
  domain?: IDomainConfig,
  logger?: IBaseLogger,
): Promise<void> => {
  // create/update base path mapping
  if (!domain || domain?.domainName === 'null') {
    logger?.info('No custom domain configured');
    return;
  }
  // TODO: Use objects, a lot of params are not easy to handle
  const mapping = await aws.apiGateway.getBasePathMapping(
    region,
    domain.domainName,
    domain.basePath,
    logger,
  );
  if (!mapping) {
    const apiId = await aws.cloudformation.getApiId(
      region,
      stackName,
      domain.type,
    );
    await aws.apiGateway.createBasePathMapping(
      region,
      domain.domainName,
      apiId,
      stage,
      domain.basePath,
      logger,
    );
  }
};
