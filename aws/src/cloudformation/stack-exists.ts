import {CloudFormationClient, ListStacksCommand} from "@aws-sdk/client-cloudformation";
import {maxAttempts} from "../max-attempts";
import {ListStacksCommandOutput} from "@aws-sdk/client-cloudformation/dist-types/commands/ListStacksCommand";
import {StackStatus} from "@aws-sdk/client-cloudformation/dist-types/models/models_0";

export const stackExists = async (params: {
  region: string,
  stackName: string,
  statuses?: StackStatus[],
}): Promise<boolean> => {
  const { region, stackName, statuses } = params;
  const client = new CloudFormationClient({
    region,
    maxAttempts: maxAttempts(),
  });
  let nextToken: string | undefined = undefined;
  do {
    const page: ListStacksCommandOutput = await client.send(new ListStacksCommand({
      NextToken: nextToken,
      StackStatusFilter: statuses,
    }));
    const matchingStack = page.StackSummaries?.find((stack) => stack.StackName === stackName);
    if (matchingStack) {
      return matchingStack.StackStatus !== 'DELETE_COMPLETE';
    }
    nextToken = page.NextToken;
  } while (nextToken)
  return false;
}
