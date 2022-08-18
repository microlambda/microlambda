import * as aws from 'aws-sdk';
import { logger } from './logger';

const lambda = new aws.Lambda({ region: 'eu-west-1' });
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type,@typescript-eslint/no-explicit-any
export const localAuthorizer = async (event: any) => {
  let result;

  try {
    result = await authorize(event, 'dev');
  } catch (e) {
    result = await authorize(event, 'preprod');
  }

  return result;
};

const authorize = async (event: unknown, targetEnvName: string): Promise<unknown> => {
  return lambda
    .invoke({
      FunctionName: `dataportal-auth-${targetEnvName}-auth`,
      Payload: JSON.stringify(event),
      InvocationType: 'RequestResponse',
    })
    .promise()
    .then((result) => {
      logger.info(`[Authorizer] Remote ${targetEnvName} authorizer response`, result);
      if (result && result.Payload) {
        const response = JSON.parse(result.Payload as string);
        if (!response.errorMessage) {
          return response;
        }
      }
      throw new Error('Unauthorized');
    })
    .catch((e) => {
      logger.error(e);
      throw new Error('Unauthorized');
    });
};
