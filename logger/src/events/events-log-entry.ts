import { LogLevel } from './options';

export interface IEventsLogEntry {
  level: LogLevel;
  date: string;
  scope?: string;
  args: string[];
}

export type EventsLogBuffer = Array<IEventsLogEntry>;
