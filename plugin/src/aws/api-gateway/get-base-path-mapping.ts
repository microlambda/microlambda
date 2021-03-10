import { serviceName } from "./service-name";
import {
  ApiGatewayV2Client,
  ApiMapping,
  GetApiMappingsCommand,
  GetApiMappingsRequest,
} from "@aws-sdk/client-apigatewayv2";
import { ILogger } from "../../types";

export const getBasePathMapping = async (
  region: string,
  domainName: string,
  basePath = "",
  logger?: ILogger
): Promise<ApiMapping | undefined> => {
  const client = new ApiGatewayV2Client({ region, maxAttempts: 5 });
  const params: GetApiMappingsRequest = {
    DomainName: domainName,
  };
  try {
    logger?.debug(serviceName, "GetBasePathMappingCommand", params);
    const mappings = await client.send(new GetApiMappingsCommand(params));
    return mappings?.Items?.find((m) => m.ApiMappingKey === basePath);
  } catch (e) {
    logger?.error(serviceName, "GetBasePathMappingCommand failed");
    logger?.error(e);
    throw e;
  }
};
