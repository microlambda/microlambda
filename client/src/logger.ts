/* eslint-disable no-console */

type Logger = (...args: unknown[]) => void;

interface ILogger {
  debug: Logger;
  info: Logger;
  warn: Logger;
  error: Logger;
}

export const logger = {
  scope: (scope: string): ILogger => ({
    debug: (...args: unknown[]): void => console.debug(scope, ...args),
    info: (...args: unknown[]): void => console.info(scope, ...args),
    warn: (...args: unknown[]): void => console.warn(scope, ...args),
    error: (...args: unknown[]): void => console.error(scope, ...args),
  }),
};
