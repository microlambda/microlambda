import os from 'os';

const cpuCount = os.cpus().length;

/**
 * @desc returns the number of threads to use by default
 * which is half of CPU threads available on the machine
 */
export const getDefaultThreads = (): number => {
  return Math.max(1, Math.floor(cpuCount * 0.5));
};

/**
 * @desc Validate and return number of threads
 * If target is greater than available threads on the machine, returns
 * maximum threads available.
 * Throw if target value is not a positive integer
 * @param target - the number of thread we want to use.
 */
export const getThreads = (target: number): number => {
  if (target <= 0 || !Number.isInteger(target)) {
    throw Error('Number of threads must be a strictly positive integer');
  }
  if (target === 0 || target > cpuCount) {
    return cpuCount;
  }
  return target;
};
