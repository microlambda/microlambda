import { Server as WebSocketServer } from 'socket.io';
import { Server } from 'http';
import { ILogger, Logger, Project, Scheduler, Workspace } from '@microlambda/core';
import { ServiceStatus, TranspilingStatus, TypeCheckStatus, IEventLog, SchedulerStatus } from '@microlambda/types';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

export class IOSocketManager {
  private _io: WebSocketServer;
  private _serviceToListen = '';
  private _scheduler: Scheduler;
  private _logger: ILogger;
  private _graph: Project;
  private _graphUpdated$: Subject<void> = new Subject<void>();

  constructor(
    port: number,
    server: Server,
    scheduler: Scheduler,
    logger: Logger,
    graph: Project,
  ) {
    this._scheduler = scheduler;
    this._logger = logger.log('io');
    this._logger.debug('Attaching Websocket');
    this._io = new WebSocketServer(server, {
      cors: {
        origin: ['http://localhost:4200', 'http://localhost:' + port],
        credentials: true,
      },
    });
    this._graph = graph;
    this._io.on('connection', (socket) => {
      socket.on('service.start', (serviceName: string) => {
        this._logger.info('received service.start request', serviceName);
        const service = this._graph.services.get(serviceName);
        if (!service) {
          this._logger.error('unknown service', serviceName);
        } else {
          this._scheduler.startOne(service).subscribe(() => {
            this._logger.info('service started');
          });
        }
      });
      socket.on('service.restart', (serviceName: string) => {
        this._logger.info('received service.restart request', serviceName);
        const service = this._graph.services.get(serviceName);
        if (!service) {
          this._logger.error('unknown service', serviceName);
        } else {
          this._scheduler.restartOne(service).subscribe(() => {
            this._logger.info('service restarted');
          });
        }
      });
      socket.on('service.stop', (serviceName: string) => {
        this._logger.info('received service.stop request', serviceName);
        const service = this._graph.services.get(serviceName);
        if (!service) {
          this._logger.error('unknown service', serviceName);
        } else {
          this._scheduler.stopOne(service).subscribe(() => {
            this._logger.info('service stopped');
          });
        }
      });
      socket.on('node.compile', (data: { node: string; force: boolean }) => {
        this._logger.info('received node.compile request', data.node);
        const node = this._graph.packages.get(data.node);
        if (!node) {
          this._logger.error('unknown node', data.node);
        } else {
          this._scheduler.typecheck(node, data.force);
        }
      });
      socket.on('send.service.logs', (service: string) => {
        this._serviceToListen = service;
      });
    });
    this._graphUpdated$.pipe(debounceTime(200)).subscribe(() => {
      this._logger.info('graph updated');
      this._io.emit('graph.updated');
    });
  }

  private _graphUpdated(): void {
    this._graphUpdated$.next();
  }

  statusUpdated(node: Workspace, status: ServiceStatus): void {
    this._logger.debug('status updated', node.name, status);
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
