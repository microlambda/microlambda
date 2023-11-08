import chalk from 'chalk';
import { inspect } from 'util';

const printArg = (arg: unknown): string => {
  switch (typeof arg) {
    case 'number':
    case 'boolean':
    case 'bigint':
    case 'function':
    case 'symbol':
    case 'object':
      return inspect(arg, false, 3, true);
    case 'undefined':
      return 'undefined';
    case 'string':
      return arg;
  }
};

/* eslint-disable no-console */
export const logger = {
  took: (ms: number): string => chalk.magenta(`Took ${ms}ms`),
  hint: (...args: unknown[]): void => {
    console.info(args.map((a) => chalk.grey(printArg(a))).join(' '));
  },
  info: (...args: unknown[]): void => {
    console.log(args.map((a) => printArg(a)).join(' '));
  },
  success: (...args: unknown[]): void => {
    console.error(args.map((a) => chalk.green.bold(printArg(a))).join(' '));
  },
  warn: (...args: unknown[]): void => {
    console.error(args.map((a) => chalk.yellow.bold(printArg(a))).join(' '));
  },
  error: (...args: unknown[]): void => {
    console.error(args.map((a) => chalk.red.bold(printArg(a))).join(' '));
  },
  separator: (): void => {
    logger.info('———————————————————————————————————————————————');
  },
  lf: (): void => {
    process.stderr.write('\n');
  },
  debug(...args: unknown[]): void {
    if (process.env.MILA_DEBUG) {
      console.debug(chalk.bold.cyan('debug'), args.map((a) => printArg(a)).join(' '));
    }
  },
};
