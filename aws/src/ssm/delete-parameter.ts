import {
  DeleteParameterCommand,
  SSMClient,
} from '@aws-sdk/client-ssm';
import { IBaseLogger } from "@microlambda/types";
import { maxAttempts } from "../max-attempts";

/**
 * Delete a SSM parameter in a given region by a given name or ARN
 * @param region - the SSM parameter in which the SSM parameter should be deleted
 * @param name - the SSM parameter's name, alternatively the full ARN can be given
 * @param logger - A logger instance to print logs
 */
export const deleteParameter = async (
  region: string,
  name: string,
  logger?: IBaseLogger
): Promise<void> => {
  const ssm = new SSMClient({
    region,
    maxAttempts: maxAttempts({ apiRateLimit: 50 }, logger),
  });
  logger?.debug("DeleteParameterCommand", { Name: name });
  await ssm.send(new DeleteParameterCommand({ Name: name }));
};
