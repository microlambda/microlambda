import type { INodeSummary } from '@microlambda/types';
import { derived, writable } from 'svelte/store';
import { fetchGraph } from '../api';
import type { IGraph } from '../types/graph';
import type { ICreateWritable } from '../utils/store';
import { areGraphEquals } from '../utils/graph';
import { logger } from '../logger';
import { restoreSelected } from './workspace-selected';

const log = logger.scope('(store/graph)');

let currentGraph: IGraph;
function createGraph(): ICreateWritable<{
  packages: INodeSummary[];
  services: INodeSummary[];
}> {
  const { subscribe, set, update } = writable<{
    packages: INodeSummary[];
    services: INodeSummary[];
  }>({
    services: [],
    packages: [],
  });
  return {
    subscribe,
    set,
    update,
    fetch: async (): Promise<void> => {
      const response = await fetchGraph();
      currentGraph = response;
      set(response);
    },
  };
}

export const graph = createGraph();

export const updateGraph = async (): Promise<void> => {
  const newGraph = await fetchGraph();
  if (currentGraph && !areGraphEquals(currentGraph, newGraph)) {
    currentGraph = newGraph;
    log.info('Graph updated', currentGraph);
    graph.set(newGraph);
  }
};

graph.subscribe((graph) => {
  restoreSelected(graph);
});

export const services = derived(graph, ($graph) => $graph.services);
export const packages = derived(graph, ($graph) => $graph.packages);
