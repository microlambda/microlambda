import { serviceName } from "./service-name";
import {
  ApiGatewayV2Client,
  ApiMapping,
  GetApiMappingsCommand,
  GetApiMappingsRequest,
} from "@aws-sdk/client-apigatewayv2";
import { ILogger } from "../../types";
import { maxAttempts } from "../../utils/max-attempts";

export const getBasePathMapping = async (
  region: string,
  domainName: string,
  basePath = "",
  logger?: ILogger
): Promise<ApiMapping | undefined> => {
  let nextToken: string | undefined = undefined;
  do {
    const client = new ApiGatewayV2Client({ region, maxAttempts: maxAttempts() });
    const params: GetApiMappingsRequest = {
      DomainName: domainName,
      NextToken: nextToken,
    };
    try {
      logger?.debug(serviceName, "GetBasePathMappingCommand", params);
      const mappings = await client.send(new GetApiMappingsCommand(params));
      nextToken = mappings.NextToken;
      const mapping = mappings?.Items?.find((m) => m.ApiMappingKey === basePath);
      if (mapping) {
        return mapping;
      }
    } catch (e) {
      logger?.error(serviceName, "GetBasePathMappingCommand failed");
      logger?.error(e);
      throw e;
    }
  } while (nextToken)
  return undefined;
};
