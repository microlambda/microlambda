import {
  CloudFormationClient,
  DescribeStackResourceCommand,
  DescribeStackResourceCommandOutput,
} from '@aws-sdk/client-cloudformation';
import { serviceName } from './service-name';
import { IBaseLogger } from '@microlambda/types';
import { maxAttempts } from '../max-attempts';

export const getStackResource = async (
  region: string,
  logicalResourceId: string,
  stackName: string,
  logger?: IBaseLogger,
): Promise<DescribeStackResourceCommandOutput> => {
  const client = new CloudFormationClient({
    region,
    maxAttempts: maxAttempts(),
  });
  try {
    const params = {
      LogicalResourceId: logicalResourceId,
      StackName: stackName,
    };
    logger?.debug(serviceName, 'Fetching stack resource', params);
    const response = await client.send(new DescribeStackResourceCommand(params));
    logger?.debug(serviceName, 'Fetched stack resource', response);
    return response;
  } catch (e) {
    logger?.error(serviceName, 'Cannot get stack resource:');
    logger?.error(e);
    throw e;
  }
};
