import {
  ApiGatewayV2Client,
  CreateDomainNameCommand,
  CreateDomainNameRequest,
  CreateDomainNameResponse,
  EndpointType,
} from "@aws-sdk/client-apigatewayv2";
import { serviceName } from "./service-name";
import { ILogger } from "../../types";

export const createCustomDomain = async (
  region: string,
  domainName: string,
  certificateArn: string,
  logger?: ILogger
): Promise<CreateDomainNameResponse> => {
  const client = new ApiGatewayV2Client({ region, maxAttempts: 5 });
  const params: CreateDomainNameRequest = {
    DomainName: domainName,
    DomainNameConfigurations: [
      {
        CertificateArn: certificateArn,
        SecurityPolicy: "TLS_1_2",
        EndpointType: EndpointType.REGIONAL,
      },
    ],
  };
  try {
    logger?.debug(serviceName, "CreateDomainNameCommand", params);
    return await client.send(new CreateDomainNameCommand(params));
  } catch (e) {
    logger?.error(serviceName, "CreateDomainNameCommand failed");
    logger?.error(e);
    throw e;
  }
};
