import { derived, readable, Writable, writable } from "svelte/store";
import { env } from "./env/dev.env";
import { io } from "socket.io-client";
import {
  fetchCompilationLogs,
  fetchEventLogs,
  fetchGraph,
  fetchSchedulerStatus,
  fetchServiceLogs,
} from "./api";
import type {
  IEventLog,
  INodeSummary,
  ServiceLogs,
  SchedulerStatus,
} from "@microlambda/types";
import { Debouncer } from "./utils/debouncer";
import { logger } from "./logger";

const log = logger.scope("(store)");
log.info("Connecting websocket on", env.apiUrl);
const socket = io(env.apiUrl);

export const connected = readable(false, (set) => {
  console.debug('Watching connect/disconnect events', socket)
  socket.on("connect", () => {
    log.info("Websocket connected");
    set(true);
  });
  socket.on("disconnect", () => {
    log.info("Websocket disconnected");
    set(false);
  });
});

export const selected = writable<INodeSummary | null>(null);
export const tabMounted = writable<boolean>(false);

interface ICreateWritable<T, A = void> extends Writable<T> {
  fetch: (args: A) => Promise<void>;
}

function createGraph(): ICreateWritable<INodeSummary[]> {
  const { subscribe, set, update } = writable<INodeSummary[]>([], (set) => {
    const debouncer = new Debouncer(async () => set(await fetchGraph()), 200);
    debouncer.perform();
    socket.on("graph.updated", async () => {
      debouncer.perform();
    });
    socket.on("disconnect", () => set([]));
    return (): void => {
      socket.close();
    };
  });
  return {
    subscribe,
    set,
    update,
    fetch: async (): Promise<void> => {
      set(await fetchGraph());
    },
  };
}

function createEventsLog(): ICreateWritable<IEventLog[]> {
  const { subscribe, update, set } = writable<IEventLog[]>([], (set) => {
    socket.on("connect", async () => {
      log.debug("Websocket connected, fetching event logs");
      set(await fetchEventLogs());
    });
    socket.on("event.log.added", async (log: IEventLog) => {
      if (["info", "warn", "error"].includes(log.level)) {
        update((logs) => [...logs, log]);
      }
    });
    socket.on("disconnect", () => set([]));
    return (): void => {
      socket.close();
    };
  });
  return {
    subscribe,
    set,
    update,
    fetch: async (): Promise<void> => {
      set(await fetchEventLogs());
    },
  };
}

function createServiceLogs(): ICreateWritable<ServiceLogs, string> {
  const { subscribe, set, update } = writable<ServiceLogs>({
    start: { default: [] },
    deploy: {},
    remove: {},
    package: { default: [] },
  });
  return {
    subscribe,
    set,
    update,
    fetch: async (service: string): Promise<void> => {
      set(await fetchServiceLogs(service));
    },
  };
}

function createCompilationLogs(): ICreateWritable<string[], string> {
  const { subscribe, set, update } = writable<string[]>([]);
  return {
    subscribe,
    set,
    update,
    fetch: async (node: string): Promise<void> => {
      set(await fetchCompilationLogs(node));
    },
  };
}

function createSchedulerStatus(): ICreateWritable<SchedulerStatus | null> {
  const { subscribe, set, update } = writable<SchedulerStatus | null>(
    null,
    (set) => {
      socket.on("scheduler.status.changed", (status: SchedulerStatus) => {
        set(status);
      });
    }
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

export const logs = createServiceLogs();
export const schedulerStatus = createSchedulerStatus();
export const tscLogs = createCompilationLogs();
export const offlineLogs = derived(logs, ($logs) => $logs.start.default);
export const eventsLog = createEventsLog();
export const graph = createGraph();
export const services = derived(graph, ($graph) =>
  $graph.filter((n) => n.port)
);
export const packages = derived(graph, ($graph) =>
  $graph.filter((n) => !n.port)
);

let nodeSelected: INodeSummary | null = null;
graph.subscribe((nodes) => {
  log.debug("Graph updated, refreshing selected node", nodes.length);
  if (nodeSelected) {
    selected.set(nodes.find((n) => n.name === nodeSelected?.name) || null);
  } else {
    log.debug("No selected node");
  }
});

let previousService: string;
selected.subscribe((node) => {
  nodeSelected = node;
  if (node && node.type === "service") {
    const service = node;
    log.info("Service selected", service);
    socket.emit("send.service.logs", service.name);
    logs.fetch(service.name).then(() => {
      log.info("Subscribing socket event", service.name + ".log.added");
      socket.on(service.name + ".log.added", (data: string) => {
        log.debug("Received log", data);
        logs.update((current) => {
          const currentOffline = current.start.default || [];
          const updatedLogs: ServiceLogs = {
            deploy: current.deploy,
            start: { default: [...currentOffline, data] },
            remove: current.remove,
            package: current.package,
          };
          return updatedLogs;
        });
      });
    });
    if (previousService) {
      const socketKey = previousService + ".log.added";
      log.info("Unsubscribing socket event", socketKey);
      socket.off(socketKey);
    }
    previousService = service.name;
  }
  if (node) {
    log.info("Node selected", node);
    tscLogs.fetch(node.name).then(() => {
      log.info("build logs fetched for", node.name);
      socket.on("tsc.log.emitted", (data: { node: string; data: string }) => {
        if (data.node === node.name) {
          log.debug("Received tsc logs", data.data);
          tscLogs.update((current) => [...current, data.data]);
        }
      });
    });
  }
});
