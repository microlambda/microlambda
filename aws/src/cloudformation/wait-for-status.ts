import {StackStatus} from "@aws-sdk/client-cloudformation/dist-types/models/models_0";
import {CloudFormationClient, ListStacksCommand} from "@aws-sdk/client-cloudformation";
import {maxAttempts} from "../max-attempts";
import {ListStacksCommandOutput} from "@aws-sdk/client-cloudformation/dist-types/commands/ListStacksCommand";
import {StackSummary} from "@aws-sdk/client-cloudformation/dist-types/models";
import {IBaseLogger} from "@microlambda/types";

const DEFAULT_POLLING_INTERVAL = 2 * 1000; // 2sec
const DEFAULT_TIMEOUT = 10 * 60 * 1000; // 10min

export const waitForStackStatus = async (params: {
  region: string,
  stackName: string,
  status: StackStatus,
  failOn?: StackStatus[],
  pollingInterval?: number,
  timeout?: number;
}, logger?: IBaseLogger): Promise<void> => {
  const { stackName, region, status, pollingInterval, timeout, failOn } = params;
  const _timeout = timeout ?? DEFAULT_TIMEOUT;

  const client = new CloudFormationClient({
    region,
    maxAttempts: maxAttempts(),
  });
  logger?.debug('Waiting for status', status);

  const findStack = async (): Promise<StackSummary | undefined> => {
    let nextToken: string | undefined = undefined;
    do {
      const page: ListStacksCommandOutput = await client.send(new ListStacksCommand({
        NextToken: nextToken,
        StackStatusFilter: [status, ...(failOn ?? [])],
      }));
      const matchingStack = page.StackSummaries?.find((stack) => stack.StackName === stackName);
      if (matchingStack) {
        return matchingStack;
      }
      nextToken = page.NextToken;
    } while (nextToken)
    return undefined;
  }

  return new Promise((resolve, reject) => {
    const intervalHandle = setInterval(() => {
      const timeoutHandle = setTimeout(() => {
        clearInterval(intervalHandle);
        reject(new Error(`Stack status did not changed after timeout ${_timeout}`))
      }, _timeout);

      findStack()
        .then((stack) => {
          logger?.debug('Stack has status', stack?.StackStatus);
          if (stack?.StackStatus === status) {
            return resolve();
          } else if (failOn && stack?.StackStatus && failOn?.includes(stack.StackStatus as StackStatus)) {
            return reject(new Error(`Stack has status ${stack?.StackStatus}`));
          }
        }).catch((err) => {
        clearTimeout(timeoutHandle);
        clearInterval(intervalHandle);
        return reject(err);
      });
    }, pollingInterval ?? DEFAULT_POLLING_INTERVAL);
  });
}
