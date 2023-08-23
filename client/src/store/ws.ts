import {readable} from "svelte/store";
import {io} from "socket.io-client";
import {env} from "../env/dev.env";
import {logger} from "../logger";
import {updateGraph} from "./graph";

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
  } else {
    log.info('Connected !');
    socket.on('graph.updated', async () => {
      void updateGraph();
    });
    socket.on('event.log.added', async () => {
      // TODO
    });
  }
});
