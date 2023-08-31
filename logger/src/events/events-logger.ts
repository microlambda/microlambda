import { bold } from 'chalk';
import { inspect } from 'util';
import { DEFAULT_INSPECT_DEPTH } from './defaults';
import {IBaseLogger, IEventLog} from '@microlambda/types';
import { EventsLog } from './events-log';
import { IEventsLogEntry, EventsLogBuffer } from './events-log-entry';
import { IEventLogOptions, LogLevel } from './options';
import { IEventsLogHandler } from './handlers';
import {Subject} from "rxjs";

export class EventsLogger implements IBaseLogger {
  constructor(
    readonly logger: EventsLog,
    readonly options: IEventLogOptions,
    readonly level: LogLevel | 'silent',
    readonly buffer: EventsLogBuffer,
    readonly handlers: IEventsLogHandler[],
    private readonly _logs$: Subject<IEventLog>,
    readonly scope?: string,
  ) {}

  get inScope(): boolean {
    if (!process.env.MILA_DEBUG) {
      return false;
    }
    if (!this.scope || process.env.MILA_DEBUG === '*') {
      return true;
    }
    const scopes = process.env.MILA_DEBUG.split(',');
    const wildcardMatch = (scope: string, rule: string): boolean => {
      const escapeRegex = (str: string): string => str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
      return new RegExp('^' + rule.split('*').map(escapeRegex).join('.*') + '$').test(scope);
    };
    return scopes.some((scope) => wildcardMatch(this.scope!, scope));
  }

  getLogs(level = 'info', scopes?: string[]): IEventsLogEntry[] {
    const getLvl = (): string[] => {
      switch (level) {
        case 'warn':
          return ['error', 'warn'];
        case 'error':
          return ['error'];
        case 'debug':
          return ['error', 'warn', 'info', 'debug'];
        case 'silly':
          return ['error', 'warn', 'info', 'debug', 'silly'];
        default:
          return ['error', 'warn', 'info'];
      }
    };
    const lvl = getLvl();
    let logs = [...this.buffer.filter((log) => lvl.includes(log.level))];
    if (scopes) {
      logs = logs.filter((entry) => entry.scope && scopes.includes(entry.scope));
    }
    logs.forEach((entry) => entry.args = entry.args.map((a) => this._toString(a)));
    return logs;
  }

  silly(...args: unknown[]): void {
    if (['silly'].includes(this.level) && this.inScope) {
      // eslint-disable-next-line no-console
      console.debug(this.options.prefix.silly, bold(this.scope), ...args.map(this._toString.bind(this)));
    }
    this._handleLogEntry('silly', args);
  }

  debug(...args: unknown[]): void {
    if (['silly', 'debug'].includes(this.level) && this.inScope) {
      // eslint-disable-next-line no-console
      console.debug(this.options.prefix.debug, bold(this.scope), ...args.map(this._toString.bind(this)));
    }
    this._handleLogEntry('debug', args);
  }

  info(...args: unknown[]): void {
    if (['silly', 'debug', 'info'].includes(this.level) && this.inScope) {
      // eslint-disable-next-line no-console
      console.info(this.options.prefix.info, bold(this.scope), ...args.map(this._toString.bind(this)));
    }
    this._handleLogEntry('info', args);
  }

  warn(...args: unknown[]): void {
    if (['silly', 'debug', 'info', 'warn'].includes(this.level) && this.inScope) {
      // eslint-disable-next-line no-console
      console.warn(this.options.prefix.warn, bold(this.scope), ...args.map(this._toString.bind(this)));
    }
    this._handleLogEntry('warn', args);
  }

  error(...args: unknown[]): void {
    if (['silly', 'debug', 'info', 'warn', 'error'].includes(this.level)) {
      // eslint-disable-next-line no-console
      console.error(this.options.prefix.error, bold(this.scope), ...args.map(this._toString.bind(this)));
    }
    this._handleLogEntry('error', args);
  }

  private _handleLogEntry(level: LogLevel, args: unknown[]): void {
    const entry = this._toEntry(level, args);
    this.buffer.push(entry);
    if (this.buffer.length >= this.options.bufferSize) {
      this.buffer.shift();
    }
    this.handlers.forEach((handler) => handler.write(entry));
    this._logs$.next({ ...entry, args: args.map((a) => this._toString(a))});
  }

  private _toEntry(level: LogLevel, args: unknown[]): IEventsLogEntry {
    return {
      level,
      date: new Date().toISOString(),
      scope: this.scope,
      args: args,
    };
  }

  private _toString(arg: unknown): string {
    return typeof arg === 'string'
      ? arg
      : inspect(arg, false, this.options?.inspectDepth || DEFAULT_INSPECT_DEPTH, true);
  }
}
