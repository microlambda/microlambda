import { Server as WebSocketServer } from "socket.io";
import { Server } from "http";
import {
  isStopServiceEvent,
  Project,
  RunCommandSchedulerEvent,
  Scheduler,
} from "@microlambda/core";
import { IEventLog, SchedulerStatus, ServiceStatus, TranspilingStatus, TypeCheckStatus } from "@microlambda/types";
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { RunCommandEventEnum, Workspace } from "@microlambda/runner-core";
import { EventsLog } from "@microlambda/logger";

export class IOSocketManager {
  private _io: WebSocketServer;
  private _serviceToListen = '';
  private _scheduler: Scheduler;
  //private _logger: ILogger;
  private _graph: Project;
  private _graphUpdated$: Subject<void> = new Subject<void>();

  constructor(
    port: number,
    server: Server,
    scheduler: Scheduler,
    logger: EventsLog,
    graph: Project,
  ) {
    this._scheduler = scheduler;
    const log = logger.scope('@microlambda/server/io');
    log.info('Attaching Websocket', {
      cors: {
        origin: ['http://localhost:4200', 'http://localhost:' + port],
        credentials: true,
      },
    });
    this._io = new WebSocketServer(server, {
      cors: {
        origin: ['http://localhost:4200', 'http://localhost:' + port],
        credentials: true,
      },
    });
    this._io.on("connect_error", (err) => {
      log.error(`connect_error due to ${err.message}`);
    });
    this._graph = graph;
    this._io.on('connection', (socket) => {
      socket.on('service.start', (serviceName: string) => {
        log.info('received service.start request', serviceName);
        const service = this._graph.services.get(serviceName);
        if (!service) {
          log.error('unknown service', serviceName);
        } else {
          this._scheduler.startOne(service);
        }
      });
      socket.on('service.restart', (serviceName: string) => {
        log.info('received service.restart request', serviceName);
        const service = this._graph.services.get(serviceName);
        if (!service) {
          log.error('unknown service', serviceName);
        } else {
          this._scheduler.restartOne(service);
        }
      });
      socket.on('service.stop', (serviceName: string) => {
        log.info('received service.stop request', serviceName);
        const service = this._graph.services.get(serviceName);
        if (!service) {
          log.error('unknown service', serviceName);
        } else {
          this._scheduler.stopOne(service);
        }
      });
      socket.on('send.service.logs', (service: string) => {
        this._serviceToListen = service;
      });
    });
    this._graphUpdated$.pipe(debounceTime(200)).subscribe(() => {
      log.info('graph updated');
      this._io.emit('graph.updated');
    });
    this._scheduler.events$.subscribe((evt) => {
      if (isStopServiceEvent(evt)) {
        switch (evt.type) {
          case 'stopping':
            this.statusUpdated(evt.service, ServiceStatus.STOPPING);
            break;
          case 'stopped':
            this.statusUpdated(evt.service, ServiceStatus.STOPPED);
            break;
        }
      } else {
        this._handleRunCommandEvent(evt);
      }
    });
  }

  private _handleRunCommandEvent(evt: RunCommandSchedulerEvent): void {
    switch (evt.type) {
      case RunCommandEventEnum.NODE_STARTED:
        switch (evt.cmd) {
          case 'start':
            this.statusUpdated(evt.workspace, ServiceStatus.STARTING);
            break;
          case 'transpile':
            this.transpilingStatusUpdated(evt.workspace, TranspilingStatus.TRANSPILING);
            break;
          case 'build':
            this.typeCheckStatusUpdated(evt.workspace, TypeCheckStatus.CHECKING);
            break;
        }
        break;
      case RunCommandEventEnum.NODE_PROCESSED:
        switch (evt.cmd) {
          case 'start':
            this.statusUpdated(evt.workspace, ServiceStatus.RUNNING);
            break;
          case 'transpile':
            this.transpilingStatusUpdated(evt.workspace, TranspilingStatus.TRANSPILED);
            break;
          case 'build':
            this.typeCheckStatusUpdated(evt.workspace, TypeCheckStatus.SUCCESS);
            break;
        }
        break;
      case RunCommandEventEnum.NODE_ERRORED:
        switch (evt.cmd) {
          case 'start':
            this.statusUpdated(evt.workspace, ServiceStatus.CRASHED);
            break;
          case 'transpile':
            this.transpilingStatusUpdated(evt.workspace, TranspilingStatus.ERROR_TRANSPILING);
            break;
          case 'build':
            this.typeCheckStatusUpdated(evt.workspace, TypeCheckStatus.ERROR);
            break;
        }
        break;
      case RunCommandEventEnum.NODE_INTERRUPTED:
        switch (evt.cmd) {
          case 'start':
            this.statusUpdated(evt.workspace, ServiceStatus.STOPPED);
            break;
          case 'transpile':
            this.transpilingStatusUpdated(evt.workspace, TranspilingStatus.NOT_TRANSPILED);
            break;
          case 'build':
            this.typeCheckStatusUpdated(evt.workspace, TypeCheckStatus.NOT_CHECKED);
            break;
        }
        break;
    }
  }

  private _graphUpdated(): void {
    this._graphUpdated$.next();
  }

  statusUpdated(node: Workspace, status: ServiceStatus): void {
    this._graphUpdated();
    this._io.emit('node.status.updated', { node: node.name, status });
  }

  transpilingStatusUpdated(node: Workspace, status: TranspilingStatus): void {
    this._graphUpdated();
    this._io.emit('transpiling.status.updated', {
      node: node.name,
      status,
    });
  }

  typeCheckStatusUpdated(node: Workspace, status: TypeCheckStatus): void {
    this._graphUpdated();
    this._io.emit('type.checking.status.updated', {
      node: node.name,
      status,
    });
  }

  eventLogAdded(log: IEventLog): void {
    this._io.emit('event.log.added', log);
  }

  handleServiceLog(service: string, data: string): void {
    if (this._serviceToListen === service) {
      this._io.emit(service + '.log.added', data);
    }
  }

  handleTscLogs(node: string, data: string): void {
    this._io.emit('tsc.log.emitted', { node, data });
  }

  schedulerStatusChanged(status: SchedulerStatus): void {
    this._io.emit('scheduler.status.changed', status);
  }
}
