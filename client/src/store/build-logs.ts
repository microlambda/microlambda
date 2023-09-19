import type { ILogsResponse } from '../types/logs-response';
import { derived, writable } from 'svelte/store';
import { fetchCompilationLogs } from '../api';
import type { ICreateWritable } from '../utils/store';
import type { LogsSlice } from '../types/logs-slice';
import type { INodeSummary } from '@microlambda/types';

let currentSlice: LogsSlice | undefined;

function createCompilationLogs(): ICreateWritable<ILogsResponse, string> {
  const { subscribe, set, update } = writable<ILogsResponse>({
    data: [],
    metadata: { count: 0, slice: [0, 0] },
  });
  return {
    subscribe,
    set,
    update,
    fetch: async (node: string): Promise<void> => {
      const response = await fetchCompilationLogs(node, currentSlice ?? [0]);
      currentSlice = response.metadata.slice;
      set(response);
    },
  };
}

const compilationLogs = createCompilationLogs();

export const resetBuildLogs = async (
  workspace?: INodeSummary & { isService: boolean },
): Promise<void> => {
  currentSlice = undefined;
  compilationLogs.set({ data: [], metadata: { count: 0, slice: [0, 0] } });
  if (workspace) {
    await compilationLogs.fetch(workspace.name);
  }
};

export const tscLogs = derived(compilationLogs, ($logs) =>
  $logs.data.map((log, idx) => ({ id: idx, text: log })),
);
