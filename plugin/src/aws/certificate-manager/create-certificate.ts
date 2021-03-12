import {
  ACMClient,
  RequestCertificateCommand,
  RequestCertificateRequest,
  RequestCertificateResponse,
} from "@aws-sdk/client-acm";
import { ILogger } from "../../types";
import { serviceName } from "./service-name";
import { maxAttempts } from "../../utils/max-attempts";

export const createCertificate = async (
  region: string,
  targetDomain: string,
  logger?: ILogger
): Promise<RequestCertificateResponse> => {
  const certificateManager = new ACMClient({
    region,
    maxAttempts: maxAttempts({ apiRateLimit: 5 }, logger),
  });
  const params: RequestCertificateRequest = {
    DomainName: targetDomain,
    ValidationMethod: "DNS",
  };
  logger?.debug(serviceName, "Sending RequestCertificateCommand", params);
  try {
    return await certificateManager.send(new RequestCertificateCommand(params));
  } catch (e) {
    logger?.error(serviceName, "RequestCertificateCommand failed");
    logger?.error(e);
    throw e;
  }
};
