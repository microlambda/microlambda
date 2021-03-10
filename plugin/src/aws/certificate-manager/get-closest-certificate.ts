import { CertificateSummary } from "@aws-sdk/client-acm";
import { ILogger } from "../../types";
import { listCertificates } from "./list-certificates";

export const getClosestCertificate = async (
  region: string,
  domain: string,
  logger?: ILogger
): Promise<CertificateSummary | undefined> => {
  const certificates = await listCertificates(region);
  const exactMatch = certificates.find((c) => c.DomainName === domain);
  if (exactMatch) {
    logger?.debug(
      "Exact match",
      certificates.find((c) => c.DomainName === domain)?.DomainName
    );
    return exactMatch;
  }

  // Upper level wildcard
  const segments = domain.split(".");
  while (segments.length > 2) {
    segments.shift();
    const wildcard = ["*", ...segments].join(".");
    const wildCardMatch = certificates.find((c) => c.DomainName === wildcard);
    if (wildCardMatch) {
      logger?.debug("Upper wildcard match", wildCardMatch);
      return wildCardMatch;
    }
  }
  return undefined;
};
