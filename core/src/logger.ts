import { blue, green, cyan, yellow, red, bold } from 'chalk';
import { inspect } from 'util';
import { Subject } from 'rxjs';

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
  scope?: string;
  args: string[];
}

export class Logger {
  private _logs: IEventLog[] = [];

  private _logs$: Subject<IEventLog> = new Subject<IEventLog>();
  public logs$ = this._logs$.asObservable();

  get logs(): IEventLog[] {
    return this._logs;
  }

  log(scope?: string): ILogger {
    const logLevel: string = ['silent', 'silly', 'debug', 'info', 'warn', 'error'].includes(
      String(process.env.MILA_LOG_LEVEL),
    )
      ? String(process.env.MILA_LOG_LEVEL)
      : 'silent';
    const inScope =
      process.env.MILA_DEBUG === '*' ||
      (process.env.MILA_DEBUG && process.env.MILA_DEBUG.split(',').includes(scope || ''));
    const isPrimitive = (arg: any): boolean =>
      typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean';
    const toEvent = (level: LogLevel, args: any[]): IEventLog => ({
      level,
      date: new Date().toISOString(),
      scope,
      args: args.map((arg) => (isPrimitive(arg) ? arg : inspect(arg, false, 2, false))),
    });

    return {
      silly: (...args: any[]): void => {
        const event = toEvent('silly', args);
        if (['silly'].includes(logLevel) && inScope) {
          console.debug(cyan('[SILLY]'), bold(scope), ...args);
        }
        this._logs.push(event);
        this._logs$.next(event);
      },
      debug: (...args: any[]): void => {
        const event = toEvent('debug', args);
        if (['silly', 'debug'].includes(logLevel) && inScope) {
          console.debug(blue('[DEBUG]'), bold(scope), ...args);
        }
        this._logs.push(event);
        this._logs$.next(event);
      },
      info: (...args: any[]): void => {
        const event = toEvent('info', args);
        if (['silly', 'debug', 'info'].includes(logLevel)) {
          console.info(prefix.info, ...args);
        }
        this._logs.push(event);
        this._logs$.next(event);
      },
      warn: (...args: any[]): void => {
        const event = toEvent('warn', args);
        if (['silly', 'debug', 'info', 'warn'].includes(logLevel)) {
          console.info(yellow('[WARNING]', ...args));
        }
        this._logs.push(event);
        this._logs$.next(event);
      },
      error: (...args: any[]): void => {
        const event = toEvent('error', args);
        if (['silly', 'debug', 'info', 'warn', 'error'].includes(logLevel)) {
          console.info(prefix.error, ...args);
        }
        this._logs.push(event);
        this._logs$.next(event);
      },
    };
  }
}
