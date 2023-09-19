export type LogsSlice = [number, number];

export interface ILogsResponse<T = string> {
  data: T[];
  metadata: {
    count: number;
    slice: LogsSlice;
  };
}
