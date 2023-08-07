import { derived, readable, Writable, writable } from 'svelte/store';
import {
  fetchCompilationLogs,
  fetchEventLogs,
  fetchGraph,
  fetchSchedulerStatus,
  fetchServiceLogs,
  IGraph,
  ILogsResponse,
} from './api';
import type {
  IEventLog,
  INodeSummary,
  SchedulerStatus,
} from '@microlambda/types';
import { logger } from './logger';
import { io } from 'socket.io-client';
import { env } from './env/dev.env';

const log = logger.scope('(store)');

log.info('Connecting websocket on', env.apiUrl);
const socket = io(env.apiUrl);
socket.emit('connection');

const isConnected = false;
export const connected = readable(false, (set) => {
  socket.on('connect', () => {
    if (!isConnected) {
      set(connected);
    }
  });
  socket.on('disconnect', () => {
    set(false);
  });
});

export const selected = writable<
  (INodeSummary & { isService: boolean }) | null
>(null);
export const tabMounted = writable<boolean>(false);

interface ICreateWritable<T, A = void> extends Writable<T> {
  fetch: (args: A) => Promise<void>;
}

export const serviceLogs = createServiceLogs();
export const schedulerStatus = createSchedulerStatus();
export const compilationLogs = createCompilationLogs();
export const tscLogs = derived(compilationLogs, ($logs) =>
  $logs.data.map((log, idx) => ({ id: idx, text: log })),
);
export const offlineLogs = derived(serviceLogs, ($logs) =>
  $logs.data.map((log, idx) => ({ id: idx, text: log })),
);
export const eventsLog = createEventsLog();
export const graph = createGraph();
export const services = derived(graph, ($graph) => $graph.services);
export const packages = derived(graph, ($graph) => $graph.packages);

const areGraphEquals = (g1: IGraph, g2: IGraph): boolean => {
  if (
    g1.services.length === g2.services.length &&
    g1.packages.length === g2.packages.length
  ) {
    return (
      g1.services.every((s1) => {
        const service = g2.services.find((s2) => s1.name === s2.name);
        if (service) {
          return (
            service.status === s1.status &&
            service.transpiled === s1.transpiled &&
            service.typeChecked === s1.typeChecked
          );
        }
        return false;
      }) &&
      g1.packages.every((p1) => {
        const pkg = g2.packages.find((p2) => p1.name === p2.name);
        if (pkg) {
          return (
            pkg.transpiled === p1.transpiled &&
            pkg.typeChecked === p1.typeChecked
          );
        }
        return false;
      })
    );
  }
  return false;
};

type Slice = [number, number?];

const currentSlices: {
  eventsLog?: Slice;
  buildLogs?: Slice;
  offlineLogs?: Slice;
} = {
  eventsLog: [0],
  buildLogs: [0],
  offlineLogs: [0],
};

const handleLogsResponse = (
  response: ILogsResponse<string | IEventLog>,
  type: 'eventsLog' | 'buildLogs' | 'offlineLogs',
  writable: ICreateWritable<ILogsResponse<string | IEventLog>, string | void>,
): void => {
  if (response.metadata.slice[1] > currentSlices[type][1]) {
    log.info('Additional logs received', type);
    currentSlices[type][1] = response.metadata.slice[1];
    log.info('Slices updated', type, currentSlices[type]);
    writable.update((current) => ({
      data: [...current.data, ...response.data],
      metadata: {
        count: response.metadata.count,
        slice: [currentSlices[type][0], response.metadata.slice[1]],
      },
    }));
  }
};

let currentGraph: IGraph;

connected.subscribe(async (connected) => {
  if (!connected) {
    log.warn('Disconnected !');
  } else {
    log.info('Connected !');
    socket.on('graph.updated', async () => {
      const response = await fetchGraph();
      if (currentGraph && !areGraphEquals(currentGraph, response)) {
        currentGraph = response;
        log.info('Graph updated', currentGraph);
        graph.set(response);
      }
    });
    socket.on('event.log.added', async () => {
      const response = await fetchEventLogs([currentSlices.eventsLog[1] || 0]);
      handleLogsResponse(response, 'eventsLog', eventsLog);
    });
  }
});

let _selected: string | null = null;

graph.subscribe((graph) => {
  if (_selected) {
    const pkg = graph.packages.find((node) => node.name === _selected);
    const service = graph.services.find((node) => node.name === _selected);
    if (pkg) {
      selected.set({ ...pkg, isService: false });
    } else if (service) {
      selected.set({ ...service, isService: true });
    }
  }
});

selected.subscribe(async (workspace) => {
  const hasChanged = _selected !== workspace?.name;
  if (hasChanged) {
    serviceLogs.set({ data: [], metadata: { count: 0, slice: [0, 0] } });
    compilationLogs.set({ data: [], metadata: { count: 0, slice: [0, 0] } });
  }
  _selected = workspace?.name || null;
  log.info('Workspace selected', workspace?.name, workspace?.isService);
  if (workspace) {
    await compilationLogs.fetch(workspace.name);
    socket.on('tsc.log.emitted', async () => {
      const response = await fetchCompilationLogs(workspace.name, [
        currentSlices.buildLogs[1] || 0,
      ]);
      handleLogsResponse(response, 'buildLogs', compilationLogs);
    });
  }
  if (workspace && !workspace.isService) {
    serviceLogs.set({ data: [], metadata: { count: 0, slice: [0, 0] } });
  }
  if (workspace && workspace.isService) {
    socket.emit('send.service.logs', workspace.name);
    await serviceLogs.fetch(workspace.name);
    socket.on(workspace.name + '.log.added', async () => {
      const response = await fetchServiceLogs(workspace.name, [
        currentSlices.offlineLogs[1] || 0,
      ]);
      handleLogsResponse(response, 'offlineLogs', serviceLogs);
    });
  }
});

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
      currentSlices.eventsLog = response.metadata.slice;
      set(response);
    },
  };
}

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
      const response = await fetchServiceLogs(service, [0]);
      currentSlices.offlineLogs = response.metadata.slice;
      set(response);
    },
  };
}

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
      const response = await fetchCompilationLogs(node, [0]);
      currentSlices.buildLogs = response.metadata.slice;
      set(response);
    },
  };
}

function createSchedulerStatus(): ICreateWritable<SchedulerStatus | null> {
  const { subscribe, set, update } = writable<SchedulerStatus | null>(
    null,
    (set) => {
      /*socket.on("scheduler.status.changed", (status: SchedulerStatus) => {
        set(status);
      });*/
    },
  );
  return {
    subscribe,
    set,
    update,
    fetch: async (): Promise<void> => {
      set(await fetchSchedulerStatus());
    },
  };
}

/*
let previousService: string;
selected.subscribe((node) => {
  nodeSelected = node;
  if (node && node.type === "service") {
    const service = node;
    log.info("Service selected", service);
    //socket.emit("send.service.logs", service.name);
    logs.fetch(service.name).then(() => {
      log.info("Subscribing socket event", service.name + ".log.added");
    });
    if (previousService) {
      const socketKey = previousService + ".log.added";
      log.info("Unsubscribing socket event", socketKey);
      // socket.off(socketKey);
    }
    previousService = service.name;
  }
  if (node) {
    log.info("Node selected", node);
    tscLogs.fetch(node.name).then(() => {
      log.info("build logs fetched for", node.name);
    });
  }
});*/
