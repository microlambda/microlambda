import type { LogsSlice } from './logs-slice';

export interface ILogsResponse<T = string> {
  data: T[];
  metadata: {
    count: number;
    slice: LogsSlice;
  };
}
