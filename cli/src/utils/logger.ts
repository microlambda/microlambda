import { blue, green, cyan, yellow, red, bold } from 'chalk';

/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
type LoggerFunction = (...args: any[]) => void;

interface ILogger {
  silly: LoggerFunction;
  debug: LoggerFunction;
  info: LoggerFunction;
  warn: LoggerFunction;
  error: LoggerFunction;
}

export const prefix = {
  info: green('[INFO]'),
};

export const log = (scope?: string): ILogger => {
  const logLevel = ['silent', 'silly', 'debug', 'info', 'warn', 'error'].includes(process.env.MILA_LOG_LEVEL)
    ? process.env.MILA_LOG_LEVEL
    : 'info';
  const inScope =
    process.env.MILA_DEBUG === '*' || (process.env.MILA_DEBUG && process.env.MILA_DEBUG.split(',').includes(scope));
  return {
    silly: (...args: any[]): void => {
      if (['silly'].includes(logLevel) && inScope) {
        console.debug(cyan('[SILLY]'), bold(scope), ...args);
      }
    },
    debug: (...args: any[]): void => {
      if (['silly', 'debug'].includes(logLevel) && inScope) {
        console.debug(blue('[DEBUG]'), bold(scope), ...args);
      }
    },
    info: (...args: any[]): void => {
      if (['silly', 'debug', 'info'].includes(logLevel)) {
        console.info(prefix.info, ...args);
      }
    },
    warn: (...args: any[]): void => {
      if (['silly', 'debug', 'info', 'warn'].includes(logLevel)) {
        console.info(yellow('[WARNING]', ...args));
      }
    },
    error: (...args: any[]): void => {
      if (['silly', 'debug', 'info', 'warn', 'error'].includes(logLevel)) {
        console.info(red('[ERROR]', ...args));
      }
    },
  };
};
