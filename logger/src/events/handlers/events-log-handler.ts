import { IEventsLogEntry } from '../events-log-entry';

export interface IEventsLogHandler {
  write: (entry: IEventsLogEntry) => void;
}
