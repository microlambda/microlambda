import {derived, writable} from "svelte/store";
import type {ILogsResponse} from "../types/logs-response";
import {fetchServiceLogs} from "../api";
import type {ICreateWritable} from "../utils/store";
import type {INodeSummary} from "@microlambda/types";
import type {LogsSlice} from "../types/logs-slice";

let currentSlice: LogsSlice | undefined;
function createServiceLogs(): ICreateWritable<ILogsResponse, string> {
  const { subscribe, set, update } = writable<ILogsResponse>({
    data: [],
    metadata: { count: 0, slice: [0, 0] },
  });
  return {
    subscribe,
    set,
    update,
    fetch: async (service: string): Promise<void> => {
      const response = await fetchServiceLogs(service, currentSlice ?? [0]);
      currentSlice = response.metadata.slice;
      set(response);
    },
  };
}

const serviceLogs = createServiceLogs();
export const offlineLogs = derived(serviceLogs, ($logs: ILogsResponse<string>) =>
  $logs.data.map((log, idx) => ({ id: idx, text: log })),
);

export const resetOfflineLogs = async (workspace?: (INodeSummary & {isService: boolean})): Promise<void> => {
  currentSlice = undefined;
  serviceLogs.set({ data: [], metadata: { count: 0, slice: [0, 0] } });
  if (workspace && workspace.isService) {
    await serviceLogs.fetch(workspace.name);
  }
}
