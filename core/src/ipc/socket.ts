import { IPC } from 'node-ipc';
import { Socket } from 'net';
import { Observable, Subject } from 'rxjs';
import { IRecompilationEvent, RecompilationEventType, RecompilationScheduler } from '../scheduler';
import { v4 as uuid } from 'uuid';
import { Logger } from '../logger';
import { DependenciesGraph, Service } from '../graph';
import { ServiceStatus, TranspilingStatus } from '@microlambda/types';

interface IGraphStatus {
  name: string;
  compiled: TranspilingStatus;
  status: ServiceStatus;
}

interface IActionRequest {
  service: string;
  execId: string;
}

type Action = 'stop' | 'start' | 'restart' | 'serviceRecompilation';
type RequestEvent = 'requestStop' | 'requestStart' | 'requestRestart';
type ResponseEvent = 'stopped' | 'started' | 'restarted';
type ErrorEvent = 'errorStopping' | 'errorStarting' | 'errorRestarting';

export class IPCSocketsManager {
  private _ipc = new IPC();
  private _graph: DependenciesGraph;
  private readonly _id: string;
  private _sockets: Socket[] = [];
  private readonly _scheduler: RecompilationScheduler;
  private readonly _logger: Logger;

  constructor(projectRoot: string, scheduler: RecompilationScheduler, logger: Logger, graph: DependenciesGraph) {
    this._logger = logger;
    this._logger.log('ipc').info('Creating socket', projectRoot);
    this._ipc.config.silent = !process.env.MILA_DEBUG;
    this._ipc.config.appspace = 'mila.';
    this._graph = graph;
    const projectPathSegments = projectRoot.split('/');
    this._logger.log('ipc').info('Path', projectPathSegments);
    this._id = projectPathSegments[projectPathSegments.length - 1];
    this._logger.log('ipc').info('ID', this._id);
    this._ipc.config.id = this._id;
    this._scheduler = scheduler;
  }

  public async createServer(): Promise<void> {
    return new Promise((resolve) => {
      this._ipc.serve(() => {
        this._logger.log('ipc').debug('socket created');
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
      this._ipc.server.on('serviceRecompiled', () => {

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

  private _findService(name: string, action: Action): Service | null {
    const service = this._graph.getServices().find((s) => s.getName() === name);
    if (!service) {
      this._ipc.server.emit(IPCSocketsManager._errorEvent(action), {
        name,
        error: 'Cannot find service ' + name,
      });
      return null;
    }
    return service;
  }

  private _emitEvent(recompilationEvent: IRecompilationEvent): void {
    switch (recompilationEvent.type) {
      case RecompilationEventType.START_SUCCESS:
        this._ipc.server.emit(IPCSocketsManager._responseEvent('start'), {
          node: recompilationEvent.node.getName(),
          port: this._graph.getPort(recompilationEvent.node.getName()),
        });
        break;
      case RecompilationEventType.STOP_SUCCESS:
        this._ipc.server.emit(IPCSocketsManager._responseEvent('stop'), {
          node: recompilationEvent.node.getName(),
        });
        break;
    }
  }

  private _emitSuccess(execId: string): void {
    this._ipc.server.emit(`succeed-${execId}`, {});
  }

  private _emitFailure(execId: string, err: Error): void {
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
      this._logger.log('ipc').debug('socket connected');
      this._ipc.of[this._id].on('status', (data: IGraphStatus) => {
        graphStatus.next(data);
      });
    });
    return graphStatus.asObservable();
  }

  public graphUpdated(): void {
    this._sockets.forEach((s) => this._emitGraph(s));
  }

  public async requestServiceRecompilation(service: string): Promise<void> {
    return this._requestAction('serviceRecompilation', service);
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
    return new Promise((resolve, reject) => {
      this._ipc.connectTo(this._id, () => {
        this._logger.log('ipc').info('socket connected');
        this._ipc.of[this._id].emit(IPCSocketsManager._requestEvent(action), {
          service,
          execId,
        });
        this._ipc.of[this._id].on(
          IPCSocketsManager._responseEvent(action),
          (data: { service: string; port?: number }) => {
            if (!service || service === data.service) {
              switch (action) {
                case 'start':
                  this._logger.log('ipc').info(`${data.service} started on port ${data.port}`);
                  break;
                case 'stop':
                  this._logger.log('ipc').info(`${data.service} stopped`);
                  break;
                case 'restart':
                  this._logger.log('ipc').info(`${data.service} restarted on port ${data.port}`);
                  break;
              }
            }
          },
        );
        this._ipc.of[this._id].on(
          IPCSocketsManager._errorEvent(action),
          (data: { service?: string; error?: Error }) => {
            if (!service || service === data.service) {
              switch (action) {
                case 'start':
                  this._logger.log('ipc').error(`Error starting ${data.service}`);
                  break;
                case 'stop':
                  this._logger.log('ipc').error(`Error stopping ${data.service}`);
                  break;
                case 'restart':
                  this._logger.log('ipc').error(`Error restarting ${data.service}`);
                  break;
              }
              this._logger.log('ipc').error(data.error);
            }
          },
        );
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
        compiled: n.getTranspilingStatus(),
        status: n.isService() ? (n as Service).getStatus() : null,
      })),
    );
  }
}
