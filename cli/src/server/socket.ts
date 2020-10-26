import ws from 'socket.io';
import { Server } from 'http';
import { LernaGraph, LernaNode, Service } from '../lerna';
import { ServiceStatus } from '../lerna/enums/service.status';
import { TypeCheckStatus, TranspilingStatus } from '../lerna/enums/compilation.status';
import { IEventLog, Logger } from '../utils/logger';
import { RecompilationScheduler } from '../utils/scheduler';

export class IOSocketManager {
  private _io: ws.Server;
  private _serviceToListen: string;
  private _scheduler: RecompilationScheduler;
  private _logger: Logger;
  private _graph: LernaGraph;

  constructor(server: Server, scheduler: RecompilationScheduler, logger: Logger, graph: LernaGraph) {
    this._scheduler = scheduler;
    this._logger = logger;
    this._io = ws(server);
    this._graph = graph;
    this._io.on('connection', (socket) => {
      socket.on('service.start', (serviceName: string) => {
        this._logger.log('io').info('received service.start request', serviceName);
        const service = this._graph.getServices().find((s) => s.getName() === serviceName);
        if (!service) {
          this._logger.log('io').error('unknown service', serviceName);
        } else {
          this._scheduler.startOne(service).subscribe(() => {
            this._logger.log('io').info('service started');
          });
        }
      });
      socket.on('service.restart', (serviceName: string) => {
        this._logger.log('io').info('received service.restart request', serviceName);
        const service = this._graph.getServices().find((s) => s.getName() === serviceName);
        if (!service) {
          this._logger.log('io').error('unknown service', serviceName);
        } else {
          this._scheduler.restartOne(service).subscribe(() => {
            this._logger.log('io').info('service restarted');
          });
        }
      });
      socket.on('service.stop', (serviceName: string) => {
        this._logger.log('io').info('received service.stop request', serviceName);
        const service = this._graph.getServices().find((s) => s.getName() === serviceName);
        if (!service) {
          this._logger.log('io').error('unknown service', serviceName);
        } else {
          this._scheduler.stopOne(service).subscribe(() => {
            this._logger.log('io').info('service stopped');
          });
        }
      });
      socket.on('node.compile', (data: { node: string; force: boolean }) => {
        this._logger.log('io').info('received node.compile request', data.node);
        const node = this._graph.getNodes().find((s) => s.getName() === data.node);
        if (!node) {
          this._logger.log('io').error('unknown node', data.node);
        } else {
          this._scheduler.recompileSafe(node, data.force);
        }
      });
      socket.on('send.service.logs', (service: string) => {
        this._serviceToListen = service;
      });
    });
  }

  statusUpdated(node: Service, status: ServiceStatus): void {
    this._io.emit('node.status.updated', { node: node.getName(), status });
  }

  transpilingStatusUpdated(node: LernaNode, status: TranspilingStatus): void {
    this._io.emit('transpiling.status.updated', { node: node.getName(), status });
  }

  typeCheckStatusUpdated(node: LernaNode, status: TypeCheckStatus): void {
    this._io.emit('type.checking.status.updated', { node: node.getName(), status });
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
}
