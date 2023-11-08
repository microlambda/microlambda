import { serviceName } from './service-name';
import {
  ApiGatewayV2Client,
  GetDomainNameCommand,
  GetDomainNameRequest,
  GetDomainNameResponse,
} from '@aws-sdk/client-apigatewayv2';
import { maxAttempts } from '../max-attempts';
import { IBaseLogger } from '@microlambda/types';

export const getCustomDomain = async (
  region: string,
  domainName: string,
  logger?: IBaseLogger,
): Promise<GetDomainNameResponse | undefined> => {
  const client = new ApiGatewayV2Client({ region, maxAttempts: maxAttempts() });
  const params: GetDomainNameRequest = {
    DomainName: domainName,
  };
  try {
    logger?.debug(serviceName, 'GetDomainNameCommand', params);
    return await client.send(new GetDomainNameCommand(params));
  } catch (e) {
    if ((e as Error).name === 'NotFoundException') {
      return undefined;
    }
    logger?.error(serviceName, 'GetDomainNameCommand failed');
    logger?.error(e);
    throw e;
  }
};
