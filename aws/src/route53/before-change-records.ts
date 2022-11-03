import { getCustomDomainUrl } from "../api-gateway/get-custom-domain-url";
import { getHostedZone } from "./get-hosted-zone";
import { IBaseLogger } from "@microlambda/types";

export const beforeChangeRecords = async (
  region: string,
  domain: string,
  logger?: IBaseLogger
): Promise<{ apiGatewayUrl: string; hostedZoneId: string }> => {
  const apiGatewayUrl = await getCustomDomainUrl(region, domain);
  logger?.debug("API Gateway URL resolved", apiGatewayUrl);
  const hostedZone = await getHostedZone(domain, logger);
  if (!hostedZone || !hostedZone.Id) {
    throw new Error(`Cannot resolve hosted zone for domain ${domain}`);
  }
  logger?.debug("Hosted zone resolved", hostedZone);
  return { apiGatewayUrl, hostedZoneId: hostedZone.Id };
};
