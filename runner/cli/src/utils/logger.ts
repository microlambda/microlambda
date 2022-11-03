import chalk from 'chalk';

/* eslint-disable no-console */
export const logger = {
  centipod: `${chalk.cyan.bold('>')} ${chalk.bgCyan.black.bold(' MILA RUNNER ')}`,
  failed: chalk.bgRedBright.black.bold(' FAILED '),
  success: chalk.bgGreen.black.bold(' SUCCESS '),
  fromCache: chalk.bgCyanBright.bold.black(' FROM CACHE '),
  fromRemoteCache: chalk.bgCyanBright.bold.black(' FROM REMOTE CACHE '),
  took: (ms: number): string => chalk.magenta(`Took ${ms}ms`),
  info: (...args: unknown[]): void => {
    console.info(args.map(a => chalk.grey(a)).join(' '));
  },
  log: (...args: unknown[]): void => {
    console.log(args.join(' '));
  },
  error: (...args: unknown[]): void => {
    console.error(args.map(a => chalk.red.bold(a)).join(' '));
  },
  seperator: (): void => {
    logger.info('———————————————————————————————————————————————');
  },
  lf: (): void => {
    process.stderr.write('\n');
  },
}
