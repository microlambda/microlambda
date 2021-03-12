import {
  ACMClient,
  DescribeCertificateCommand,
  DescribeCertificateRequest,
  DescribeCertificateResponse,
} from "@aws-sdk/client-acm";
import { ILogger } from "../../types";
import { serviceName } from "./service-name";
import { maxAttempts } from "../../utils/max-attempts";

export const describeCertificate = async (
  region: string,
  arn: string,
  logger?: ILogger
): Promise<DescribeCertificateResponse> => {
  const certificateManager = new ACMClient({
    region,
    maxAttempts: maxAttempts({ apiRateLimit: 10 }, logger),
  });
  const params: DescribeCertificateRequest = {
    CertificateArn: arn,
  };
  logger?.debug(serviceName, "Sending DescribeCertificateCommand", params);
  try {
    return await certificateManager.send(
      new DescribeCertificateCommand(params)
    );
  } catch (e) {
    logger?.error(serviceName, "DescribeCertificateCommand failed");
    logger?.error(e);
    throw e;
  }
};
