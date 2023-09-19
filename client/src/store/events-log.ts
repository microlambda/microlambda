import type { IEventLog } from '@microlambda/types';
import { writable } from 'svelte/store';
import { fetchEventLogs } from '../api';
import type { ICreateWritable } from '../utils/store';

let logs: IEventLog[] = [];

function createEventsLog(): ICreateWritable<Array<IEventLog>> {
  const { subscribe, update, set } = writable<Array<IEventLog>>([]);
  return {
    subscribe,
    set,
    update,
    fetch: async (): Promise<void> => {
      const response = await fetchEventLogs();
      logs = response;
      set(response);
    },
  };
}

export const eventsLog = createEventsLog();

export const resetEventsLog = async (): Promise<void> => {
  eventsLog.set([]);
  return eventsLog.fetch();
};

export const appendEventLogs = (newLogs: IEventLog[]): void => {
  const updatedLogs = [...logs, ...newLogs];
  logs = updatedLogs;
  eventsLog.set(updatedLogs);
};
