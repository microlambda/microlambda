import { IBaseLogger } from '@microlambda/types';

const DEFAULT_ATTEMPTS = 10;
const DEFAULT_CONCURRENCY = 100;

/**
 * Choose the correct number of attempts according to Amazon API quotas
 * AWS SDK v3 uses exponential backoff strategy by default.
 * Initial delay is 100ms and for a given attempt, next call is delayed
 * by Math.min(20s, Math.random() * Math.pow(2, attempt) * 100ms)
 * Thus, the randomized delay for a given iteration is for instance:
 * -> 4th iteration, between 0 and 1.6s
 * -> 5th iteration, between 0 and 3.2s ...
 * -> 8th iteration and more between 0 and 20s (very likely 20s after 10th iterations as 20s will
 * have great chances to be lower than Math.random() * Math.pow(2, attempt) * 100ms)
 * As a rule of thumb we consider that you need has many attempts as
 * the number operation to do divided by amazon API rate limit (req/s)
 * E.g to create 100 API gateway custom domain concurrently. Amazon quotas is 1 req every 30 seconds)
 * So you'll need at least 50min, in other words at least 160 iterations
 * @param options - the option to calculate max attempts. Including the API limit rate in request/seconds
 * @param logger - a logger instance to print debug logs
 * and the number of actions to perform concurrently
 */
export const maxAttempts = (
  options?: { apiRateLimit: number; nbActions?: number },
  logger?: IBaseLogger
): number => {
  if (!options) {
    return DEFAULT_ATTEMPTS;
  }
  const nbServices = Number.isInteger(Number(process.env.MILA_SERVICE_LENGTH))
    ? Number(process.env.MILA_SERVICE_LENGTH)
    : DEFAULT_CONCURRENCY;
  const nbActions = options.nbActions ? options.nbActions : nbServices;
  const secondsRequired = Math.round(nbActions / options.apiRateLimit);
  const iterationsRequired = 10 + secondsRequired / 20;
  const result = Math.floor(1.2 * iterationsRequired);
  logger?.debug(
    `Should be able to perform ${nbActions} with an API limit rate of ${options.apiRateLimit}req/s. Max attempts has been set to ${result}`
  );
  return result;
};
