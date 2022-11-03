export type LogLevel = 'silly' | 'debug' | 'info' | 'warn' | 'error';
export type Prefixes = Record<LogLevel, string>;

export interface IEventLogOptions {
  prefix: Prefixes,
  bufferSize: number,
  inspectDepth: number,
}
