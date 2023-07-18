import { IBaseLogger } from '@microlambda/types';
import { maxAttempts } from '../max-attempts';
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

/**
 * Get a SSM parameter value
 * @param region - the region where the parameter is located
 * @param name - the parameter's name
 * @param logger - A logger instance to print logs
 */
export const getParameterValue = async (
  region: string,
  name: string,
  logger?: IBaseLogger,
): Promise<string | undefined> => {
  const ssm = new SSMClient({
    region,
    maxAttempts: maxAttempts({ apiRateLimit: 50 }, logger),
  });
  const getValue = new GetParameterCommand({
    Name: name,
  });
  return (await ssm.send(getValue)).Parameter?.Value;
};
