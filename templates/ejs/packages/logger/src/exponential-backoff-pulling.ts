import { logger } from './logger';

const MAX_RETRIES_EXPONENTIAL_BACKOFF = 30; // approximately 30 secs max in total before timeout

export const sleep = async (ms: number): Promise<void> => new Promise((resolve) => setTimeout(() => resolve(), ms));

const customExponentialBackoff = (nbRetries: number): number => (nbRetries <= 5 ? 2 ** nbRetries * 100 : 1000);

/**
 * Execute a function according a customized exponential backoff strategy
 * Real exponential backoff, but from nbRetries === 5, fallback on a constant backoff of 1 second
 * Fallback on a constant backoff because if not, it will timeout most of the time
 * Since MAX_RETRIES_EXPONENTIAL_BACKOFF is set to 30, it will timeout approximately after 30 seconds
 * @param functionToExecute function to execute with exponential backoff
 * @param nbRetries current number of retries
 */
export const executeWithCustomExponentialBackoff = async (
  functionToExecute: () => Promise<void>,
  nbRetries = 0,
): Promise<void> => {
  try {
    await functionToExecute();
  } catch (e) {
    if (nbRetries > MAX_RETRIES_EXPONENTIAL_BACKOFF) {
      throw e;
    }
    const interval = customExponentialBackoff(nbRetries);
    logger.debug(`Function threw an error, retry in ${interval} ms`);
    await sleep(interval);
    await executeWithCustomExponentialBackoff(functionToExecute, nbRetries + 1);
  }
};
