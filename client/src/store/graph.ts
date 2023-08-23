import type {INodeSummary} from "@microlambda/types";
import {derived, writable} from "svelte/store";
import {fetchGraph} from "../api";
import type {ICreateWritable} from "../utils/store";
import {logger} from "../logger";
import {restoreSelected} from "./workspace-selected";
import type {IRunCommandEvent} from "../types/ws";
import type {IGraph} from "../types/graph";
import {findService, findWorkspace} from "../utils/graph";

const log = logger.scope('(store/graph)');

let currentGraph: IGraph | undefined;
let eventsReceivedWhileRefreshingGraph: IRunCommandEvent[] = [];

export const patchGraph = (events: IRunCommandEvent[]): void => {
  if (!currentGraph) {
    log.warn('Cannot patch graph: not loaded');
    eventsReceivedWhileRefreshingGraph = eventsReceivedWhileRefreshingGraph.concat(events);
    return;
  }
  const previousGraph = { ...currentGraph };
  for (const evt of events) {
    switch (evt.type) {
      case "start":
        const service = findService(previousGraph, evt.workspace);
        if (service) {
          service.status = evt.status;
          service.metrics.start = evt.metrics;
        }
        break;
      case "build":
        const workspace = findWorkspace(previousGraph, evt.workspace);
        if (workspace) {
          workspace.typeChecked = evt.status;
          workspace.metrics.typecheck = evt.metrics;
        }
        break;
      case "transpile":
        const pkg = findWorkspace(previousGraph, evt.workspace);
        if (pkg) {
          pkg.transpiled = evt.status;
          pkg.metrics.transpile = evt.metrics;
        }
        break;
    }
  }
}

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
      eventsReceivedWhileRefreshingGraph = [];
      const response = await fetchGraph();
      set(response);
      patchGraph(eventsReceivedWhileRefreshingGraph);
    },
  };
}

export const graph = createGraph();

graph.subscribe((graph) => {
  log.info('Graph updated');
  currentGraph = graph;
  restoreSelected(graph);
});

export const services = derived(graph, ($graph) => $graph.services);
export const packages = derived(graph, ($graph) => $graph.packages);
