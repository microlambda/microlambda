import { DEFAULT_BUFFER_SIZE, DEFAULT_INSPECT_DEPTH, DEFAULT_PREFIXES } from './defaults';
import { IEventLogOptions, LogLevel } from './options';
import { IEventsLogEntry } from './events-log-entry';
import { EventsLogger } from './events-logger';
import { IEventsLogHandler } from './handlers';

/**
 * @class EventsLog
 * The EventLog class hold all internal microlambda logs in-memory.
 * LogHandlers can be attached to either print these logs in console, or output them to a file / S3.
 * All logs are scoped : each class should declared a unique prefix so logs can be easily filtered.
 */
export class EventsLog {
  constructor(readonly options: IEventLogOptions = {
    prefix: DEFAULT_PREFIXES,
    bufferSize: DEFAULT_BUFFER_SIZE,
    inspectDepth: DEFAULT_INSPECT_DEPTH,
  }, private readonly _handlers: IEventsLogHandler[] = []) {}

  private _buffer: IEventsLogEntry[] = [];

  get buffer() {
    return this._buffer;
  }

  get logs(): IEventsLogEntry[] {
    return this._buffer;
  }

  get level(): LogLevel | 'silent' {
    return ['silly', 'debug', 'info', 'warn', 'error'].includes(
      String(process.env.MILA_LOG_LEVEL),
    )
      ? String(process.env.MILA_LOG_LEVEL) as LogLevel
      : 'silent' as const;
  }

  scope(scope?: string): EventsLogger {
    return new EventsLogger(this, this.options, this.level, this._buffer, this._handlers, scope);
  }
}
