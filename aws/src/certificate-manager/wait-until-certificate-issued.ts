import { describeCertificate } from "./describe-certificate";
import { IBaseLogger } from "@microlambda/types";
import { serviceName } from "./service-name";
import { createActivationRecord, getHostedZone } from "../route53";
import { CertificateStatus } from "@aws-sdk/client-acm";

export const waitUntilCertificateIssued = async (
  domain: string,
  region: string,
  arn: string,
  polling = 10000,
  logger?: IBaseLogger
): Promise<void> => {
  const response = await describeCertificate(region, arn, logger);
  if (!response?.Certificate?.DomainValidationOptions) {
    throw new Error(`Certificate ${arn} does not exist in region ${region}`);
  }
  const details = response;
  logger?.debug(
    serviceName,
    "DescribeCertificateOutput",
    JSON.stringify(details, null, 2)
  );
  const record = details.Certificate?.DomainValidationOptions?.find(
    (dv) => dv.ResourceRecord
  )?.ResourceRecord;
  const hostedZone = await getHostedZone(domain, logger);
  const throwError = (): void => {
    logger?.error(
      "Cannot activate certificate. Related hosted zone not found on Route53"
    );
    logger?.error(
      "Ask your domain administrator to create the following CNAME record and re-run deployment"
    );
    logger?.error(record);
    throw Error("E_CERTIFICATE_ACTIVATION");
  };
  if (!hostedZone || !record) {
    return throwError();
  }
  logger?.info("Found related hosted zone", hostedZone);
  try {
    await createActivationRecord(hostedZone, record, logger);
    logger?.info("Create DNS record to activate certificate");
  } catch (e) {
    logger?.error(e);
    return throwError();
  }
  logger?.info(
    "Waiting for the certificate to be active. Please wait this can take up to 30 minutes"
  );

  return new Promise<void>((resolve, reject) => {
    const poll = setInterval(async () => {
      const details = await describeCertificate(region, arn);
      logger?.info("Status", details.Certificate?.Status);
      if (details.Certificate?.Status === "ISSUED") {
        clearInterval(poll);
        return resolve();
      }
      switch (details.Certificate?.Status) {
        case CertificateStatus.EXPIRED:
          clearInterval(poll);
          return reject("Certificate expired");
        case CertificateStatus.FAILED:
          clearInterval(poll);
          return reject("Certificate in failed state");
        case CertificateStatus.INACTIVE:
          clearInterval(poll);
          return reject("Certificate inactive");
        case CertificateStatus.ISSUED:
          clearInterval(poll);
          return resolve();
        case CertificateStatus.PENDING_VALIDATION:
          // Wait next polling iteration
          break;
        case CertificateStatus.REVOKED:
          clearInterval(poll);
          return reject("Certificate revoked");
        case CertificateStatus.VALIDATION_TIMED_OUT:
          clearInterval(poll);
          return reject("Certificate validation timed out");
      }
    }, polling);

    const THIRTY_MINUTES = 30 * 60 * 1000;
    setTimeout(() => {
      clearInterval(poll);
      logger?.error("Certificate was not issued within thirty minutes");
      logger?.error(
        "Please double-check that the correct activation record have been created"
      );
      return reject(Error("E_CERTIFICATE_ACTIVATION"));
    }, THIRTY_MINUTES);
  });
};
