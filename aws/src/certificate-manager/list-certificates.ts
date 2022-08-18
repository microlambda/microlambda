import {
  ACMClient,
  CertificateSummary,
  ListCertificatesCommand,
  ListCertificatesCommandOutput,
} from "@aws-sdk/client-acm";
import { IBaseLogger } from "@microlambda/types";
import { serviceName } from "./service-name";
import { maxAttempts } from "../max-attempts";

export const listCertificates = async (
  region: string,
  logger?: IBaseLogger
): Promise<CertificateSummary[]> => {
  const certificateManager = new ACMClient({
    region,
    maxAttempts: maxAttempts({ apiRateLimit: 5 }, logger),
  });
  let nextToken;
  const certificates: CertificateSummary[] = [];
  do {
    logger?.debug(serviceName, "ListCertificatesCommand", {
      NextToken: nextToken,
    });
    const result: ListCertificatesCommandOutput = await certificateManager.send(
      new ListCertificatesCommand({ NextToken: nextToken })
    );
    if (result.CertificateSummaryList) {
      certificates.push(...result.CertificateSummaryList);
    }
    nextToken = result.NextToken;
  } while (nextToken != null);
  return certificates;
};
