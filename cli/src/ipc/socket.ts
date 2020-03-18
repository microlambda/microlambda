import { IPC } from 'node-ipc';
import { LernaGraph, Service } from '../lerna';
import { log } from '../utils/logger';
import { Socket } from 'net';
import { CompilationStatus } from '../lerna/enums/compilation.status';
import { ServiceStatus } from '../lerna/enums/service.status';
import { Observable, Subject } from 'rxjs';
import { IRecompilationEvent, RecompilationEventType, RecompilationScheduler } from '../utils/scheduler';
import { v4 as uuid } from 'uuid';

interface IGraphStatus {
  name: string;
  compiled: CompilationStatus;
  status: ServiceStatus;
}

interface IActionRequest {
  service: string;
  execId: string;
}

type Action = 'stop' | 'start' | 'restart';
type RequestEvent = 'requestStop' | 'requestStart' | 'requestRestart';
type ResponseEvent = 'stopped' | 'started' | 'restarted';
type ErrorEvent = 'errorStopping' | 'errorStarting' | 'errorRestarting';

export class SocketsManager {
  private _ipc = new IPC();
  private _graph: LernaGraph;
  private readonly _id: string;
  private _sockets: Socket[] = [];
  private readonly _scheduler: RecompilationScheduler;

  constructor(projectRoot: string, scheduler: RecompilationScheduler, graph?: LernaGraph) {
    log.debug('Creating socket');
    this._ipc.config.silent = !process.env.MILA_DEBUG;
    this._ipc.config.appspace = 'mila.';
    this._graph = graph;
    const projectPathSegments = projectRoot.split('/');
    this._id = projectPathSegments[projectPathSegments.length - 1];
    this._scheduler = scheduler;
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
      this._ipc.server.on('requestStart', (request: IActionRequest) => {
        if (request.service) {
          this._startOne(request.service, request.execId);
        } else {
          this._startAll(request.execId);
        }
      });
      this._ipc.server.on('requestStop', (request: IActionRequest) => {
        if (request.service) {
          this._stopOne(request.service, request.execId);
        } else {
          this._stopAll(request.execId);
        }
      });
      this._ipc.server.on('requestRestart', (request: IActionRequest) => {
        if (request.service) {
          this._restartOne(request.service, request.execId);
        } else {
          this._restartAll(request.execId);
        }
      });
      this._ipc.server.start();
    });
  }

  private _startOne(service: string, execId: string): void {
    const toStart = this._findService(service, 'start');
    if (toStart) {
      this._scheduler.startOne(toStart).subscribe(
        (event) => this._emitEvent(event),
        (err) => this._emitFailure(execId, err),
        () => this._emitSuccess(execId),
      );
    }
  }

  private _startAll(execId: string): void {
    this._scheduler.startAll().subscribe(
      (event) => this._emitEvent(event),
      (err) => this._emitFailure(execId, err),
      () => this._emitSuccess(execId),
    );
  }

  private _findService(name: string, action: Action): Service {
    const service = this._graph.getServices().find((s) => s.getName() === name);
    if (!service) {
      this._ipc.server.emit(SocketsManager._errorEvent(action), {
        name,
        error: 'Cannot find service ' + name,
      });
      return null;
    }
    return service;
  }

  private _emitEvent(recompilationEvent: IRecompilationEvent) {
    switch (recompilationEvent.type) {
      case RecompilationEventType.SERVICE_STARTED:
        this._ipc.server.emit(SocketsManager._responseEvent('start'), {
          node: recompilationEvent.node.getName(),
          port: this._graph.getPort(recompilationEvent.node.getName()),
        });
        break;
      case RecompilationEventType.SERVICE_STOPPED:
        this._ipc.server.emit(SocketsManager._responseEvent('stop'), {
          node: recompilationEvent.node.getName(),
        });
        break;
    }
  }

  private _emitSuccess(execId: string) {
    this._ipc.server.emit(`succeed-${execId}`, {});
  }

  private _emitFailure(execId: string, err: Error) {
    this._ipc.server.emit(`failed-${execId}`, err);
  }

  private _stopOne(service: string, execId: string): void {
    const toStop = this._findService(service, 'stop');
    if (toStop) {
      this._scheduler.stopOne(toStop).subscribe(
        (event) => this._emitEvent(event),
        (err) => this._emitFailure(execId, err),
        () => this._emitSuccess(execId),
      );
    }
  }

  private _stopAll(execId: string): void {
    this._scheduler.stopAll().subscribe(
      (event) => this._emitEvent(event),
      (err) => this._emitFailure(execId, err),
      () => this._emitSuccess(execId),
    );
  }

  private _restartOne(service: string, execId: string): void {
    const toRestart = this._findService(service, 'restart');
    if (toRestart) {
      this._scheduler.restartOne(toRestart).subscribe(
        (event) => this._emitEvent(event),
        (err) => this._emitFailure(execId, err),
        () => this._emitSuccess(execId),
      );
    }
  }

  private _restartAll(execId: string): void {
    this._scheduler.restartAll().subscribe(
      (event) => this._emitEvent(event),
      (err) => this._emitFailure(execId, err),
      () => this._emitSuccess(execId),
    );
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

  public async requestStop(service?: string): Promise<void> {
    return this._requestAction('stop', service);
  }

  public async requestStart(service?: string): Promise<void> {
    return this._requestAction('start', service);
  }

  public async requestRestart(service?: string): Promise<void> {
    return this._requestAction('restart', service);
  }

  private async _requestAction(action: Action, service?: string): Promise<void> {
    const execId = uuid();
    this._ipc.connectTo(this._id, () => {
      log.debug('socket connected');
      this._ipc.of[this._id].emit(SocketsManager._requestEvent(action), {
        service,
        execId,
      });
      this._ipc.of[this._id].on(SocketsManager._responseEvent(action), (data: { service: string; port?: number }) => {
        if (!service || service === data.service) {
          switch (action) {
            case 'start':
              log.info(`${data.service} started on port ${data.port}`);
              break;
            case 'stop':
              log.info(`${data.service} stopped`);
              break;
            case 'restart':
              log.info(`${data.service} restarted on port ${data.port}`);
              break;
          }
        }
      });
      this._ipc.of[this._id].on(SocketsManager._errorEvent(action), (data: { service?: string; error?: Error }) => {
        if (!service || service === data.service) {
          switch (action) {
            case 'start':
              log.error(`Error starting ${data.service}`);
              break;
            case 'stop':
              log.error(`Error stopping ${data.service}`);
              break;
            case 'restart':
              log.error(`Error restarting ${data.service}`);
              break;
          }
          log.error(data.error);
        }
      });
      return new Promise((resolve, reject) => {
        this._ipc.of[this._id].on(`succeed-${execId}`, () => resolve());
        this._ipc.of[this._id].on(`failed-${execId}`, () => reject());
      });
    });
  }

  private static _requestEvent(action: Action): RequestEvent {
    switch (action) {
      case 'start':
        return 'requestStart';
      case 'stop':
        return 'requestStop';
      case 'restart':
        return 'requestRestart';
      default:
        throw Error(`Invalid action ${action}`);
    }
  }

  private static _responseEvent(action: Action): ResponseEvent {
    switch (action) {
      case 'start':
        return 'started';
      case 'stop':
        return 'stopped';
      case 'restart':
        return 'restarted';
      default:
        throw Error(`Invalid action ${action}`);
    }
  }

  private static _errorEvent(action: Action): ErrorEvent {
    switch (action) {
      case 'start':
        return 'errorStarting';
      case 'stop':
        return 'errorStopping';
      case 'restart':
        return 'errorRestarting';
      default:
        throw Error(`Invalid action ${action}`);
    }
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
