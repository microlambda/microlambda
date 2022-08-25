import { LogLevel } from './options';

export interface IEventsLogEntry {
  level: LogLevel;
  date: string;
  scope?: string;
  args: unknown[];
}

export type EventsLogBuffer = Array<IEventsLogEntry>;
