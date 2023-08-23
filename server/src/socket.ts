import { Server as WebSocketServer } from 'socket.io';
import { Server } from 'http';
import { Scheduler } from '@microlambda/core';
import { EventsLog } from '@microlambda/logger';

export class IOSocketManager {
  private _io: WebSocketServer;
  private _scheduler: Scheduler;

  constructor(
    port: number,
    server: Server,
    scheduler: Scheduler,
    logger: EventsLog,
  ) {
    this._scheduler = scheduler;
    const log = logger.scope('@microlambda/server/io');
    log.info('Attaching Websocket');
    this._io = new WebSocketServer(server);
    this._io.on('connect_error', (err) => {
      log.error(`connect_error due to ${err.message}`);
    });
    this._scheduler.execution$.subscribe((evt) => {
      this._io.emit('run.command.event', {

      })
    });
  }
}
