import { PutParameterCommand, PutParameterCommandOutput, SSMClient } from '@aws-sdk/client-ssm';
import { IBaseLogger } from '@microlambda/types';
import { maxAttempts } from '../max-attempts';

/**
 * Create/update a SSM parameter in a specific region.
 * If the SSM parameter exists, the SSM parameter will be updated otherwise t will be created
 * @param region - The region in which the SSM parameter should be created
 * @param name - The name of the SSM parameter
 * @param value - The SSM parameter string value to be ciphered
 * @param options - Optional description and KMS key to use to cipher SSM parameter. If no key is given
 * @param logger - A logger instance to print logs
 * the default KMS key for SSM will be used (Amazon auto-creates it if not exist)
 */
export const putParameter = async (
  region: string,
  name: string,
  value: string,
  options?: { description?: string; kmsKeyId?: string },
  logger?: IBaseLogger
): Promise<PutParameterCommandOutput> => {
  const ssm = new SSMClient({
    region,
    maxAttempts: maxAttempts({ apiRateLimit: 5 }, logger),
  });
  return await ssm.send(
    new PutParameterCommand({
      Name: name,
      Value: value,
      Description: options?.description,
    }),
  );
};
