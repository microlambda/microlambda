import { getStackResource } from './get-stack-resource';
import { getApiLogicalResourceId } from './get-api-logical-resource-id';
import { getNestedStackResource } from './get-nested-stack-resource';
import { serviceName } from './service-name';
import { ApiType } from '@microlambda/types';
import { IBaseLogger } from '@microlambda/types';

export const getApiId = async (
  region: string,
  stackName: string,
  apiType: ApiType = 'rest',
  logger?: IBaseLogger,
): Promise<string> => {
  const logicalResourceId = getApiLogicalResourceId(apiType);
  logger?.debug(serviceName, 'Finding stack resource', {
    region,
    stackName,
    logicalResourceId,
  });
  let resource;
  try {
    const response = await getStackResource(region, logicalResourceId, stackName, logger);
    // Stack has been found by name
    logger?.debug('Stack found by name', response);
    resource = response.StackResourceDetail;
  } catch (e) {
    logger?.debug(e);
    logger?.debug(serviceName, 'Something wrong happened, maybe the resource if in a nested stack');
    resource = await getNestedStackResource(region, logicalResourceId, stackName, logger);
  }
  if (!resource) {
    throw new Error(`Failed to find stack API Gateway resource ${logicalResourceId} for ${stackName}\n`);
  }
  const apiId = resource.PhysicalResourceId;
  if (!apiId) {
    throw new Error(`No ApiId associated with CloudFormation stack ${stackName}`);
  }
  return apiId;
};
