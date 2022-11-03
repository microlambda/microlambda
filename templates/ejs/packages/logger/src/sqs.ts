import { AWSError, SQS } from 'aws-sdk';
import { PromiseResult } from 'aws-sdk/lib/request';
import { SendMessageResult } from 'aws-sdk/clients/sqs';

const sqs = new SQS({ region: process.env.AWS_REGION });

export const sendMessageToQueue = async <T = unknown>(
  payload: T,
  queueUrl: string,
): Promise<PromiseResult<SendMessageResult, AWSError>> => {
  return sqs
    .sendMessage({
      MessageBody: JSON.stringify(payload),
      QueueUrl: queueUrl,
    })
    .promise();
};
