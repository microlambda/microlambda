import { Lambda } from 'aws-sdk';

const isTestEnv = process.env.ENV === 'test' || process.env.env === 'test' || process.env.NODE_ENV === 'test';

const lambda = new Lambda({
  region: isTestEnv ? 'localhost' : 'eu-west-1',
  endpoint: isTestEnv ? `http://localhost:${process.env.SLS_PORT}` : undefined,
});

/**
 * Invoke a lambda either locally or in AWS environment based on process.env with
 * a RequestResponse invocation type.
 * Parse response payload and catch/format properly error responses
 * @param name : the complete name of the function to invoke
 * @param payload : the request payload
 */
export const invokeLambda = async (name: string, payload: any) => {
  try {
    const response = await lambda
      .invoke({
        FunctionName: name,
        Payload: JSON.stringify(payload),
        InvocationType: 'RequestResponse',
      })
      .promise();
    const parsed = JSON.parse(response.Payload.toString());
    let body: any;
    if (parsed.body) {
      try {
        body = JSON.parse(parsed.body);
      } catch {
        body = parsed.body;
      }
    }
    return {
      statusCode: parsed.statusCode,
      body,
    };
  } catch (e) {
    return {
      statusCode: e.StatusCode || 500,
      body: e.Payload || { msg: 'Uknown error: ', details: e },
    };
  }
};
