import {derived, writable} from "svelte/store";
import {fetchServiceLogs} from "../api";
import type {ICreateWritable} from "../utils/store";
import type {INodeSummary} from "@microlambda/types";
import {logger} from "../logger";

const log = logger.scope('(store/logs/offline)');

let logs: string[] = [];

function createServiceLogs(): ICreateWritable<Array<string>, string> {
  const { subscribe, set, update } = writable<Array<string>>([]);
  return {
    subscribe,
    set,
    update,
    fetch: async (service: string): Promise<void> => {
      const response = await fetchServiceLogs(service);
      logs = response;
      set(response);
    },
  };
}

const serviceLogs = createServiceLogs();
export const offlineLogs = derived(serviceLogs, ($logs: Array<string>) =>
  $logs.map((log, idx) => ({ id: idx, text: log })),
);

export const resetOfflineLogs = async (workspace?: (INodeSummary & {isService: boolean})): Promise<void> => {
  log.info('Reset offline logs');
  serviceLogs.set([]);
  if (workspace && workspace.isService) {
    await serviceLogs.fetch(workspace.name);
  }
}

export const appendOfflineLogs = (newLogs: string[]): void => {
  const updatedLogs = [...logs, ...newLogs];
  logs = updatedLogs;
  serviceLogs.set(updatedLogs);
}
