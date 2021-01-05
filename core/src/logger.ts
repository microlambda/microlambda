import { blue, green, cyan, yellow, red, bold } from 'chalk';
import { inspect } from 'util';

/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
type LoggerFunction = (...args: any[]) => void;

export interface ILogger {
  silly: LoggerFunction;
  debug: LoggerFunction;
  info: LoggerFunction;
  warn: LoggerFunction;
  error: LoggerFunction;
}

export const prefix = {
  info: green('[INFO]'),
  error: red('[ERROR]'),
};

type LogLevel = 'silly' | 'debug' | 'info' | 'warn' | 'error';

export interface IEventLog {
  level: LogLevel;
  date: string;
  scope: string;
  args: string[];
}

export class Logger {
  private _logs: IEventLog[] = [];

  //private _io: IOSocketManager;

  /*setIO(io: IOSocketManager): void {
    this._io = io;
  }*/

  get logs(): IEventLog[] {
    return this._logs;
  }

  log(scope?: string): ILogger {
    const logLevel = ['silent', 'silly', 'debug', 'info', 'warn', 'error'].includes(process.env.MILA_LOG_LEVEL)
      ? process.env.MILA_LOG_LEVEL
      : 'silent';
    const inScope =
      process.env.MILA_DEBUG === '*' || (process.env.MILA_DEBUG && process.env.MILA_DEBUG.split(',').includes(scope));
    const isPrimitive = (arg: any): boolean =>
      typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean';
    const toEvent = (level: LogLevel, args: any[]): IEventLog => ({
      level,
      date: new Date().toISOString(),
      scope,
      args: args.map((arg) => (isPrimitive(arg) ? arg : inspect(arg, null, 2, false))),
    });
    /*const toIO = (event: IEventLog): void => {
      if (this._io) {
        this._io.eventLogAdded(event);
      }
    };*/
    return {
      silly: (...args: any[]): void => {
        const event = toEvent('silly', args);
        if (['silly'].includes(logLevel) && inScope) {
          console.debug(cyan('[SILLY]'), bold(scope), ...args);
        }
        this._logs.push(event);
        //toIO(event);
      },
      debug: (...args: any[]): void => {
        const event = toEvent('debug', args);
        if (['silly', 'debug'].includes(logLevel) && inScope) {
          console.debug(blue('[DEBUG]'), bold(scope), ...args);
        }
        this._logs.push(event);
        //toIO(event);
      },
      info: (...args: any[]): void => {
        const event = toEvent('info', args);
        if (['silly', 'debug', 'info'].includes(logLevel)) {
          console.info(prefix.info, ...args);
        }
        this._logs.push(event);
        //toIO(event);
      },
      warn: (...args: any[]): void => {
        const event = toEvent('warn', args);
        if (['silly', 'debug', 'info', 'warn'].includes(logLevel)) {
          console.info(yellow('[WARNING]', ...args));
        }
        this._logs.push(event);
        //toIO(event);
      },
      error: (...args: any[]): void => {
        const event = toEvent('error', args);
        if (['silly', 'debug', 'info', 'warn', 'error'].includes(logLevel)) {
          console.info(prefix.error, ...args);
        }
        this._logs.push(event);
        //toIO(event);
      },
    };
  }
}
