const print = (lvl: 'debug' | 'info' | 'warn' | 'error', ...args: unknown[]): void => {
  if (process.env.NODE_ENV !== 'test' || process.env.DEBUG_TESTS) {
    // eslint-disable-next-line no-console
    console[lvl](args);
  }
}

type IAbstractLoggerFunction =  (...args: unknown[]) => void;

export interface IAbstractLogger {
  log: (scope?: string) => IAbstractLoggerFunctions;
}

export interface IAbstractLoggerFunctions {
  silly: IAbstractLoggerFunction;
  debug: IAbstractLoggerFunction;
  info: IAbstractLoggerFunction;
  warn: IAbstractLoggerFunction;
  error: IAbstractLoggerFunction;
  logger: IAbstractLogger;
}

export const logger = {
  debug: (...args: unknown[]): void => print('debug', args),
  info: (...args: unknown[]): void => print('info', args),
  warn: (...args: unknown[]): void => print('warn', args),
  error: (...args: unknown[]): void => print('error', args),
}
