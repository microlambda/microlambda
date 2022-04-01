import { blue, green, cyan, yellow, red, bold } from 'chalk';
import { inspect } from 'util';

const DEFAULT_BUFFER_SIZE = 200000;
const DEFAULT_INSPECT_DEPTH = 200000;

const DEFAULT_PREFIXES: Prefixes = {
  silly: cyan('[silly]'),
  debug: blue('[debug]'),
  info: green('[info]'),
  warn: yellow('[warn]'),
  error: red('[error]'),
};

export type LogLevel = 'silly' | 'debug' | 'info' | 'warn' | 'error';
export type Prefixes = Record<LogLevel, string>;

export interface ILogHandler {
  write: (entry: ILogEntry) => void;
}

export interface ILogEntry {
  level: LogLevel;
  date: string;
  scope?: string;
  args: string[];
}

interface ILoggerOptions {
  prefix: Prefixes,
  bufferSize: number,
  inspectDepth: number,
}

type Buffer = Array<ILogEntry>;

export class Logger {

  constructor(readonly options: ILoggerOptions = {
    prefix: DEFAULT_PREFIXES,
    bufferSize: DEFAULT_BUFFER_SIZE,
    inspectDepth: DEFAULT_INSPECT_DEPTH,
  }, private readonly _handlers: ILogHandler[] = []) {}

  private _buffer: ILogEntry[] = [];

  get buffer() {
    return this._buffer;
  }

  get logs(): ILogEntry[] {
    return this._buffer;
  }

  get level(): LogLevel | 'silent' {
    return ['silly', 'debug', 'info', 'warn', 'error'].includes(
      String(process.env.MILA_LOG_LEVEL),
    )
      ? String(process.env.MILA_LOG_LEVEL) as LogLevel
      : 'silent' as const;
  }

  log(scope?: string): Loggers {
    return new Loggers(this, this.options, this.level, this._buffer, this._handlers, scope);
  }
}

export class Loggers {
  constructor(
    readonly logger: Logger,
    readonly options: ILoggerOptions,
    readonly level: LogLevel | 'silent',
    readonly buffer: Buffer,
    readonly handlers: ILogHandler[],
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

  private _toEntry(level: LogLevel, args: unknown[]): ILogEntry {
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
