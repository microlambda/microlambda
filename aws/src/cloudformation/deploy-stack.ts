import { stackExists } from './stack-exists';
import { CloudFormationClient, CreateStackCommand, UpdateStackCommand } from '@aws-sdk/client-cloudformation';
import { maxAttempts } from '../max-attempts';
import { waitForStackStatus } from './wait-for-status';
import { IBaseLogger } from '@microlambda/types';

export const deployStack = async (
  params: {
    region: string;
    stackName: string;
    templateBody: string;
  },
  logger?: IBaseLogger,
): Promise<void> => {
  const { stackName, region, templateBody } = params;
  const client = new CloudFormationClient({
    region,
    maxAttempts: maxAttempts(),
  });
  if (await stackExists({ region, stackName })) {
    try {
      logger?.debug('Updating stack');
      await client.send(
        new UpdateStackCommand({
          StackName: stackName,
          TemplateBody: templateBody,
        }),
      );
    } catch (e) {
      if ((e as Error).message.includes('No updates are to be performed')) {
        return;
      }
      throw e;
    }
    await waitForStackStatus(
      {
        region,
        stackName,
        status: 'UPDATE_COMPLETE',
        failOn: ['CREATE_FAILED', 'ROLLBACK_COMPLETE', 'ROLLBACK_FAILED'],
      },
      logger,
    );
  } else {
    logger?.debug('Creating stack');
    await client.send(
      new CreateStackCommand({
        StackName: stackName,
        TemplateBody: templateBody,
      }),
    );
    await waitForStackStatus(
      {
        region,
        stackName,
        status: 'CREATE_COMPLETE',
        failOn: [
          'UPDATE_FAILED',
          'ROLLBACK_FAILED',
          'ROLLBACK_COMPLETE',
          'UPDATE_ROLLBACK_FAILED',
          'UPDATE_ROLLBACK_COMPLETE',
        ],
      },
      logger,
    );
  }
};
