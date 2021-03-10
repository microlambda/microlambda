import { serviceName } from "./service-name";
import { ILogger } from "../../types";
import {
  ApiGatewayV2Client,
  UpdateApiMappingCommand,
  UpdateApiMappingRequest,
  UpdateApiMappingResponse,
} from "@aws-sdk/client-apigatewayv2";

export const updateBasePathMapping = async (
  region: string,
  domainName: string,
  mappingId: string,
  apiId?: string,
  basePath?: string,
  stage?: string,
  logger?: ILogger
): Promise<UpdateApiMappingResponse> => {
  const client = new ApiGatewayV2Client({ region, maxAttempts: 5 });
  const params: UpdateApiMappingRequest = {
    ApiId: apiId,
    DomainName: domainName,
    Stage: stage,
    ApiMappingId: mappingId,
    ApiMappingKey: basePath,
  };
  try {
    logger?.debug(serviceName, "UpdateApiMappingCommand", params);
    return await client.send(new UpdateApiMappingCommand(params));
  } catch (e) {
    logger?.error(serviceName, "UpdateApiMappingCommand failed");
    logger?.error(e);
    throw e;
  }
};
