import type { ILogsResponse } from '../types/logs-response';
import type { IEventLog } from '@microlambda/types';
import { writable } from 'svelte/store';
import { fetchEventLogs } from '../api';
import type { ICreateWritable } from '../utils/store';
import type { LogsSlice } from '../types/logs-slice';

let currentSlice: LogsSlice | undefined;

function createEventsLog(): ICreateWritable<ILogsResponse<IEventLog>> {
  const { subscribe, update, set } = writable<ILogsResponse<IEventLog>>({
    data: [],
    metadata: { count: 0, slice: [0, 0] },
  });
  return {
    subscribe,
    set,
    update,
    fetch: async (): Promise<void> => {
      const response = await fetchEventLogs([0]);
      currentSlice = response.metadata.slice;
      set(response);
    },
  };
}

export const eventsLog = createEventsLog();
