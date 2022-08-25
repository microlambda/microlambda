// TODO : Factorize in types
import { IEventLog } from "@microlambda/types";
import { inspect } from 'util';

export interface ILogsResponse<T = string> {
  data: T[];
  metadata: {
    count: number;
    slice: [number, number];
  }
}

const TEN_MEGABYTES = 10 * 1000 * 1000;

const getSlice = <T = unknown>(
  logs: T[],
  slice?: [number, number?],
): ILogsResponse<T> => {
  if (slice?.length === 1 && slice[0]) {
    return { data: logs.slice(slice[0]), metadata: { count: logs.length, slice: [slice[0], logs.length] }}
  }
  if (slice?.length === 2 && slice[0] && slice[1]) {
    return { data: logs.slice(slice[0], slice[1]), metadata: { count: logs.length, slice: [slice[0], slice[1]] }}
  }
  return { data: logs, metadata: { count: logs.length, slice: [0, logs.length ]}}
};

const countMethod = (entry: IEventLog | unknown): number => {
  if ((entry as IEventLog).args) {
    return (entry as IEventLog).args.map((arg) => inspect(arg)).join('').length;
  }
  return inspect(entry).length;
}

export const getTrimmedSlice = (
  logs: IEventLog[] | unknown[],
  slice?: [number, number?],
  maxSize = TEN_MEGABYTES,
): ILogsResponse<IEventLog | unknown> => {
  const currentSlice = getSlice<unknown | IEventLog>(logs, slice);
  let bytes = 0;
  for (let i = currentSlice.data.length - 1; i >= 0; i--) {
    const count = countMethod(currentSlice.data[i]);
    bytes += count;
    if (bytes > maxSize) {
      return {
        data: currentSlice.data.slice(i + 1),
        metadata: {
          count: currentSlice.metadata.count,
          slice: [currentSlice.metadata.slice[0] + i + 1, currentSlice.metadata.slice[1]],
        },
      }
    }
  }
  return currentSlice;
}
