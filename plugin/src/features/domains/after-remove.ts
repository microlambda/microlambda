import { aws } from '@microlambda/aws';
import { IBaseLogger } from '@microlambda/types';

export const afterRemove = async (
  region: string,
  domain: string | undefined,
  logger: IBaseLogger,
): Promise<void> => {
  if (!domain || domain === 'null') {
    logger?.info('No custom domain configured');
    return;
  }
  const domainExists = await aws.apiGateway.getCustomDomain(
    region,
    domain,
    logger,
  );
  if (!domainExists) {
    logger?.info('No related domain found. Skipping...');
    return;
  }
  // delete DNS records
  await aws.route53.deleteLatencyRecords(region, domain, logger);
  // delete custom domains
  await aws.apiGateway.deleteCustomDomain(region, domain, logger);
};
