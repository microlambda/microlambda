import {readable} from "svelte/store";
import {io} from "socket.io-client";
import {env} from "../env/dev.env";
import {logger} from "../logger";
import {graph, patchGraph} from "./graph";
import {appendEventLogs, resetEventsLog} from "./events-log";
import type {IEventLog, ILogsReceivedEvent, IRunCommandEvent} from "@microlambda/types";
import {appendOfflineLogs, resetOfflineLogs} from "./offline-logs";
import {appendBuildLogs, resetBuildLogs} from "./build-logs";

const log = logger.scope('(store/ws)');

log.info('Connecting websocket on', env.apiUrl);
const socket = io(env.apiUrl);
socket.emit('connection');

let isConnected = false;
export const connected = readable(false, (set) => {
  socket.on('connect', () => {
    if (!isConnected) {
      isConnected = true;
      set(true);
    }
  });
  socket.on('disconnect', () => {
    if (isConnected) {
      isConnected = false;
      set(false);
    }
  });
});

connected.subscribe(async (connected) => {
  if (!connected) {
    log.warn('Disconnected !');
    socket.off('run.command.event');
    socket.off('target.log.added');
    socket.off('event.log.added');
  } else {
    log.info('Connected !');
    // Refresh graph
    void graph.fetch();
    void resetEventsLog();
    void resetBuildLogs();
    void resetOfflineLogs();
    log.info('Listening WS events');
    socket.on('run.command.event', async (evt: IRunCommandEvent) => {
      log.debug('Received event', evt);
      patchGraph([evt]);
    });
    socket.on('target.log.added', (evt: ILogsReceivedEvent) => {
      log.info('Target logs received', evt);
      switch (evt.target) {
        case 'start':
          appendOfflineLogs([evt.log]);
          break;
        case 'build':
          appendBuildLogs([evt.log]);
          break;
        default:
          break;
      }
    });
    socket.on('event.log.added', (evt: IEventLog) => {
      appendEventLogs([evt]);
    });
  }
});

export const subscribeToLogs = (workspace: string): void => {
  log.info('Subscribing to logs for', workspace);
  socket.emit('subscribe.to.logs', workspace);
}
