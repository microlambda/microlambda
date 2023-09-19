import { writable } from 'svelte/store';
import type { INodeSummary } from '@microlambda/types';
import { resetBuildLogs } from './build-logs';
import { resetOfflineLogs } from './offline-logs';
import { logger } from '../logger';
import type { IGraph } from '../types/graph';
import { subscribeToLogs } from './ws';
import type { ServiceStatus } from '@microlambda/types';

const log = logger.scope('(store/selected)');

let _selected: string | undefined = undefined;

export const selected = writable<
  (INodeSummary & { isService: boolean }) | undefined
>(undefined);

selected.subscribe(async (workspace) => {
  const hasChanged = _selected !== workspace?.name;
  _selected = workspace?.name || undefined;
  log.info('Workspace selected', workspace?.name, workspace?.isService);
  if (hasChanged) {
    if (workspace) {
      subscribeToLogs(workspace.name);
    }
    void resetBuildLogs(workspace);
    void resetOfflineLogs(workspace);
  }
});

export const restoreSelected = (graph: IGraph): void => {
  log.info('Restoring selected workspace', _selected);
  if (_selected) {
    const pkg = graph.packages.find((node) => node.name === _selected);
    const service = graph.services.find((node) => node.name === _selected);
    if (pkg) {
      selected.set({ ...pkg, isService: false });
    } else if (service) {
      selected.set({ ...service, isService: true });
    }
  } else {
    selected.set(undefined);
  }
};

export const patchStatus = (
  workspace: INodeSummary & { isService: boolean },
): void => {
  if (_selected === workspace.name) {
    const updated = { ...workspace };
    selected.set(updated);
  }
};

export const selectWorkspace = (
  workspace?: INodeSummary & { isService: boolean },
): void => {
  if (_selected !== workspace?.name) {
    selected.set(workspace);
  }
};
