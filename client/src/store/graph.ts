import type {INodeSummary, IRunCommandEvent} from "@microlambda/types";
import {derived, writable} from "svelte/store";
import {fetchGraph} from "../api";
import type {ICreateWritable} from "../utils/store";
import {logger} from "../logger";
import {patchStatus, restoreSelected} from "./workspace-selected";
import type {IGraph} from "../types/graph";
import {findService, findWorkspace} from "../utils/graph";

const log = logger.scope('(store/graph)');

let currentGraph: IGraph | undefined;
let eventsReceivedWhileRefreshingGraph: IRunCommandEvent[] = [];

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

const isService = (w: INodeSummary): boolean => {
  return currentGraph?.services.some((s) => s.name === w.name) ?? false;
}

const populateIsService = (w: INodeSummary): INodeSummary & { isService: boolean } => {
  return {
    ...w,
    isService: isService(w),
  }
}

export const patchGraph = (events: IRunCommandEvent[]): void => {
  if (!currentGraph) {
    log.warn('Cannot patch graph: not loaded');
    eventsReceivedWhileRefreshingGraph = eventsReceivedWhileRefreshingGraph.concat(events);
    return;
  }
  const updatedGraph = { ...currentGraph };
  for (const evt of events) {
    switch (evt.type) {
      case "start":
        const service = findService(updatedGraph, evt.workspace);
        if (service) {
          service.status = evt.status;
          service.metrics.start = evt.metrics;
          patchStatus(populateIsService(service));
        }
        break;
      case "build":
        const workspace = findWorkspace(updatedGraph, evt.workspace);
        if (workspace) {
          workspace.typeChecked = evt.status;
          workspace.metrics.typecheck = evt.metrics;
          patchStatus(populateIsService(workspace));
        }
        break;
      case "transpile":
        const pkg = findWorkspace(updatedGraph, evt.workspace);
        if (pkg) {
          pkg.transpiled = evt.status;
          pkg.metrics.transpile = evt.metrics;
          patchStatus(populateIsService(pkg));
        }
        break;
    }
  }
  graph.set(updatedGraph);
}

graph.subscribe((graph) => {
  log.info('Graph updated');
  const shouldRestore = !currentGraph;
  currentGraph = graph;
  if (shouldRestore) {
    restoreSelected(graph);
  }
});

export const services = derived(graph, ($graph) => $graph.services);
export const packages = derived(graph, ($graph) => $graph.packages);
