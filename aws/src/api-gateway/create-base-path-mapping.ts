import {
  ApiGatewayV2Client,
  CreateApiMappingCommand,
  CreateApiMappingCommandOutput,
  CreateApiMappingRequest,
} from "@aws-sdk/client-apigatewayv2";
import { serviceName } from "./service-name";
import { IBaseLogger } from '@microlambda/types';
import { maxAttempts } from '../max-attempts';

export const createBasePathMapping = async (
  region: string,
  domainName: string,
  apiId: string,
  stage: string,
  basePath?: string,
  logger?: IBaseLogger
): Promise<CreateApiMappingCommandOutput> => {
  const client = new ApiGatewayV2Client({ region, maxAttempts: maxAttempts() });
  const params: CreateApiMappingRequest = {
    ApiId: apiId,
    ApiMappingKey: basePath,
    DomainName: domainName,
    Stage: stage,
  };
  try {
    logger?.debug(serviceName, "CreateBasePathMappingCommand", params);
    return await client.send(new CreateApiMappingCommand(params));
  } catch (e) {
    logger?.error(serviceName, "CreateBasePathMappingCommand failed");
    logger?.error(e);
    throw e;
  }
};
