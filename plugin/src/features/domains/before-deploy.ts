import {
  createCertificate,
  createCustomDomain,
  createLatencyRecord,
  describeCertificate,
  getClosestCertificate,
  getCustomDomain,
  waitUntilCertificateIssued,
} from "../../aws";
import { ILogger } from "../../types";
import { CertificateStatus } from "@aws-sdk/client-acm";

export const beforeDeploy = async (
  region: string,
  domain: string | undefined,
  serviceName: string,
  logger?: ILogger
): Promise<void> => {
  if (!domain || domain === 'null') {
    logger?.info("No custom domain configured");
    return;
  }
  // create custom domain
  const customDomain = await getCustomDomain(region, domain, logger);
  if (!customDomain) {
    // check if certificate exist for custom domain
    let certificate = await getClosestCertificate(region, domain, logger);

    if (!certificate) {
      logger?.info("No matching certificate found. Creating it");
      certificate = await createCertificate(region, domain, logger);
      if (!certificate.CertificateArn) {
        throw new Error("Assertion failed: cannot resolve certificate ARN");
      }
      await waitUntilCertificateIssued(
        domain,
        region,
        certificate.CertificateArn,
        10000,
        logger
      );
    }
    if (!certificate.CertificateArn) {
      throw new Error("Assertion failed: cannot resolve certificate ARN");
    }
    const certificateDetails = await describeCertificate(
      region,
      certificate?.CertificateArn
    );
    switch (certificateDetails.Certificate?.Status) {
      case CertificateStatus.ISSUED:
        logger?.info("Certificate correctly issued");
        break;
      case CertificateStatus.PENDING_VALIDATION:
        logger?.warn("Certificate is pending validation");
        await waitUntilCertificateIssued(
          domain,
          region,
          certificate?.CertificateArn,
          10000,
          logger
        );
        break;
      default:
        throw Error(
          `Certificate invalid: ${certificateDetails.Certificate?.Status}`
        );
    }
    logger?.info("Creating custom domain with certificate", certificate);
    await createCustomDomain(
      region,
      domain,
      certificate.CertificateArn,
      logger
    );
  } else {
    logger?.info("Custom domain already created");
  }

  // create DNS record
  await createLatencyRecord(region, domain, `${serviceName}-${region}`, logger);
};
