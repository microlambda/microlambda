export type LogLevel = 'silly' | 'debug' | 'info' | 'warn' | 'error';

export interface IEventLog {
  level: LogLevel;
  date: string;
  scope?: string;
  args: string[];
}
