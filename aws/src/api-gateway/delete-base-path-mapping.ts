import { serviceName } from './service-name';
import { ApiGatewayV2Client, DeleteApiMappingCommand, DeleteApiMappingRequest } from '@aws-sdk/client-apigatewayv2';
import { getBasePathMapping } from './get-base-path-mapping';
import { maxAttempts } from '../max-attempts';
import { IBaseLogger } from '@microlambda/types';

export const deleteBasePathMapping = async (
  region: string,
  domainName: string,
  basePath?: string,
  logger?: IBaseLogger,
): Promise<void> => {
  const client = new ApiGatewayV2Client({ region, maxAttempts: maxAttempts() });
  const mapping = await getBasePathMapping(region, domainName, basePath);
  if (!mapping) {
    logger?.info('Base path mapping does not exists, nothing to delete');
    return;
  }
  const params: DeleteApiMappingRequest = {
    DomainName: domainName,
    ApiMappingId: mapping.ApiMappingId,
  };
  try {
    logger?.debug(serviceName, 'DeleteBasePathMappingCommand', params);
    await client.send(new DeleteApiMappingCommand(params));
  } catch (e) {
    logger?.error(serviceName, 'DeleteBasePathMappingCommand failed');
    logger?.error(e);
    throw e;
  }
};
