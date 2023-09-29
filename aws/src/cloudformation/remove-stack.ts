import { CloudFormationClient, DeleteStackCommand } from '@aws-sdk/client-cloudformation';
import { maxAttempts } from '../max-attempts';
import { waitForStackStatus } from './wait-for-status';

export const removeStack = async (params: { region: string; stackName: string }): Promise<void> => {
  const { stackName, region } = params;
  const client = new CloudFormationClient({
    region,
    maxAttempts: maxAttempts(),
  });
  await client.send(
    new DeleteStackCommand({
      StackName: stackName,
    }),
  );
  await waitForStackStatus({ region, stackName, status: 'DELETE_COMPLETE' });
};
