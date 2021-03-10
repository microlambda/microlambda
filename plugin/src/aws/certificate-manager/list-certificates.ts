import {
  ACMClient,
  CertificateSummary,
  ListCertificatesCommand,
  ListCertificatesCommandOutput,
} from "@aws-sdk/client-acm";
import { ILogger } from "../../types";
import { serviceName } from "./service-name";

export const listCertificates = async (
  region: string,
  logger?: ILogger
): Promise<CertificateSummary[]> => {
  const certificateManager = new ACMClient({ region, maxAttempts: 5 });
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
