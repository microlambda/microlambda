import { bold } from 'chalk';
import { inspect } from 'util';
import { DEFAULT_INSPECT_DEPTH } from './defaults';
import { IBaseLogger } from '@microlambda/types';
import { EventsLog } from './events-log';
import { IEventsLogEntry, EventsLogBuffer } from './events-log-entry';
import { IEventLogOptions, LogLevel } from './options';
import { IEventsLogHandler } from './handlers';

export class EventsLogger implements IBaseLogger {
  constructor(
    readonly logger: EventsLog,
    readonly options: IEventLogOptions,
    readonly level: LogLevel | 'silent',
    readonly buffer: EventsLogBuffer,
    readonly handlers: IEventsLogHandler[],
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
      const escapeRegex = (str: string) => str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
      return new RegExp("^" + rule.split("*").map(escapeRegex).join(".*") + "$").test(scope);
    }
    return scopes.some((scope) => wildcardMatch(this.scope!, scope));
  }

  silly(...args: unknown[]): void {
    if (['silly'].includes(this.level) && this.inScope) {
      console.debug(this.options.prefix.silly, bold(this.scope), ...args.map(this._toString.bind(this)));
    }
    this._handleLogEntry('silly', args);
  }

  debug(...args: unknown[]): void {
    if (['silly', 'debug'].includes(this.level) && this.inScope) {
      console.debug(this.options.prefix.debug, bold(this.scope), ...args.map(this._toString.bind(this)));
    }
    this._handleLogEntry('debug', args);
  }

  info (...args: unknown[]): void {
    if (['silly', 'debug', 'info'].includes(this.level) && this.inScope) {
      console.info(this.options.prefix.info, bold(this.scope), ...args.map(this._toString.bind(this)));
    }
    this._handleLogEntry('info', args);
  }

  warn (...args: unknown[]): void {
    if (['silly', 'debug', 'info', 'warn'].includes(this.level) && this.inScope) {
      console.warn(this.options.prefix.warn, bold(this.scope), ...args.map(this._toString.bind(this)));
    }
    this._handleLogEntry('warn', args);
  }

  error(...args: unknown[]): void {
    if (['silly', 'debug', 'info', 'warn', 'error'].includes(this.level)) {
      console.error(this.options.prefix.error, bold(this.scope), ...args.map(this._toString.bind(this)));
    }
    this._handleLogEntry('error', args);
  }

  private _handleLogEntry(level: LogLevel, args: unknown[]) {
    const entry = this._toEntry(level, args);
    this.buffer.push(entry);
    if (this.buffer.length >= this.options.bufferSize) {
      this.buffer.shift();
    }
    this.handlers.forEach((handler) => handler.write(entry));
  }

  private _toEntry(level: LogLevel, args: unknown[]): IEventsLogEntry {
    return {
      level,
      date: new Date().toISOString(),
      scope: this.scope,
      args: args.map(this._toString.bind(this)),
    }
  }

  private _toString(arg: unknown) {
    return typeof arg === 'string' ? arg : inspect(arg, false, this.options?.inspectDepth || DEFAULT_INSPECT_DEPTH, true);
  }
}
