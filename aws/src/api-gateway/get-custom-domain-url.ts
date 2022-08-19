import { getCustomDomain } from "./get-custom-domain";
import { IBaseLogger } from "@microlambda/types";

export const getCustomDomainUrl = async (
  region: string,
  domain: string,
): Promise<string> => {
  const customDomain = await getCustomDomain(region, domain);
  if (!customDomain) {
    throw new Error("API Gateway Custom domain was not created");
  }
  if (!customDomain.DomainNameConfigurations) {
    throw new Error("API Gateway Custom domain configuration not found");
  }
  const domains = customDomain.DomainNameConfigurations.filter(
    (d) => d.ApiGatewayDomainName != null
  ).map((d) => d.ApiGatewayDomainName);
  if (domains.length > 1) {
    throw new Error(
      "Only one domain configuration with a ApiGatewayDomainName is supported"
    );
  }
  return domains[0]!;
};
