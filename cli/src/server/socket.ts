import ws from 'socket.io';
import { Server } from 'http';
import { LernaGraph, LernaNode, Service } from '../lerna';
import { ServiceStatus } from '../lerna/enums/service.status';
import { CompilationStatus } from '../lerna/enums/compilation.status';
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
        const service = this._graph.getServices().find(s => s.getName() === serviceName);
        if (!service) {
          this._logger.log('io').error('unknown service', serviceName);
        } else {
          this._scheduler.startOne(service).subscribe((evt) => {
            this._logger.log('io').info('service started', evt);
          });
        }
      });
      socket.on('service.restart', (serviceName: string) => {
        this._logger.log('io').info('received service.restart request', serviceName);
        const service = this._graph.getServices().find(s => s.getName() === serviceName);
        if (!service) {
          this._logger.log('io').error('unknown service', serviceName);
        } else {
          this._scheduler.restartOne(service).subscribe((evt) => {
            this._logger.log('io').info('service restarted', evt);
          });
        }
      });
      socket.on('service.stop', (serviceName: string) => {
        this._logger.log('io').info('received service.stop request', serviceName);
        const service = this._graph.getServices().find(s => s.getName() === serviceName);
        if (!service) {
          this._logger.log('io').error('unknown service', serviceName);
        } else {
          this._scheduler.stopOne(service).subscribe((evt) => {
            this._logger.log('io').info('service stopped', evt);
          });
        }
      });
      socket.on('node.compile', (nodeName: string) => {
        this._logger.log('io').info('received node.compile request', nodeName);
        const node = this._graph.getNodes().find(s => s.getName() === nodeName);
        if (!node) {
          this._logger.log('io').error('unknown node', nodeName);
        } else {
          // TODO: Recompilation
          this._logger.log('io').warn('TODO');
        }
      });
      socket.on('send.service.logs', (service: string) => {
        this._serviceToListen = service;
      });
    });
  }

  statusUpdated(node: Service, status: ServiceStatus) {
    this._io.emit('node.status.updated', { node: node.getName(), status });
  }

  compilationStatusUpdated(node: LernaNode, status: CompilationStatus) {
    this._io.emit('compilation.status.updated', { node: node.getName(), status });
  }

  eventLogAdded(log: IEventLog) {
    this._io.emit('event.log.added', log);
  }

  handleServiceLog(service: string, data: any) {
    if (this._serviceToListen === service) {
      this._io.emit(service + '.log.added', data);
    }
  }
}
