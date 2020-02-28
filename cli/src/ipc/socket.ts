import { IPC } from 'node-ipc';
import { LernaGraph, Service } from '../lerna';
import { log } from '../utils/logger';
import { Socket } from 'net';
import { CompilationStatus } from '../lerna/enums/compilation.status';
import { ServiceStatus } from '../lerna/enums/service.status';
import { Observable, Subject } from 'rxjs';

interface IGraphStatus {
  name: string;
  compiled: CompilationStatus;
  status: ServiceStatus;
}

export class SocketsManager {
  private _ipc = new IPC();
  private _graph: LernaGraph;
  private readonly _id: string;
  private _sockets: Socket[] = [];

  constructor(projectRoot: string, graph?: LernaGraph) {
    log.debug('Creating socket');
    this._ipc.config.silent = !process.env.MILA_DEBUG;
    this._ipc.config.appspace = 'mila.';
    this._graph = graph;
    const projectPathSegments = projectRoot.split('/');
    this._id = projectPathSegments[projectPathSegments.length - 1];
  }

  public async createServer(): Promise<void> {
    return new Promise((resolve) => {
      this._ipc.serve(() => {
        log.debug('socket created');
        resolve();
      });
      this._ipc.server.on('connect', (socket) => {
        this._sockets.push(socket);
        this._emitGraph(socket);
      });
      this._ipc.server.on('requestStart', (service: string) => {
        // TODO
        log.debug(service);
      });
      this._ipc.server.on('requestStop', (service: string) => {
        // TODO
        log.debug(service);
      });
      this._ipc.server.on('requestRestart', (service: string) => {
        // TODO
        log.debug(service);
      });
      this._ipc.server.start();
    });
  }

  public subscribeStatus(): Observable<IGraphStatus> {
    const graphStatus: Subject<IGraphStatus> = new Subject<IGraphStatus>();
    this._ipc.connectTo(this._id, () => {
      log.debug('socket connected');
      this._ipc.of[this._id].on('status', (data: IGraphStatus) => {
        graphStatus.next(data);
      });
    });
    return graphStatus.asObservable();
  }

  public graphUpdated(): void {
    this._sockets.forEach((s) => this._emitGraph(s));
  }

  public requestStop(service?: string): void {
    this._requestAction('requestStop', service);
  }

  public requestStart(service?: string): void {
    this._requestAction('requestStart', service);
  }

  public requestRestart(service?: string): void {
    this._requestAction('requestRestart', service);
  }

  private _requestAction(action: 'requestStop' | 'requestRestart' | 'requestStart', service?: string): void {
    this._ipc.connectTo(this._id, () => {
      log.debug('socket connected');
      this._ipc.of[this._id].emit(action, service);
    });
  }

  private _emitGraph(socket: Socket): void {
    this._ipc.server.emit(
      socket,
      'status',
      this._graph.getNodes().map((n) => ({
        name: n.getName(),
        compiled: n.getCompilationStatus(),
        status: n.isService() ? (n as Service).getStatus() : null,
      })),
    );
  }
}
