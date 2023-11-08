import { CloudFormationClient, DescribeStacksCommand, StackResourceDetail } from '@aws-sdk/client-cloudformation';
import { getStackResource } from './get-stack-resource';
import { serviceName } from './service-name';
import { IBaseLogger } from '@microlambda/types';
import { maxAttempts } from '../max-attempts';

export const getNestedStackResource = async (
  region: string,
  logicalResourceId: string,
  stackName: string,
  logger?: IBaseLogger,
): Promise<StackResourceDetail | undefined> => {
  // get all stacks from the CloudFormation
  const client = new CloudFormationClient({
    region,
    maxAttempts: maxAttempts(),
  });
  let nextToken: string | undefined;
  let page = 0;
  let resource: StackResourceDetail | undefined;
  do {
    page++;
    logger?.debug(serviceName, 'Listing stacks', { page });
    logger?.debug(serviceName, 'DescribeStacksCommand', {
      NextToken: nextToken,
    });
    const getPage = new DescribeStacksCommand({
      NextToken: nextToken,
    });
    try {
      const result = await client.send(getPage);
      logger?.debug(serviceName, 'Found results', result.Stacks?.length);
      nextToken = result.NextToken;
      logger?.debug(serviceName, 'Next token updated', { nextToken });
      const matchingStacks = result.Stacks?.filter((s) => s.StackName?.includes(stackName)) || [];
      for (const stack of matchingStacks) {
        const response = await getStackResource(region, logicalResourceId, stack.StackName!);
        resource = response.StackResourceDetail;
        break;
      }
    } catch (e) {
      logger?.error(serviceName, 'Error listing stacks', e);
      throw e;
    }
  } while (nextToken != null && !resource);
  return resource;
};
