import { derived, writable } from 'svelte/store';
import { fetchCompilationLogs } from '../api';
import type { ICreateWritable } from '../utils/store';
import type { INodeSummary } from '@microlambda/types';

let logs: string[] = [];

function createCompilationLogs(): ICreateWritable<Array<string>, string> {
  const { subscribe, set, update } = writable<Array<string>>([]);
  return {
    subscribe,
    set,
    update,
    fetch: async (node: string): Promise<void> => {
      const response = await fetchCompilationLogs(node);
      logs = response;
      set(response);
    },
  };
}

const compilationLogs = createCompilationLogs();

export const resetBuildLogs = async (
  workspace?: INodeSummary & { isService: boolean },
): Promise<void> => {
  compilationLogs.set([]);
  if (workspace) {
    await compilationLogs.fetch(workspace.name);
  }
};

export const appendBuildLogs = (newLogs: string[]): void => {
  const updatedLogs = [...logs, ...newLogs];
  logs = updatedLogs;
  compilationLogs.set(updatedLogs);
};

export const tscLogs = derived(compilationLogs, ($logs) =>
  $logs.map((log, idx) => ({ id: idx, text: log })),
);
