export interface ILogsResponse<T = string> {
  data: T[];
  metadata: {
    count: number;
    slice: [number, number];
  };
}
