import os from 'os';

const cpuCount = os.cpus().length;

export const getDefaultThreads = (): number => {
  return Math.floor(cpuCount / 2);
};

export const getThreads = (target: number): number => {
  if (target < 0 || !Number.isInteger(target)) {
    throw Error('Number of threads must be a strictly positive integer');
  }
  if (target > cpuCount) {
    return cpuCount;
  }
  return target;
};
