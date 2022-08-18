/* eslint-disable no-console */
enum LogVerbosity {
  SILLY,
  DEBUG,
  LOG,
  INFO,
  WARN,
  ERROR,
  SILENT,
}

const logLevel = (): LogVerbosity => {
  switch (process.env.env) {
    case 'test':
    case undefined:
      return process.env.NODE_ENV === 'test' ? LogVerbosity.SILENT : LogVerbosity.DEBUG;
    case 'prod':
      return LogVerbosity.INFO;
    case 'preprod':
    case 'staging':
      return LogVerbosity.WARN;
    case 'int':
      return LogVerbosity.DEBUG;
    default:
      return LogVerbosity.SILLY;
  }
};

export const logger = {
  silly: (...args: unknown[]): void => {
    if (logLevel() <= LogVerbosity.SILLY) {
      console.debug('[SILLY]', ...args);
    }
  },
  debug: (...args: unknown[]): void => {
    if (logLevel() <= LogVerbosity.DEBUG) {
      console.debug(...args);
    }
  },
  log: (...args: unknown[]): void => {
    if (logLevel() <= LogVerbosity.LOG) {
      console.log(...args);
    }
  },
  info: (...args: unknown[]): void => {
    if (logLevel() <= LogVerbosity.INFO) {
      console.info(...args);
    }
  },
  warn: (...args: unknown[]): void => {
    if (logLevel() <= LogVerbosity.WARN) {
      console.warn(...args);
    }
  },
  error: (...args: unknown[]): void => {
    if (logLevel() <= LogVerbosity.ERROR) {
      console.error(...args);
    }
  },
};
